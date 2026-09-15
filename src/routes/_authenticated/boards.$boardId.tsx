import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { UIMessage } from "ai";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { KanbanBoard } from "@/components/kanban-board";
import { TaskDialog } from "@/components/task-dialog";
import { CopilotPanel } from "@/components/copilot-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  boardKeys,
  createTask,
  deleteTask,
  fetchBoard,
  fetchTasks,
  updateTask,
  type Task,
  type TaskInput,
  type TaskStatus,
} from "@/lib/board-api";

export const Route = createFileRoute("/_authenticated/boards/$boardId")({
  head: () => ({
    meta: [
      { title: "Board — Scopeboard" },
      {
        name: "description",
        content: "Drag cards between To Do, In Progress and Done, with an AI co-pilot alongside.",
      },
      { property: "og:title", content: "Board — Scopeboard" },
      {
        property: "og:description",
        content: "Drag cards between To Do, In Progress and Done, with an AI co-pilot alongside.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoardPage,
});

async function fetchChat(boardId: string): Promise<UIMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, parts")
    .eq("board_id", boardId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    role: row.role as UIMessage["role"],
    parts: row.parts as unknown as UIMessage["parts"],
  }));
}

function BoardPage() {
  const { boardId } = Route.useParams();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [newStatus, setNewStatus] = useState<TaskStatus>("todo");

  const board = useQuery({ queryKey: boardKeys.detail(boardId), queryFn: () => fetchBoard(boardId) });
  const tasks = useQuery({ queryKey: boardKeys.tasks(boardId), queryFn: () => fetchTasks(boardId) });
  const chat = useQuery({ queryKey: boardKeys.chat(boardId), queryFn: () => fetchChat(boardId) });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: boardKeys.tasks(boardId) });

  const saveTask = useMutation({
    mutationFn: async (input: TaskInput) => {
      if (editing) {
        await updateTask(editing.id, input);
        return;
      }
      const sameColumn = (tasks.data ?? []).filter((task) => task.status === input.status);
      const position = (sameColumn.at(-1)?.position ?? 900) + 100;
      await createTask(boardId, input, position);
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const removeTask = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const moveTask = useMutation({
    mutationFn: ({
      id,
      status,
      position,
    }: {
      id: string;
      status: TaskStatus;
      position: number;
    }) => updateTask(id, { status, position }),
    onMutate: async ({ id, status, position }) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.tasks(boardId) });
      const previous = queryClient.getQueryData<Task[]>(boardKeys.tasks(boardId));
      queryClient.setQueryData<Task[]>(boardKeys.tasks(boardId), (current) =>
        (current ?? []).map((task) => (task.id === id ? { ...task, status, position } : task)),
      );
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(boardKeys.tasks(boardId), context.previous);
      toast.error(error.message);
    },
    onSettled: invalidate,
  });

  return (
    <AppShell>
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/boards"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> All boards
            </Link>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
              {board.data?.name ?? "Board"}
            </h1>
            {board.data?.description && (
              <p className="mt-1 max-w-2xl text-muted-foreground">{board.data.description}</p>
            )}
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setNewStatus("todo");
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 size-4" /> New task
          </Button>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            {tasks.isLoading ? (
              <div className="grid gap-5 lg:grid-cols-3">
                {[0, 1, 2].map((key) => (
                  <Skeleton key={key} className="h-72 rounded-3xl" />
                ))}
              </div>
            ) : (
              <KanbanBoard
                tasks={tasks.data ?? []}
                onOpenTask={(task) => {
                  setEditing(task);
                  setDialogOpen(true);
                }}
                onAddTask={(status) => {
                  setEditing(null);
                  setNewStatus(status);
                  setDialogOpen(true);
                }}
                onMoveTask={(id, status, position) => moveTask.mutate({ id, status, position })}
              />
            )}
          </div>

          <div className="h-[calc(100vh-13rem)] xl:sticky xl:top-24">
            {chat.isLoading ? (
              <Skeleton className="h-full rounded-3xl" />
            ) : (
              <CopilotPanel boardId={boardId} initialMessages={chat.data ?? []} />
            )}
          </div>
        </div>
      </main>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        defaultStatus={newStatus}
        onSubmit={(input) => saveTask.mutateAsync(input)}
        {...(editing
          ? { onDelete: () => removeTask.mutateAsync(editing.id).then(() => undefined) }
          : {})}
      />
    </AppShell>
  );
}
