import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceBadge, StatusPill } from "@/components/qj/primitives";
import { fmtEps, orderingLabel } from "@/lib/data";
import { fmtDate, useRuns, type RunStatus } from "@/lib/runs-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_workbench/runs/")({
  head: () => ({
    meta: [
      { title: "Run history — Quantum JPEG" },
      { name: "description", content: "Benchmark records from the results file and saved pending configurations." },
      { property: "og:title", content: "Run history — Quantum JPEG" },
      { property: "og:description", content: "All runs with status and configuration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RunsPage,
});

const FILTERS: ("all" | RunStatus)[] = ["all", "complete", "pending", "failed"];

function RunsPage() {
  const { runs, loading } = useRuns();
  const [q, setQ] = useState("");
  const [st, setSt] = useState<(typeof FILTERS)[number]>("all");
  const list = useMemo(() => runs.filter((r) => (st === "all" || r.status === st) && `${r.id} ${r.name}`.toLowerCase().includes(q.toLowerCase())), [runs, q, st]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search runs" className="pl-9" aria-label="Search runs" />
        </div>
        <div className="flex rounded-lg bg-muted p-1">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setSt(f)} aria-pressed={st === f} className={cn("rounded-md px-3 py-1 text-xs font-medium capitalize", st === f ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>{f}</button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">{list.length} runs</span>
      </div>
      <p className="text-[11px] text-muted-foreground"><span className="font-mono">BR-</span> = benchmark record from the results file · <span className="font-mono">UI-</span> = configuration you saved in this browser (pending until benchmarked).</p>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <div className="min-w-[760px]">
          {loading && [0, 1, 2].map((i) => <Skeleton key={i} className="m-4 h-10" />)}
          {list.map((r) => (
            <Link key={r.id} to="/runs/$runId" params={{ runId: r.id }} className="flex items-center gap-5 border-b px-5 py-3.5 last:border-0 hover:bg-muted/30">
              <span className="w-20 font-mono text-xs text-muted-foreground">{r.id}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{r.config.resolution}×{r.config.resolution} · {r.config.mode} · {orderingLabel(r.config.ordering)} · χ={r.config.chi} · εcx {fmtEps(r.config.noise.epsCx)}</p>
              </div>
              <SourceBadge source={r.source} />
              <StatusPill status={r.status} />
              <span className="w-32 text-right text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
          {!loading && list.length === 0 && <p className="px-5 py-16 text-center text-sm text-muted-foreground">{runs.length ? "No runs match your search." : "No runs yet. Load a result in the Simulation workbench or add records to results.json."}</p>}
        </div>
      </div>
    </div>
  );
}
