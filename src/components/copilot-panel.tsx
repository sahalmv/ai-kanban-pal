import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Sparkle } from "lucide-react";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { supabase } from "@/integrations/supabase/client";
import { boardKeys } from "@/lib/board-api";

type CopilotPanelProps = {
  boardId: string;
  initialMessages: UIMessage[];
};

const SUGGESTIONS = [
  "What's left to do on this board?",
  "Add a high priority task to review the launch copy",
  "Move everything tagged design to In Progress",
];

export function CopilotPanel({ boardId, initialMessages }: CopilotPanelProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { boardId },
        fetch: async (input, init) => {
          const { data } = await supabase.auth.getSession();
          const headers = new Headers(init?.headers);
          if (data.session?.access_token) {
            headers.set("Authorization", `Bearer ${data.session.access_token}`);
          }
          return fetch(input, { ...init, headers });
        },
      }),
    [boardId],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: boardId,
    messages: initialMessages,
    transport,
    onFinish: async ({ message }) => {
      await persistMessage(boardId, message);
      queryClient.invalidateQueries({ queryKey: boardKeys.tasks(boardId) });
    },
    onError: (chatError) => {
      toast.error(chatError.message || "The co-pilot could not answer right now.");
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    textareaRef.current?.focus();
  }, [boardId, status]);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    const userMessage: UIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: trimmed }],
    };
    void persistMessage(boardId, userMessage);
    await sendMessage({ text: trimmed });
  }

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-3xl bg-card shadow-[var(--shadow-panel)]">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Bot className="size-5" />
        </span>
        <div>
          <h2 className="text-sm font-bold">Board co-pilot</h2>
          <p className="text-xs text-muted-foreground">Asks, plans and edits your cards</p>
        </div>
      </header>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-4">
          {messages.length === 0 && (
            <div className="px-1 py-6 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <Sparkle className="size-4 text-accent" /> Try asking
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => submit(suggestion)}
                    className="rounded-xl bg-muted px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent
                className={
                  message.role === "assistant" ? "bg-transparent px-0 text-foreground" : undefined
                }
              >
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return (
                      <MessageResponse key={`${message.id}-${index}`}>{part.text}</MessageResponse>
                    );
                  }
                  if (part.type.startsWith("tool-")) {
                    const toolPart = part as unknown as {
                      type: string;
                      state: string;
                      input?: unknown;
                      output?: unknown;
                      errorText?: string;
                    };
                    return (
                      <Tool key={`${message.id}-${index}`} defaultOpen={false}>
                        <ToolHeader
                          type={toolPart.type as `tool-${string}`}
                          state={
                            toolPart.state as
                              | "input-streaming"
                              | "input-available"
                              | "output-available"
                              | "output-error"
                          }
                        />
                        <ToolContent>
                          <ToolInput input={toolPart.input} />
                          <ToolOutput
                            output={
                              toolPart.output ? (
                                <pre className="text-xs whitespace-pre-wrap">
                                  {JSON.stringify(toolPart.output, null, 2)}
                                </pre>
                              ) : undefined
                            }
                            errorText={toolPart.errorText}
                          />
                        </ToolContent>
                      </Tool>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" && <Shimmer className="px-1 text-sm">Thinking...</Shimmer>}
          {error && (
            <p className="px-1 text-sm text-destructive">
              {error.message || "The co-pilot could not answer right now."}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-4">
        <PromptInput
          onSubmit={(_message, event) => {
            event.preventDefault();
            void submit(input);
          }}
        >
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about the board or tell me what to change..."
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={!input.trim() && !busy} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </aside>
  );
}

async function persistMessage(boardId: string, message: UIMessage) {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return;
  const { error } = await supabase.from("chat_messages").insert({
    board_id: boardId,
    user_id: userId,
    role: message.role,
    parts: message.parts as unknown as Record<string, unknown>[],
  });
  if (error) console.error(error);
}
