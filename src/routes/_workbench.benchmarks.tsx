import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { FileText, GitCompare, Play } from "lucide-react";
import { RunTestDialog, type TestTarget } from "@/components/qj/run-test-dialog";
import { useLocalResults } from "@/lib/local-bench";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ProvenanceNote, Tag } from "@/components/qj/primitives";
import { CHIS, DEFAULT_NOISE, ENV, EPS_VALUES, ORDERINGS, findNoisyRecord, fmtEps, orderingLabel, type Chi, type Ordering } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_workbench/benchmarks")({
  head: () => ({
    meta: [
      { title: "Benchmark explorer — Quantum JPEG" },
      { name: "description", content: "Preliminary measured noisy fidelity and CNOT counts for exact and MPS loaders, with pending combinations clearly marked." },
      { property: "og:title", content: "Benchmark explorer — Quantum JPEG" },
      { property: "og:description", content: "Noisy fidelity vs compiled CNOT count, with full provenance." },
    ],
  }),
  component: Benchmarks,
});

interface Row {
  key: string;
  qubits: 8 | 10;
  eps: number;
  ordering: Ordering;
  chi: Chi;
  exact?: { fidelity: number; cnots: number } | undefined;
  mps?: { fidelity: number; cnots: number } | undefined;
  local?: { image: string; createdAt: string };
}

const ALL: Row[] = [];
for (const qubits of [8, 10] as const)
  for (const eps of EPS_VALUES)
    for (const o of ORDERINGS)
      for (const chi of CHIS) {
        const rec = o.value === "hilbert" ? findNoisyRecord(qubits, eps) : undefined;
        ALL.push({ key: `${qubits}-${eps}-${o.value}-${chi}`, qubits, eps, ordering: o.value, chi, exact: rec?.exact, mps: rec?.mps[chi] });
      }

