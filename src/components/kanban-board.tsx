import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { initials, STATUSES, STATUS_LABELS, type Task, type TaskStatus } from "@/lib/board-api";

const PRIORITY_STYLES: Record<Task["priority"], string> = {
  low: "bg-low/15 text-low",
  medium: "bg-medium/15 text-medium",
  high: "bg-high/15 text-high",
};

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  todo: "bg-muted-foreground",
  in_progress: "bg-primary",
  done: "bg-low",
};

type KanbanBoardProps = {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
  onMoveTask: (taskId: string, status: TaskStatus, position: number) => void;
};

export function KanbanBoard({ tasks, onOpenTask, onAddTask, onMoveTask }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const columns = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] };
    for (const task of [...tasks].sort((a, b) => a.position - b.position)) {
      grouped[task.status].push(task);
    }
    return grouped;
  }, [tasks]);

  const activeTask = tasks.find((task) => task.id === activeId) ?? null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    const overId = String(over.id);
    let targetStatus: TaskStatus;
    let targetIndex: number;

    if (overId.startsWith("column:")) {
      targetStatus = overId.slice("column:".length) as TaskStatus;
      targetIndex = columns[targetStatus].length;
    } else {
      const overTask = tasks.find((item) => item.id === overId);
      if (!overTask) return;
      targetStatus = overTask.status;
      targetIndex = columns[targetStatus].findIndex((item) => item.id === overId);
    }

    const list = columns[targetStatus].filter((item) => item.id !== taskId);
    const index = Math.max(0, Math.min(targetIndex, list.length));
    const before = list[index - 1]?.position;
    const after = list[index]?.position;
    let position: number;
    if (before == null && after == null) position = 1000;
    else if (before == null) position = after! - 100;
    else if (after == null) position = before + 100;
    else position = (before + after) / 2;

    if (task.status === targetStatus && task.position === position) return;
    onMoveTask(taskId, targetStatus, position);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid gap-5 lg:grid-cols-3">
        {STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={columns[status]}
            onOpenTask={onOpenTask}
            onAddTask={onAddTask}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCardView task={activeTask} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  tasks,
  onOpenTask,
  onAddTask,
}: {
  status: TaskStatus;
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-h-64 flex-col rounded-3xl bg-surface p-4 transition-colors",
        isOver && "bg-primary/5 ring-2 ring-primary/30",
      )}
    >
      <header className="mb-4 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", COLUMN_ACCENT[status])} />
          <h2 className="text-sm font-bold tracking-wide uppercase">{STATUS_LABELS[status]}</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onAddTask(status)}
          aria-label={`Add task to ${STATUS_LABELS[status]}`}
        >
          <Plus className="size-4" />
        </Button>
      </header>

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-3">
          {tasks.map((task) => (
            <SortableTask key={task.id} task={task} onOpen={() => onOpenTask(task)} />
          ))}
          {tasks.length === 0 && (
            <button
              type="button"
              onClick={() => onAddTask(status)}
              className="rounded-2xl border border-dashed border-border py-8 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              Drop a card here or add one
            </button>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableTask({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen();
      }}
    >
      <TaskCardView task={task} />
    </div>
  );
}

function TaskCardView({ task, dragging }: { task: Task; dragging?: boolean }) {
  return (
    <article
      className={cn(
        "cursor-grab rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-panel)]",
        dragging && "rotate-2 cursor-grabbing shadow-[var(--shadow-panel)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm leading-snug font-semibold">{task.title}</h3>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold capitalize",
            PRIORITY_STYLES[task.priority],
          )}
        >
          {task.priority}
        </span>
      </div>

      {task.description && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
      )}

      {task.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {task.due_date && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {new Date(task.due_date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
        {task.assignee && (
          <span
            className="grid size-7 place-items-center rounded-full bg-primary/15 text-[11px] font-bold text-primary"
            title={task.assignee}
          >
            {initials(task.assignee)}
          </span>
        )}
      </div>
    </article>
  );
}
