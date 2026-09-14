import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Layers, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { boardKeys, createBoard, deleteBoard, fetchBoards } from "@/lib/board-api";

export const Route = createFileRoute("/_authenticated/boards")({
  head: () => ({
    meta: [
      { title: "Your boards — Scopeboard" },
      { name: "description", content: "All of your Scopeboard Kanban boards in one place." },
      { property: "og:title", content: "Your boards — Scopeboard" },
      {
        property: "og:description",
        content: "All of your Scopeboard Kanban boards in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoardsPage,
});

function BoardsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const boards = useQuery({ queryKey: boardKeys.all, queryFn: fetchBoards });

  const create = useMutation({
    mutationFn: () => createBoard({ name: name.trim(), description: description.trim() }),
    onSuccess: () => {
      setOpen(false);
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: boardKeys.all });
      toast.success("Board created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBoard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.all });
      toast.success("Board deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell>
      <main className="mx-auto max-w-[1600px] px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Your boards</h1>
            <p className="mt-1 text-muted-foreground">
              Pick a board to plan with your co-pilot, or start a new one.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 size-4" /> New board
          </Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.isLoading &&
            [0, 1, 2].map((key) => <Skeleton key={key} className="h-40 rounded-3xl" />)}

          {boards.data?.map((board) => (
            <div
              key={board.id}
              className="group relative rounded-3xl bg-card p-6 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-panel)]"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Layers className="size-5" />
              </span>
              <h2 className="mt-4 text-lg font-bold">{board.name}</h2>
              <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">
                {board.description || "No description yet."}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <Link
                  to="/boards/$boardId"
                  params={{ boardId: board.id }}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                  Open board <ArrowRight className="size-4" />
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${board.name}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(board.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}

          {boards.data?.length === 0 && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-3xl border border-dashed border-border p-10 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              Create your first board
            </button>
          )}
        </div>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New board</DialogTitle>
            <DialogDescription>Give your project a name to get started.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="board-name">Board name</Label>
              <Input
                id="board-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Q3 product launch"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="board-description">Description</Label>
              <Textarea
                id="board-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What is this board for?"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!name.trim() || create.isPending}>
                Create board
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
