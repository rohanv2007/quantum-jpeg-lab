import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, ChevronRight, FlaskConical, History, LayoutDashboard, PanelLeft, Plus, Settings, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/qj/primitives";
import { DEFAULT_CONFIG } from "@/lib/data";
import { setDraftConfig, loadDefaults } from "@/lib/draft";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_workbench")({
  component: WorkbenchLayout,
});

const NAV = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/simulation", label: "Simulation", icon: FlaskConical },
  { to: "/benchmarks", label: "Benchmarks", icon: BarChart3 },
  { to: "/runs", label: "Run history", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function WorkbenchLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const current = NAV.find((n) => path.startsWith(n.to));
  const runId = path.match(/^\/runs\/(.+)/)?.[1];

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className={cn("sticky top-0 flex h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-300", collapsed ? "w-16" : "w-60")}>
        <div className="flex h-16 items-center gap-2.5 px-4">
          <Link to="/" className="flex items-center gap-2.5 text-sidebar-accent-foreground" aria-label="Quantum JPEG home">
            <Logo />
            {!collapsed && <span className="text-[15px] font-semibold tracking-tight">Quantum JPEG</span>}
          </Link>
        </div>
        <nav className="mt-2 flex-1 space-y-0.5 px-2.5" aria-label="Main">
          {NAV.map((n) => {
            const active = path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                title={collapsed ? n.label : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <n.icon className={cn("h-4 w-4 shrink-0", active && "text-sidebar-primary")} />
                {!collapsed && n.label}
              </Link>
            );
          })}
        </nav>
        {!collapsed ? (
          <div className="m-3 rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-sidebar-muted">Simulation environment</p>
            <dl className="mt-2.5 space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between"><dt className="text-sidebar-muted">Qiskit</dt><dd>2.6</dd></div>
              <div className="flex justify-between"><dt className="text-sidebar-muted">Aer</dt><dd className="text-warning">pending</dd></div>
              <div className="flex justify-between"><dt className="text-sidebar-muted">Backend</dt><dd>prototype UI</dd></div>
            </dl>
            <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-sidebar-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-sidebar-primary" /> Previews are illustrative
            </p>
          </div>
        ) : (
          <div className="mx-auto mb-4 h-2 w-2 rounded-full bg-sidebar-primary" title="Prototype UI · previews are illustrative" />
        )}
        <button onClick={() => setCollapsed((c) => !c)} className="flex h-11 items-center gap-3 border-t border-sidebar-border px-5 text-xs text-sidebar-muted hover:text-sidebar-accent-foreground" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <PanelLeft className="h-4 w-4" />
          {!collapsed && "Collapse"}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-background/85 px-8 backdrop-blur">
          <div className="min-w-0 flex-1">
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-foreground"><Home className="h-3.5 w-3.5" /></Link>
              <ChevronRight className="h-3 w-3" />
              {runId ? (
                <>
                  <Link to="/runs" className="hover:text-foreground">Run history</Link>
                  <ChevronRight className="h-3 w-3" />
                  <span className="font-mono text-foreground">{decodeURIComponent(runId)}</span>
                </>
              ) : (
                <span className="text-foreground">{current?.label}</span>
              )}
            </nav>
            <h1 className="truncate text-[17px] font-semibold tracking-tight">{runId ? "Run detail" : current?.label === "Simulation" ? "Simulation workbench" : current?.label === "Benchmarks" ? "Benchmark explorer" : current?.label}</h1>
          </div>
          <Button
            onClick={() => {
              setDraftConfig(typeof window !== "undefined" ? loadDefaults() : DEFAULT_CONFIG);
              navigate({ to: "/simulation" });
            }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" /> New simulation
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary" aria-label="Profile menu">RV</DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium">Rohan V</p>
                <p className="text-xs text-muted-foreground">Research workspace</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/settings">Settings</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/runs">My runs</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/">Project home</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 px-8 py-7 animate-in fade-in duration-300" key={path}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
