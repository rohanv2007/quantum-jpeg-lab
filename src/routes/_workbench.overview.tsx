import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowRight, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProvenanceNote, RecordImage, SourceBadge, StatusPill, Tag } from "@/components/qj/primitives";
import { findRecord, num, useResults } from "@/lib/results";
import { fmtEps, orderingLabel } from "@/lib/data";
import { fmtDate, useRuns } from "@/lib/runs-store";

export const Route = createFileRoute("/_workbench/overview")({
  head: () => ({
    meta: [
      { title: "Overview — Quantum JPEG" },
      { name: "description", content: "Resume image-state preparation work: recent runs, featured comparison and measured vs pending status." },
      { property: "og:title", content: "Overview — Quantum JPEG" },
      { property: "og:description", content: "Compare exact and MPS loaders under simulated noise." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { runs } = useRuns();
  const res = useResults();
  const feat = findRecord(res.records, { qubits: 10, ordering: "hilbert", chi: 2, eps: 0.003, image: "camera" });
  const ideal = findRecord(res.records, { qubits: 10, ordering: "hilbert", chi: 2, eps: 0, image: "camera" });
  const v = (x?: number | null, d = 4) => (num(x) ? x.toFixed(d) : "Pending");
  const groups = new Set(res.records.filter((r) => r.eps_cx > 0).map((r) => `${r.qubits}-${r.eps_cx}`)).size;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className="font-display text-4xl tracking-tight">Explore image-state preparation</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Compare exact state preparation with truncated MPS loaders under simulated Aer noise, and see which results are measured and which are pending.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild><Link to="/simulation">Start a simulation</Link></Button>
          <Button asChild variant="outline"><Link to="/benchmarks">View benchmark results</Link></Button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between"><Tag tone="cyan">Featured project</Tag><span className="font-mono text-[11px] text-muted-foreground">camera · 32×32 · Hilbert</span></div>
          <h3 className="mt-4 text-xl font-semibold tracking-tight">Low-depth MPS loading vs. exact initializer</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">At εcx = 0.3%, χ=2 retained a noisy fidelity of {v(feat?.noisy_fidelity_mps)} with {feat?.mps_cnots ?? "Pending"} CNOTs; the exact loader retained {v(feat?.noisy_fidelity_exact)} with {feat?.exact_cnots ?? "Pending"}.</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {([["Original", feat?.images?.original], ["Exact", feat?.images?.exact], ["MPS χ=2", feat?.images?.mps]] as const).map(([l, src]) => (
              <figure key={l}><RecordImage src={src} label={l} /><figcaption className="mt-1.5 text-xs text-muted-foreground">{l}</figcaption></figure>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Tag tone="muted">Values from results.json</Tag>
            <Link to="/runs/$runId" params={{ runId: feat?.id ?? "BR-1001" }} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">Open run <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </section>

        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[[v(feat?.noisy_fidelity_mps), "Noisy F · χ=2, n=10, 0.3%"], [`${feat?.mps_cnots ?? "—"} / ${feat?.exact_cnots ?? "—"}`, "CNOTs · χ=2 vs exact"], [v(ideal?.ideal_fidelity_mps, 3), "Ideal F · χ=2, n=10"], [String(groups), "Noisy record groups"]].map(([v, l]) => (
              <div key={l} className="rounded-xl border bg-card p-4"><p className="font-mono text-xl tabular">{v}</p><p className="mt-1 text-[11px] text-muted-foreground">{l}</p></div>
            ))}
          </div>
          <ProvenanceNote />
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="text-sm font-semibold">What's measured / what's pending</h3>
            <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
              <ul className="space-y-1.5">{["Noisy F · χ=2/4/8, exact", "εcx 0.3%, 0.8%", "8 & 10 qubits · Hilbert", "Noiseless χ=1–8, n=10"].map((t) => <li key={t} className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-success" />{t}</li>)}</ul>
              <ul className="space-y-1.5 text-muted-foreground">{["χ=1 noisy", "Row-major, Z-order", "εcx 0.1%, 1.5%", "PSNR, SSIM", "Multi-image"].map((t) => <li key={t} className="flex gap-1.5"><Clock className="h-3.5 w-3.5 shrink-0 text-warning" />{t}</li>)}</ul>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between px-6 py-4"><h3 className="text-sm font-semibold">Recent runs</h3><Link to="/runs" className="text-xs font-medium text-primary hover:underline">View all</Link></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
          <thead className="border-y bg-muted/40 text-xs text-muted-foreground">
            <tr>{["Image", "Ordering", "χ", "Noise", "Status", "Timestamp"].map((h) => <th key={h} className="px-6 py-2 text-left font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-6 py-2.5">
                  <Link to="/runs/$runId" params={{ runId: r.id }} className="flex items-center gap-3">
                                        <span><span className="block font-medium">{r.config.source === "camera" ? "camera_sample" : r.config.uploadName}</span><span className="font-mono text-[11px] text-muted-foreground">{r.id}</span></span>
                  </Link>
                </td>
                <td className="px-6 py-2.5 text-muted-foreground">{orderingLabel(r.config.ordering)}</td>
                <td className="px-6 py-2.5 font-mono">{r.config.chi}</td>
                <td className="px-6 py-2.5 font-mono">{fmtEps(r.config.noise.epsCx)}</td>
                <td className="px-6 py-2.5"><span className="flex gap-1.5"><StatusPill status={r.status} /><SourceBadge source={r.source} /></span></td>
                <td className="px-6 py-2.5 text-xs text-muted-foreground">{fmtDate(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {!runs.length && <p className="px-6 py-10 text-center text-sm text-muted-foreground">No runs yet.</p>}
      </section>
    </div>
  );
}