function F({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function Benchmarks() {
  const [size, setSize] = useState("all");
  const [eps, setEps] = useState("all");
  const [ord, setOrd] = useState("all");
  const [chi, setChi] = useState("all");
  const [onlyMeasured, setOnlyMeasured] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [compare, setCompare] = useState(false);
  const [prov, setProv] = useState<Row | null>(null);
  const [test, setTest] = useState<TestTarget | null>(null);
  const localRes = useLocalResults();
  const allRows = useMemo(() => ALL.map((r) => { const l = !r.mps ? localRes[r.key] : undefined; return l ? { ...r, exact: l.exact, mps: l.mps, local: { image: l.image, createdAt: l.createdAt } } : r; }), [localRes]);

  const rows = useMemo(
    () => allRows.filter((r) => (size === "all" || String(r.qubits) === size) && (eps === "all" || String(r.eps) === eps) && (ord === "all" || r.ordering === ord) && (chi === "all" || String(r.chi) === chi) && (!onlyMeasured || r.mps)),
    [allRows, size, eps, ord, chi, onlyMeasured],
  );
  const measured = rows.filter((r) => r.mps);

  const points = useMemo(() => {
    const exactSeen = new Set<string>();
    const ex: object[] = [], mp: object[] = [];
    measured.forEach((r) => {
      const cfg = `${r.qubits}q · εcx ${fmtEps(r.eps)}`;
      if (!exactSeen.has(cfg)) { exactSeen.add(cfg); ex.push({ x: r.exact!.cnots, y: r.exact!.fidelity, label: `Exact · ${cfg}`, cfg }); }
      if (r.mps!.cnots > 0) mp.push({ x: r.mps!.cnots, y: r.mps!.fidelity, label: `MPS χ=${r.chi} · ${orderingLabel(r.ordering)} · ${cfg}${r.local ? " · tested" : ""}`, cfg });
    });
    return { ex, mp };
  }, [measured]);

  const selected = allRows.filter((r) => sel.includes(r.key));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card px-5 py-4">
        <F label="Image size" value={size} onChange={setSize} options={[["all", "All sizes"], ["8", "16×16 · 8 qubits"], ["10", "32×32 · 10 qubits"]]} />
        <F label="Noise probability εcx" value={eps} onChange={setEps} options={[["all", "All"], ...EPS_VALUES.map((e) => [String(e), fmtEps(e)] as [string, string])]} />
        <F label="Ordering" value={ord} onChange={setOrd} options={[["all", "All orderings"], ...ORDERINGS.map((o) => [o.value, o.label] as [string, string])]} />
        <F label="Bond dimension" value={chi} onChange={setChi} options={[["all", "All χ"], ...CHIS.map((c) => [String(c), `χ=${c}`] as [string, string])]} />
        <label className="flex items-center gap-2 pb-1.5 text-xs"><Checkbox checked={onlyMeasured} onCheckedChange={(v) => setOnlyMeasured(!!v)} /> Measured only</label>
        <Button className="ml-auto gap-1.5" size="sm" disabled={sel.length < 2} onClick={() => setCompare(true)}><GitCompare className="h-3.5 w-3.5" /> Compare selected ({sel.length})</Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center justify-between px-5 py-3.5">
            <p className="text-sm font-semibold">Results <span className="ml-1 font-normal text-muted-foreground">{measured.length} measured · {rows.length - measured.length} pending</span></p>
          </div>
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-2" />
                  {["Qubits", "εcx", "Ordering", "χ", "Exact F", "Exact CNOTs", "MPS F", "MPS CNOTs", "Status", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className={cn("border-t", r.mps ? "hover:bg-muted/30" : "text-muted-foreground")}>
                    <td className="px-4 py-2"><Checkbox aria-label="Select row" checked={sel.includes(r.key)} onCheckedChange={(v) => setSel((s) => (v ? [...s, r.key] : s.filter((k) => k !== r.key)))} /></td>
                    <td className="px-3 py-2 font-mono">{r.qubits}</td>
                    <td className="px-3 py-2 font-mono">{fmtEps(r.eps)}</td>
                    <td className="px-3 py-2">{orderingLabel(r.ordering)}</td>
                    <td className="px-3 py-2 font-mono">{r.chi}</td>
                    <td className="px-3 py-2 font-mono">{r.exact ? r.exact.fidelity.toFixed(4) : <span className="text-warning">Pending</span>}</td>
                    <td className="px-3 py-2 font-mono">{r.exact ? r.exact.cnots : "—"}</td>
                    <td className="px-3 py-2 font-mono font-medium text-primary">{r.mps ? r.mps.fidelity.toFixed(4) : <span className="font-normal text-warning">Pending</span>}</td>
                    <td className="px-3 py-2 font-mono">{r.mps ? r.mps.cnots : "—"}</td>
                    <td className="px-3 py-2">{r.local ? <Tag tone="cyan">Tested</Tag> : r.mps ? <Tag tone="measured">Measured</Tag> : <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-[11px]" onClick={() => setTest(r)}><Play className="h-3 w-3" /> Run test</Button>}</td>
                    <td className="px-3 py-2"><button aria-label="Provenance" onClick={() => setProv(r)} className="text-muted-foreground hover:text-foreground"><FileText className="h-4 w-4" /></button></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={11} className="px-5 py-14 text-center text-sm text-muted-foreground">No combinations match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold">Noisy fidelity vs. compiled CNOTs</p><Tag tone="measured">Measured only</Tag></div>
            <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rotate-45 bg-chart-3" /> Exact loader</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> MPS loader</span>
            </div>
            <div className="mt-3 h-72">
              {measured.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 8, bottom: 20, left: -8 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="x" scale="log" domain={[10, 2000]} ticks={[10, 30, 100, 300, 1000]} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} label={{ value: "Compiled CNOTs (log)", position: "bottom", fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                    <YAxis type="number" dataKey="y" domain={[0, 1]} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                    <ZAxis range={[70, 70]} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ payload }) => {
                        const p = payload?.[0]?.payload as { label: string; x: number; y: number } | undefined;
                        if (!p) return null;
                        return (
                          <div className="rounded-lg border bg-popover p-3 text-xs shadow-md">
                            <p className="font-medium">{p.label}</p>
                            <p className="mt-1 font-mono">F = {p.y.toFixed(4)} · {p.x} CNOTs</p>
                            <p className="mt-1 text-muted-foreground">basis rz,sx,x,cx · opt 1</p>
                          </div>
                        );
                      }}
                    />
                    <Scatter data={points.ex} fill="var(--color-chart-3)" shape="diamond" />
                    <Scatter data={points.mp} fill="var(--color-primary)" />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">No measured points for this filter — all combinations Pending.</div>
              )}
            </div>
            <ProvenanceNote className="mt-2" />
          </div>
          <div className="rounded-2xl border bg-card p-5 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Reading this data</p>
            <p className="mt-1.5">Noisy fidelity is ⟨ψ_original|ρ|ψ_original⟩ for both loaders. Values are a single-image preliminary dataset, not a complete benchmark. PSNR, SSIM, χ=1 noisy fidelity, row-major / Z-order, εcx 0.1% and 1.5%, and multi-image aggregates are pending.</p>
          </div>
        </section>
      </div>

      <Sheet open={!!prov} onOpenChange={(o) => !o && setProv(null)}>
        <SheetContent className="w-[420px] sm:max-w-[420px]">
          <SheetHeader>
            <SheetTitle>Provenance</SheetTitle>
            <SheetDescription>{prov?.local ? "Test run in your browser" : prov?.mps ? "Preliminary measured record" : "Pending — benchmark not run"}</SheetDescription>
          </SheetHeader>
          {prov && (
            <dl className="mt-6 space-y-3 px-4 text-sm">
              {[
                ["Status", prov.local ? `Tested · ${new Date(prov.local.createdAt).toLocaleString()}` : prov.mps ? "Measured · earlier sandbox run" : "Pending"],
                ...(prov.local ? [["Test image", prov.local.image]] : []),
                ["Qiskit version", ENV.qiskit],
                ["Aer version", ENV.aer],
                ["Simulator", ENV.method],
                ["Image", prov.local ? prov.local.image : ENV.image],
                ["Resolution", prov.qubits === 10 ? "32×32 · 10 qubits" : "16×16 · 8 qubits"],
                ["Ordering", orderingLabel(prov.ordering)],
                ["Bond dimension", `χ=${prov.chi}`],
                ["Noise model", `depol(εcx=${fmtEps(prov.eps)}, 2) on cx · depol(εcx/10, 1) on 1q · T1 ${DEFAULT_NOISE.t1} µs · T2 ${DEFAULT_NOISE.t2} µs · cx ${DEFAULT_NOISE.cxDuration} ns · 1q ${DEFAULT_NOISE.oneQDuration} ns`],
                ["Transpilation basis", ENV.basis],
                ["Optimization level", String(ENV.optimizationLevel)],
                ["PSNR / SSIM", "Pending"],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[130px_1fr] gap-2 border-b pb-3"><dt className="text-muted-foreground">{k}</dt><dd className="font-mono text-xs leading-relaxed">{v}</dd></div>
              ))}
            </dl>
          )}
        </SheetContent>
      </Sheet>

      <RunTestDialog target={test} onClose={() => setTest(null)} />

      <Dialog open={compare} onOpenChange={setCompare}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Compare selected runs</DialogTitle>
            <DialogDescription>Pending rows are shown without values.</DialogDescription>
          </DialogHeader>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground"><tr>{["Configuration", "Exact F (CNOTs)", "MPS F (CNOTs)", "Status"].map((h) => <th key={h} className="py-2 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {selected.map((r) => (
                <tr key={r.key} className="border-t">
                  <td className="py-2 font-mono text-xs">{r.qubits}q · {fmtEps(r.eps)} · {orderingLabel(r.ordering)} · χ={r.chi}</td>
                  <td className="py-2 font-mono">{r.exact ? `${r.exact.fidelity.toFixed(4)} (${r.exact.cnots})` : <span className="text-warning">Pending</span>}</td>
                  <td className="py-2 font-mono text-primary">{r.mps ? `${r.mps.fidelity.toFixed(4)} (${r.mps.cnots})` : <span className="text-warning">Pending</span>}</td>
                  <td className="py-2">{r.mps ? <Tag tone="measured">Measured</Tag> : <Tag tone="pending">Pending</Tag>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ProvenanceNote />
        </DialogContent>
      </Dialog>
    </div>
  );
}
