import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Columns3, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { initials } from "@/lib/board-api";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const displayName =
    (user?.user_metadata?.["full_name"] as string | undefined) ?? user?.email ?? "You";

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6">
          <Link to="/boards" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Columns3 className="size-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">Scopeboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <span
              className="grid size-9 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent"
              title={displayName}
            >
              {initials(displayName)}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-1.5 size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
