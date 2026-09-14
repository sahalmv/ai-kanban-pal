import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, Columns3, Sparkle, Tags, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scopeboard — Kanban boards with an AI co-pilot" },
      {
        name: "description",
        content:
          "A modern Kanban board with drag-and-drop cards, priorities, tags and an AI co-pilot that creates and moves tasks for you.",
      },
      { property: "og:title", content: "Scopeboard — Kanban boards with an AI co-pilot" },
      {
        property: "og:description",
        content:
          "A modern Kanban board with drag-and-drop cards, priorities, tags and an AI co-pilot that creates and moves tasks for you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Columns3,
    title: "Three-column flow",
    body: "To Do, In Progress and Done — drag cards between columns and the order sticks.",
  },
  {
    icon: Bot,
    title: "AI co-pilot",
    body: "Ask about your project, or tell it to add, edit and move tasks. It works the board for you.",
  },
  {
    icon: Tags,
    title: "Priorities & tags",
    body: "Colour-coded priority badges, tags and due dates so the important work stands out.",
  },
  {
    icon: Users,
    title: "Assignees",
    body: "Put a name on every card and see who owns what at a glance.",
  },
];

function Landing() {
  const { user, loading } = useSession();

  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Columns3 className="size-5" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">Scopeboard</span>
        </div>
        <Button asChild>
          <Link to={user ? "/boards" : "/auth"}>
            {loading ? "Scopeboard" : user ? "Open my boards" : "Sign in"}
          </Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-10 pb-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase">
          <Sparkle className="size-3.5" /> AI co-pilot built in
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-extrabold tracking-tight text-balance sm:text-6xl">
          The Kanban board that moves your tasks for you
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Plan a project in three columns, drag cards where they belong, and ask the co-pilot to
          create, update or move work while you keep thinking.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to={user ? "/boards" : "/auth"}>
              {user ? "Open my boards" : "Get started free"} <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl bg-card p-6 text-left shadow-[var(--shadow-card)]"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <feature.icon className="size-5" />
              </span>
              <h2 className="mt-4 font-bold">{feature.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
