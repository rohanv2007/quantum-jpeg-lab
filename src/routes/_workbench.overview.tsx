import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowRight, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PixelCanvas, ProvenanceNote, StatusPill, Tag } from "@/components/qj/primitives";
import { fmtEps, orderingLabel } from "@/lib/data";
import { illustrate, sampleImage } from "@/lib/imagery";
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
  const runs = useRuns();
  const orig = useMemo(() => sampleImage(32), []);
  const exact = useMemo(() => illustrate(orig, { fidelity: 0.1, blockiness: 1, seed: 2 }), [orig]);
  const mps = useMemo(() => illustrate(orig, { fidelity: 0.85, blockiness: 4, seed: 9 }), [orig]);
  const thumbs = useMemo(() => ({ 16: sampleImage(16), 32: sampleImage(32) }), []);

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
          <p className="mt-1.5 text-sm text-muted-foreground">At εcx = 0.3%, χ=2 retained a noisy fidelity of 0.8464 with 25 CNOTs; the exact loader retained 0.0056 with 1,013.</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[["Original", orig], ["Exact", exact], ["MPS χ=2", mps]].map(([l, im]) => (
              <figure key={l as string}><PixelCanvas img={im as never} label={l as string} /><figcaption className="mt-1.5 text-xs text-muted-foreground">{l as string}</figcaption></figure>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Tag tone="illustrative">Images: illustrative preview · not an Aer benchmark</Tag>
            <Link to="/runs/$runId" params={{ runId: "BR-1003" }} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">Open run <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </section>

        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[["0.8464", "Noisy F · χ=2, n=10, 0.3%"], ["25 / 1013", "CNOTs · χ=2 vs exact"], ["0.951", "Ideal F · χ=2, n=10"], ["4", "Noisy record groups"]].map(([v, l]) => (
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
        <table className="w-full text-sm">
          <thead className="border-y bg-muted/40 text-xs text-muted-foreground">
            <tr>{["Image", "Ordering", "χ", "Noise", "Status", "Timestamp"].map((h) => <th key={h} className="px-6 py-2 text-left font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {runs.slice(0, 5).map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-6 py-2.5">
                  <Link to="/runs/$runId" params={{ runId: r.id }} className="flex items-center gap-3">
                    <PixelCanvas img={thumbs[r.config.resolution]} className="h-8 w-8 rounded" label="" />
                    <span><span className="block font-medium">{r.config.source === "camera" ? "camera_sample" : r.config.uploadName}</span><span className="font-mono text-[11px] text-muted-foreground">{r.id}</span></span>
                  </Link>
                </td>
                <td className="px-6 py-2.5 text-muted-foreground">{orderingLabel(r.config.ordering)}</td>
                <td className="px-6 py-2.5 font-mono">{r.config.chi}</td>
                <td className="px-6 py-2.5 font-mono">{fmtEps(r.config.noise.epsCx)}</td>
                <td className="px-6 py-2.5"><StatusPill status={r.status} /></td>
                <td className="px-6 py-2.5 text-xs text-muted-foreground">{fmtDate(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
