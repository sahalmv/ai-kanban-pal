import { supabase } from "@/integrations/supabase/client";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type Task = {
  id: string;
  board_id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  assignee: string | null;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type Board = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

export const STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

export const boardKeys = {
  all: ["boards"] as const,
  detail: (id: string) => ["boards", id] as const,
  tasks: (id: string) => ["boards", id, "tasks"] as const,
  chat: (id: string) => ["boards", id, "chat"] as const,
};

export async function fetchBoards(): Promise<Board[]> {
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Board[];
}

export async function fetchBoard(id: string): Promise<Board> {
  const { data, error } = await supabase.from("boards").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Board;
}

export async function fetchTasks(boardId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("board_id", boardId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function createBoard(input: { name: string; description?: string }) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("boards")
    .insert({ name: input.name, description: input.description ?? null, owner_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Board;
}

export async function deleteBoard(id: string) {
  const { error } = await supabase.from("boards").delete().eq("id", id);
  if (error) throw error;
}

export type TaskInput = {
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  assignee?: string | null;
  due_date?: string | null;
};

export async function createTask(boardId: string, input: TaskInput, position: number) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      board_id: boardId,
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      tags: input.tags,
      assignee: input.assignee ?? null,
      due_date: input.due_date ?? null,
      position,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(id: string, patch: Partial<Task>) {
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
