import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CircuitDiagram, MetricValue, PixelCanvas, ProvenanceNote, StatusPill, Tag } from "@/components/qj/primitives";
import { ENV, fmtEps, orderingLabel, qubitsFor, resolveMetrics } from "@/lib/data";
import { setDraftConfig } from "@/lib/draft";
import { illustrate, sampleImage } from "@/lib/imagery";
import { fmtDate, useRuns } from "@/lib/runs-store";

export const Route = createFileRoute("/_workbench/runs/$runId")({
  head: ({ params }) => ({
    meta: [
      { title: `Run ${params.runId} — Quantum JPEG` },
      { name: "description", content: "Run detail: image comparison, settings, fidelity and resource metrics, noise configuration and provenance." },
      { property: "og:title", content: `Run ${params.runId} — Quantum JPEG` },
      { property: "og:description", content: "Quantum JPEG run detail." },
    ],
  }),
  component: RunDetail,
});

function RunDetail() {
  const { runId } = Route.useParams();
  const runs = useRuns();
  const navigate = useNavigate();
  const run = runs.find((r) => r.id === runId);
  const imgs = useMemo(() => {
    if (!run) return null;
    const o = sampleImage(run.config.resolution, run.config.mode === "rgb");
    const m = resolveMetrics(run.config);
    return {
      o,
      e: illustrate(o, { fidelity: m.exactNoisyF.measured ? Math.max(0.04, m.exactNoisyF.value) : 0.3, blockiness: 1, seed: 4 }),
      p: illustrate(o, { fidelity: m.mpsNoisyF.measured ? m.mpsNoisyF.value : 0.8, blockiness: ({ 1: 8, 2: 4, 4: 2, 8: 1 } as const)[run.config.chi], seed: 6 }),
      m,
    };
  }, [run]);

  if (!run || !imgs) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-lg font-semibold">Run not found</p>
        <p className="mt-1 text-sm text-muted-foreground">No run with ID {runId} exists in this workspace.</p>
        <Button asChild className="mt-5" variant="outline"><Link to="/runs">Back to run history</Link></Button>
      </div>
    );
  }
  const c = run.config, m = imgs.m;
  const isRecord = run.kind === "benchmark";

  const exportCircuit = () => {
    const q = qubitsFor(c.resolution);
    const txt = `# Quantum JPEG — prototype export (schematic, not a validated circuit)\n# run ${run.id} · ${q} qubits · ${c.ordering} · chi=${c.chi}\nfrom qiskit import QuantumCircuit, transpile\nfrom qiskit.circuit.library import Isometry\n\nqc = QuantumCircuit(${q})\n# for each site, right to left: qc.append(Isometry(V_site, 0, 0), qubits)\n# transpile(qc, basis_gates=[${c.basis.split(",").map((g) => `"${g.trim()}"`).join(", ")}], optimization_level=${c.optimizationLevel})\n`;
    const url = URL.createObjectURL(new Blob([txt], { type: "text/x-python" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${run.id}_circuit.py`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Prototype circuit script exported");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{run.id}</span><StatusPill status={run.status} /><Tag tone={isRecord ? "measured" : "illustrative"}>{isRecord ? "Benchmark record · preliminary" : "Illustrative UI run · not a benchmark"}</Tag></div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{run.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{fmtDate(run.createdAt)}{run.note && ` · ${run.note}`}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => { setDraftConfig(c); navigate({ to: "/simulation" }); }}><Copy className="h-4 w-4" /> Duplicate configuration</Button>
          <Button className="gap-1.5" onClick={exportCircuit}><Download className="h-4 w-4" /> Export circuit</Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="rounded-2xl border bg-card p-5">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-semibold">Image comparison</h3><Tag tone="illustrative">Illustrative preview · not an Aer benchmark</Tag></div>
            <div className="grid grid-cols-3 gap-4">
              {[["Original", imgs.o], ["Exact loader", imgs.e], [`MPS loader · χ=${c.chi}`, imgs.p]].map(([l, im]) => (
                <figure key={l as string}><PixelCanvas img={im as never} label={l as string} /><figcaption className="mt-2 text-xs font-medium">{l as string}</figcaption></figure>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Circuit · sequential isometries</h3><span className="font-mono text-[11px] text-muted-foreground">schematic · {qubitsFor(c.resolution)} qubits</span></div>
            <CircuitDiagram qubits={qubitsFor(c.resolution)} chi={c.chi} />
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metrics</h3>
            <div className="mt-3 space-y-2.5 text-xs">
              {[
                ["CNOTs · exact", <MetricValue key="1" m={m.exactCnots} digits={0} />],
                ["CNOTs · MPS", <MetricValue key="2" m={m.mpsCnots} digits={0} />],
                ["Ideal F · MPS", <MetricValue key="3" m={m.mpsIdealF} digits={3} />],
                ["Noisy F · exact", <MetricValue key="4" m={m.exactNoisyF} />],
                ["Noisy F · MPS", <MetricValue key="5" m={m.mpsNoisyF} />],
                ["PSNR", <MetricValue key="6" m={m.psnr} />],
                ["SSIM", <MetricValue key="7" m={m.ssim} />],
              ].map(([l, v]) => <div key={l as string} className="flex items-center justify-between"><span className="text-muted-foreground">{l}</span>{v}</div>)}
            </div>
            {m.anyMeasured && <ProvenanceNote className="mt-3 border-t pt-3" />}
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Settings & noise</h3>
            <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
              {[
                ["Image", c.source === "camera" ? "camera_sample" : c.uploadName ?? "upload"],
                ["Mode", c.mode], ["Resolution", `${c.resolution}×${c.resolution}`], ["Ordering", orderingLabel(c.ordering)], ["χ", c.chi],
                ["εcx", fmtEps(c.noise.epsCx)], ["T1", `${c.noise.t1} µs`], ["T2", `${c.noise.t2} µs`], ["cx", `${c.noise.cxDuration} ns`], ["1q gate", `${c.noise.oneQDuration} ns`],
              ].map(([k, v]) => <div key={k as string} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-mono">{v}</dd></div>)}
            </dl>
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Provenance</h3>
            <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
              {[["Qiskit", ENV.qiskit], ["Aer", "pending"], ["Basis", c.basis], ["Opt. level", c.optimizationLevel], ["Source", isRecord ? "Earlier sandbox run" : "Prototype UI"]].map(([k, v]) => (
                <div key={k as string} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-mono">{v}</dd></div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
