import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Download, FileJson } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CircuitDiagram, MetricValue, ProvenanceNote, RecordImage, ShotsNote, SourceBadge, StatusPill } from "@/components/qj/primitives";
import { CHIS, ENV, fmtEps, orderingLabel, qubitsFor, type Chi } from "@/lib/data";
import { setDraftConfig } from "@/lib/draft";
import { download, findRecord, fromRecord, metricsFor, reproduceCommand, useResults } from "@/lib/results";
import { fmtDate, removeSaved, useRuns } from "@/lib/runs-store";

export const Route = createFileRoute("/_workbench/runs/$runId")({
  head: ({ params }) => ({
    meta: [
      { title: `Run ${params.runId} — Quantum JPEG` },
      { name: "description", content: "Run detail: reconstructions, resource and fidelity metrics, noise configuration and reproducible provenance." },
      { property: "og:title", content: `Run ${params.runId} — Quantum JPEG` },
      { property: "og:description", content: "Quantum JPEG run detail." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RunDetail,
});

function RunDetail() {
  const { runId } = Route.useParams();
  const { runs, loading } = useRuns();
  const res = useResults();
  const navigate = useNavigate();
  const run = runs.find((r) => r.id === runId);
  const [chiView, setChiView] = useState<Chi | null>(null);

  if (loading) return <div className="mx-auto max-w-6xl space-y-4"><Skeleton className="h-16" /><Skeleton className="h-80" /></div>;
  if (!run) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="font-mono text-xs text-muted-foreground">404</p>
        <p className="mt-1 text-lg font-semibold">Run not found</p>
        <p className="mt-1 text-sm text-muted-foreground">No run with ID {runId} exists in results.json or in this browser.</p>
        <Button asChild className="mt-5" variant="outline"><Link to="/runs">Back to run history</Link></Button>
      </div>
    );
  }
  const c = run.config;
  const rec = run.record;
  const m = rec ? fromRecord(rec, findRecord(res.records, { qubits: rec.qubits, ordering: rec.ordering, chi: rec.chi, eps: 0, image: rec.image })) : metricsFor(res.records, c);
  const q = qubitsFor(c.resolution);
  const chiNow = chiView ?? c.chi;
  // χ slider: precomputed reconstructions for χ=1/2/4/8 (from this record or sibling records)
  const chiSrc = (k: Chi) => rec?.images?.mps_by_chi?.[String(k)] ?? (rec ? findRecord(res.records, { qubits: rec.qubits, ordering: rec.ordering, chi: k, eps: rec.eps_cx, image: rec.image })?.images?.mps : undefined);
  const repro = reproduceCommand(rec ?? { image: c.source === "camera" ? "camera" : c.uploadName ?? "upload", qubits: q, ordering: c.ordering, chi: c.chi, eps_cx: c.noise.epsCx, seed: null });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{run.id}</span><StatusPill status={run.status} /><SourceBadge source={run.source} /><span className="text-xs text-muted-foreground">{fmtDate(run.createdAt)}</span></div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setDraftConfig(c); navigate({ to: "/simulation" }); }}><Copy className="h-3.5 w-3.5" /> Duplicate configuration</Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={rec?.qasm_path ? -1 : 0}>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={!rec?.qasm_path} asChild={!!rec?.qasm_path}>
                  {rec?.qasm_path ? <a href={rec.qasm_path} download><Download className="h-3.5 w-3.5" /> Export circuit</a> : <><Download className="h-3.5 w-3.5" /> Export circuit</>}
                </Button>
              </span>
            </TooltipTrigger>
            {!rec?.qasm_path && <TooltipContent>QASM not provided for this run</TooltipContent>}
          </Tooltip>
          {run.source === "ui-preview" && <Button size="sm" variant="ghost" onClick={() => { removeSaved(run.id); navigate({ to: "/runs" }); }}>Delete</Button>}
        </div>
      </div>
      <h2 className="text-xl font-semibold tracking-tight">{run.name}</h2>
      {run.status === "failed" && rec?.failure_reason && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">Failed: {rec.failure_reason}</p>}
      {!rec && <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">Pending — no benchmark record exists for this configuration yet.</p>}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="space-y-5">
          <div className="rounded-2xl border bg-card p-5">
            <div className="grid grid-cols-3 gap-4">
              {([["Original", rec?.images?.original, "Original image not provided yet"], ["Exact loader", rec?.images?.exact, undefined], [`MPS χ=${chiNow}`, chiView ? chiSrc(chiView) : rec?.images?.mps, undefined]] as const).map(([t, src, empty]) => (
                <figure key={t}><RecordImage src={src} label={t} emptyText={empty} /><figcaption className="mt-2 text-xs font-medium">{t}</figcaption></figure>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
              <span className="text-xs text-muted-foreground">MPS reconstruction χ</span>
              {CHIS.map((k) => {
                const has = !!chiSrc(k);
                return <Button key={k} size="sm" variant={chiNow === k ? "secondary" : "ghost"} className="h-7 font-mono text-xs" disabled={!has && k !== c.chi} title={has ? undefined : "Image not provided yet"} onClick={() => setChiView(k)}>χ={k}</Button>;
              })}
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-5"><h3 className="mb-3 text-sm font-semibold">Circuit (schematic)</h3><CircuitDiagram qubits={Math.min(q, 6)} /></div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="text-sm font-semibold">Metrics</h3>
            <dl className="mt-3 space-y-2.5">
              {([
                ["Compiled CNOTs · exact", m.exactCnots, 0], ["Compiled CNOTs · MPS", m.mpsCnots, 0],
                ["Depth · exact", m.exactDepth, 0], ["Depth · MPS", m.mpsDepth, 0],
                ["1q gates · exact", m.exactOneQ, 0], ["1q gates · MPS", m.mpsOneQ, 0],
                ["Duration · exact (ns)", m.exactDuration, 0], ["Duration · MPS (ns)", m.mpsDuration, 0],
                ["Ideal fidelity · MPS", m.mpsIdealF, 3], ["Noisy fidelity · exact", m.exactNoisyF, 4], ["Noisy fidelity · MPS", m.mpsNoisyF, 4],
                ["Classical (Bhattacharyya) fidelity", m.classicalF, 4], ["PSNR", m.psnr, 2], ["SSIM", m.ssim, 4], ["Circuit vs contracted MPS", m.circuitCheck, 6],
              ] as const).map(([k, v, d]) => (
                <div key={k} className="flex items-center justify-between border-b pb-2 text-xs last:border-0"><dt className="text-muted-foreground">{k}</dt><dd><MetricValue m={v} digits={d} /></dd></div>
              ))}
            </dl>
          </div>
          <ShotsNote />
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="text-sm font-semibold">Provenance</h3>
            <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-2 text-xs">
              {[["Qiskit", rec?.qiskit_version ?? ENV.qiskit], ["Aer", rec?.aer_version ?? "not recorded"], ["Seed", rec?.seed ?? "not recorded"], ["Git commit", rec?.commit_hash ?? "not recorded"], ["Runner", rec?.runner ?? "run_all.py"], ["Noise", `εcx ${fmtEps(c.noise.epsCx)} · T1 ${c.noise.t1} µs · T2 ${c.noise.t2} µs`], ["Ordering", orderingLabel(c.ordering)], ["Basis", c.basis]].map(([k, v]) => (
                <div key={String(k)} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="break-all font-mono">{String(v)}</dd></div>
              ))}
            </dl>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-2.5 font-mono text-[11px]">{repro}</pre>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigator.clipboard.writeText(repro).then(() => toast.success("Reproduce command copied"))}><Copy className="h-3.5 w-3.5" /> Copy reproduce command</Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => download(`${run.id}.json`, JSON.stringify(rec ?? { id: run.id, status: "pending", config: c }, null, 2))}><FileJson className="h-3.5 w-3.5" /> Download JSON</Button>
            </div>
            {rec && <ProvenanceNote className="mt-3" />}
          </div>
        </section>
      </div>
    </div>
  );
}
