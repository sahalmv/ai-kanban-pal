import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  getLovableAiGatewayResponseHeaders,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";

type ChatRequestBody = { messages?: unknown; boardId?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatRequestBody;
        const messages = body.messages;
        const boardId = typeof body.boardId === "string" ? body.boardId : null;
        if (!Array.isArray(messages) || !boardId) {
          return new Response("Invalid request", { status: 400 });
        }

        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const lovableApiKey = process.env["LOVABLE_API_KEY"];
        if (!lovableApiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const supabase = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          },
        );

        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const { data: board } = await supabase
          .from("boards")
          .select("id, name, description")
          .eq("id", boardId)
          .maybeSingle();
        if (!board) return new Response("Board not found", { status: 404 });

        const { data: currentTasks } = await supabase
          .from("tasks")
          .select("id, title, description, status, priority, tags, assignee, due_date, position")
          .eq("board_id", boardId)
          .order("position", { ascending: true });

        async function nextPosition(status: string) {
          const { data } = await supabase
            .from("tasks")
            .select("position")
            .eq("board_id", boardId!)
            .eq("status", status)
            .order("position", { ascending: false })
            .limit(1);
          return (data?.[0]?.position ?? 900) + 100;
        }

        const tools = {
          list_tasks: tool({
            description: "List every task currently on this board.",
            inputSchema: z.object({}),
            execute: async () => {
              const { data, error } = await supabase
                .from("tasks")
                .select("id, title, status, priority, tags, assignee, due_date")
                .eq("board_id", boardId)
                .order("position", { ascending: true });
              if (error) return { error: error.message };
              return { tasks: data ?? [] };
            },
          }),
          create_task: tool({
            description: "Create a new task card on the board.",
            inputSchema: z.object({
              title: z.string(),
              description: z.string().nullable(),
              status: z.enum(["todo", "in_progress", "done"]),
              priority: z.enum(["low", "medium", "high"]),
              tags: z.array(z.string()),
              assignee: z.string().nullable(),
              due_date: z.string().nullable().describe("ISO date, YYYY-MM-DD"),
            }),
            execute: async (input) => {
              const position = await nextPosition(input.status);
              const { data, error } = await supabase
                .from("tasks")
                .insert({
                  board_id: boardId,
                  user_id: userId,
                  title: input.title,
                  description: input.description,
                  status: input.status,
                  priority: input.priority,
                  tags: input.tags,
                  assignee: input.assignee,
                  due_date: input.due_date,
                  position,
                })
                .select("id, title, status")
                .single();
              if (error) return { error: error.message };
              return { created: data };
            },
          }),
          update_task: tool({
            description: "Update fields of an existing task. Pass null to leave a field unchanged.",
            inputSchema: z.object({
              id: z.string(),
              title: z.string().nullable(),
              description: z.string().nullable(),
              priority: z.enum(["low", "medium", "high"]).nullable(),
              tags: z.array(z.string()).nullable(),
              assignee: z.string().nullable(),
              due_date: z.string().nullable(),
            }),
            execute: async (input) => {
              const patch: Record<string, unknown> = {};
              if (input.title !== null) patch["title"] = input.title;
              if (input.description !== null) patch["description"] = input.description;
              if (input.priority !== null) patch["priority"] = input.priority;
              if (input.tags !== null) patch["tags"] = input.tags;
              if (input.assignee !== null) patch["assignee"] = input.assignee;
              if (input.due_date !== null) patch["due_date"] = input.due_date;
              if (Object.keys(patch).length === 0) return { error: "Nothing to update" };
              const { error } = await supabase
                .from("tasks")
                .update(patch)
                .eq("id", input.id)
                .eq("board_id", boardId);
              if (error) return { error: error.message };
              return { updated: input.id };
            },
          }),
          move_task: tool({
            description: "Move a task to another column (To Do, In Progress, Done).",
            inputSchema: z.object({
              id: z.string(),
              status: z.enum(["todo", "in_progress", "done"]),
            }),
            execute: async (input) => {
              const position = await nextPosition(input.status);
              const { error } = await supabase
                .from("tasks")
                .update({ status: input.status, position })
                .eq("id", input.id)
                .eq("board_id", boardId);
              if (error) return { error: error.message };
              return { moved: input.id, status: input.status };
            },
          }),
          delete_task: tool({
            description: "Delete a task from the board.",
            inputSchema: z.object({ id: z.string() }),
            execute: async (input) => {
              const { error } = await supabase
                .from("tasks")
                .delete()
                .eq("id", input.id)
                .eq("board_id", boardId);
              if (error) return { error: error.message };
              return { deleted: input.id };
            },
          }),
        };

        const initialRunId = getLovableAiGatewayRunId(request);
        const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
        const lovable = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: lovableApiKey,
          headers: {
            "Lovable-API-Key": lovableApiKey,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
          fetch: runIdFetch.fetch,
        });

        const system = [
          `You are the co-pilot for the Kanban board "${board.name}".`,
          board.description ? `Board description: ${board.description}` : "",
          "The board has three columns: todo (To Do), in_progress (In Progress) and done (Done).",
          "Use the tools to read and change the board whenever the user asks for changes; never claim a change you did not make with a tool.",
          "Answer briefly in markdown. When you change cards, say exactly what changed.",
          "Current tasks (JSON):",
          JSON.stringify(currentTasks ?? []),
        ]
          .filter(Boolean)
          .join("\n");

        const result = streamText({
          model: lovable.responses("openai/gpt-6-astra"),
          system,
          messages: convertToModelMessages(messages as UIMessage[]),
          tools,
          stopWhen: stepCountIs(50),
          providerOptions: {
            openai: {
              store: false,
              include: ["reasoning.encrypted_content"],
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
            },
          },
        });

        const response = result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
          headers: getLovableAiGatewayResponseHeaders(undefined, {
            ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
          }),
        });

        return withLovableAiGatewayRunIdHeader(response, runIdFetch);
      },
    },
  },
});
