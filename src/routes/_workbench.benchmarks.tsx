import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { Download, FileText, LayoutGrid, Play, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChartCard, ProvenanceNote, StatusPill } from "@/components/qj/primitives";
import { CHIS, DEFAULT_CONFIG, DEFAULT_NOISE, ENV, EPS_VALUES, ORDERINGS, fmtEps, orderingLabel, type Chi, type Ordering } from "@/lib/data";
import { download, findRecord, num, recordKey, toCsv, useResults, type ResultRecord } from "@/lib/results";
import { savePendingConfig, useRuns } from "@/lib/runs-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_workbench/benchmarks")({
  head: () => ({
    meta: [
      { title: "Benchmark explorer — Quantum JPEG" },
      { name: "description", content: "Coverage grid, Pareto chart, optimal-χ heatmap and scaling of exact vs MPS loaders, all from the recorded results file." },
      { property: "og:title", content: "Benchmark explorer — Quantum JPEG" },
      { property: "og:description", content: "Noisy fidelity vs compiled CNOT count, with full provenance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Benchmarks,
});

type Cell = { qubits: number; eps: number; ordering: Ordering; chi: Chi; rec?: ResultRecord; saved: boolean };
const QUBITS = [8, 10];
const SHAPES = { 1: "triangle", 2: "circle", 4: "square", 8: "diamond" } as const;
const ORD_COLOR: Record<Ordering, string> = { hilbert: "var(--color-primary)", "z-order": "var(--color-chart-2)", "row-major": "var(--color-chart-4)" };
const PAGE = 25;
const f4 = (v?: number | null) => (num(v) ? v.toFixed(4) : "Pending");

function F({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-40 text-xs" aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function Benchmarks() {
  const res = useResults();
  const { runs } = useRuns();
  const [view, setView] = useState<"grid" | "table">("grid");
  const [size, setSize] = useState("all");
  const [eps, setEps] = useState("all");
  const [ord, setOrd] = useState("all");
  const [chi, setChi] = useState("all");
  const [onlyMeasured, setOnlyMeasured] = useState(true);
  const [page, setPage] = useState(0);
  const [prov, setProv] = useState<Cell | null>(null);
  const [pick, setPick] = useState<Cell | null>(null);

  const savedKeys = useMemo(() => new Set(runs.filter((r) => r.source === "ui-preview").map((r) => recordKey({ qubits: r.config.resolution === 16 ? 8 : 10, ordering: r.config.ordering, chi: r.config.chi, eps: r.config.noise.epsCx }))), [runs]);

  const cells = useMemo(() => {
    const out: Cell[] = [];
    for (const qubits of QUBITS) for (const e of EPS_VALUES) for (const o of ORDERINGS) for (const c of CHIS) {
      const rec = findRecord(res.records, { qubits, ordering: o.value, chi: c, eps: e, image: "camera" });
      out.push({ qubits, eps: e, ordering: o.value, chi: c, rec, saved: savedKeys.has(recordKey({ qubits, ordering: o.value, chi: c, eps: e })) });
    }
    return out;
  }, [res.records, savedKeys]);
  const measuredRec = (c: Cell) => c.rec && c.rec.status === "complete" && num(c.rec.noisy_fidelity_mps);

  const filtered = useMemo(
    () => cells.filter((r) => (size === "all" || String(r.qubits) === size) && (eps === "all" || String(r.eps) === eps) && (ord === "all" || r.ordering === ord) && (chi === "all" || String(r.chi) === chi)),
    [cells, size, eps, ord, chi],
  );
  const tableRows = onlyMeasured ? filtered.filter(measuredRec) : filtered;
  const pageRows = tableRows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(tableRows.length / PAGE));

  const exportRows = () => filtered.map((c) => c.rec ?? { qubits: c.qubits, eps_cx: c.eps, ordering: c.ordering, chi: c.chi, status: "pending" });
  const runThis = (c: Cell) => {
    const r = savePendingConfig({ ...DEFAULT_CONFIG, resolution: c.qubits === 8 ? 16 : 32, ordering: c.ordering, chi: c.chi, noise: { ...DEFAULT_NOISE, epsCx: c.eps } });
    toast.success("Saved as pending", { description: `${r.id} added to Run history. No values are shown until a benchmark record exists.` });
    setPick(null);
  };

  // ---- chart data (measured only, from records) ----
  const noisy = res.records.filter((r) => r.status === "complete" && r.eps_cx > 0 && num(r.noisy_fidelity_mps) && num(r.mps_cnots));
  const pareto = useMemo(() => {
    const series: Record<string, { name: string; ordering: Ordering; eps: number; dash: string; pts: object[] }> = {};
    noisy.forEach((r) => {
      const k = `${r.ordering}-${r.eps_cx}`;
      series[k] ??= { name: `${orderingLabel(r.ordering)} · εcx ${fmtEps(r.eps_cx)}`, ordering: r.ordering, eps: r.eps_cx, dash: r.eps_cx > 0.005 ? "5 4" : "", pts: [] };
      if (r.mps_cnots! > 0) series[k]!.pts.push({ x: r.mps_cnots, y: r.noisy_fidelity_mps, chi: r.chi, r });
    });
    const exact = new Map<string, object>();
    noisy.forEach((r) => { if (num(r.exact_cnots) && num(r.noisy_fidelity_exact)) exact.set(`${r.qubits}-${r.eps_cx}`, { x: r.exact_cnots, y: r.noisy_fidelity_exact, label: `Exact · ${r.qubits}q · εcx ${fmtEps(r.eps_cx)}`, r }); });
    return { series: Object.values(series), exact: [...exact.values()] };
  }, [res.records]);

  const heat = useMemo(() => EPS_VALUES.map((e) => QUBITS.map((q) => {
    const ms = noisy.filter((r) => r.qubits === q && Math.abs(r.eps_cx - e) < 1e-9);
    if (new Set(ms.map((r) => r.chi)).size < 2) return { e, q, best: null as null | ResultRecord, n: ms.length };
    return { e, q, best: ms.reduce((a, b) => (b.noisy_fidelity_mps! > a.noisy_fidelity_mps! ? b : a)), n: ms.length };
  })), [res.records]);

  const scaling = useMemo(() => {
    const byQ = new Map<number, Record<string, number>>();
    res.records.filter((r) => r.status === "complete").forEach((r) => {
      const row = byQ.get(r.qubits) ?? { qubits: r.qubits };
      if (num(r.mps_cnots) && r.mps_cnots > 0) row[`χ=${r.chi}`] = r.mps_cnots;
      if (num(r.exact_cnots)) row.Exact = r.exact_cnots;
      byQ.set(r.qubits, row);
    });
    return [...byQ.values()].sort((a, b) => a.qubits! - b.qubits!);
  }, [res.records]);
  const scaleKeys = ["Exact", ...CHIS.filter((c) => c > 1).map((c) => `χ=${c}`)].filter((k) => scaling.some((r) => r[k]));

  if (res.status === "loading") return <div className="mx-auto max-w-7xl space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {res.status === "error" && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">Could not load results.json ({res.error}). All values are shown as Pending.</p>}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card px-5 py-4">
        <F label="Image size" value={size} onChange={(v) => { setSize(v); setPage(0); }} options={[["all", "All sizes"], ["8", "16×16 · 8 qubits"], ["10", "32×32 · 10 qubits"]]} />
        <F label="Noise probability εcx" value={eps} onChange={(v) => { setEps(v); setPage(0); }} options={[["all", "All"], ...EPS_VALUES.map((e) => [String(e), fmtEps(e)] as [string, string])]} />
        <F label="Ordering" value={ord} onChange={(v) => { setOrd(v); setPage(0); }} options={[["all", "All orderings"], ...ORDERINGS.map((o) => [o.value, o.label] as [string, string])]} />
        <F label="Bond dimension" value={chi} onChange={(v) => { setChi(v); setPage(0); }} options={[["all", "All χ"], ...CHIS.map((c) => [String(c), `χ=${c}`] as [string, string])]} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => download("quantum-jpeg-benchmarks.csv", toCsv(exportRows() as Record<string, unknown>[]), "text/csv")}><Download className="h-3.5 w-3.5" /> CSV</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => download("quantum-jpeg-benchmarks.json", JSON.stringify(exportRows(), null, 2))}><Download className="h-3.5 w-3.5" /> JSON</Button>
          <div className="flex rounded-lg bg-muted p-1" role="tablist" aria-label="View">
            {([["grid", "Coverage", LayoutGrid], ["table", "Table view", Table2]] as const).map(([v, l, I]) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium", view === v ? "bg-card shadow-sm" : "text-muted-foreground")}><I className="h-3.5 w-3.5" />{l}</button>
            ))}
          </div>
        </div>
      </div>

      {view === "grid" ? (
        <section className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Coverage <span className="ml-1 font-normal text-muted-foreground">{filtered.filter(measuredRec).length} measured · {filtered.filter((c) => !measuredRec(c)).length} pending</span></p>
            <p className="text-[11px] text-muted-foreground">Click a pending cell to save it as a configuration to run.</p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-1 text-xs">
              <thead><tr><th className="text-left font-medium text-muted-foreground">Ordering · χ</th>{QUBITS.filter((q) => size === "all" || String(q) === size).flatMap((q) => EPS_VALUES.filter((e) => eps === "all" || String(e) === eps).map((e) => <th key={`${q}-${e}`} className="font-medium text-muted-foreground">{q}q · {fmtEps(e)}</th>))}</tr></thead>
              <tbody>
                {ORDERINGS.filter((o) => ord === "all" || o.value === ord).flatMap((o) => CHIS.filter((c) => chi === "all" || String(c) === chi).map((c) => (
                  <tr key={`${o.value}-${c}`}>
                    <td className="whitespace-nowrap pr-2 text-muted-foreground">{o.label} · χ={c}</td>
                    {filtered.filter((x) => x.ordering === o.value && x.chi === c).map((x) => {
                      const st = x.rec?.status === "failed" ? "failed" : measuredRec(x) ? "measured" : "pending";
                      return (
                        <td key={`${x.qubits}-${x.eps}`}>
                          <button onClick={() => (st === "measured" || st === "failed" ? setProv(x) : setPick(x))} className={cn("w-full rounded-md px-2 py-2 text-center font-mono text-[11px]", st === "measured" ? "bg-success-soft text-success" : st === "failed" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground hover:bg-warning-soft hover:text-warning")} aria-label={`${o.label} χ=${c} ${x.qubits} qubits εcx ${fmtEps(x.eps)}: ${st}`}>
                            {st === "measured" ? `✓ ${x.rec!.noisy_fidelity_mps!.toFixed(3)}` : st === "failed" ? "✕ Failed" : x.saved ? "◷ Saved" : "◷ Pending"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
          {pick && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-soft px-4 py-3">
              <p className="text-sm"><span className="font-medium text-warning">Pending</span> · {pick.qubits}q · εcx {fmtEps(pick.eps)} · {orderingLabel(pick.ordering)} · χ={pick.chi}</p>
              <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setPick(null)}>Cancel</Button><Button size="sm" className="gap-1.5" onClick={() => runThis(pick)}><Play className="h-3.5 w-3.5" /> Run this config</Button></div>
            </div>
          )}
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center justify-between px-5 py-3.5">
            <p className="text-sm font-semibold">Results <span className="ml-1 font-normal text-muted-foreground">{tableRows.length} rows</span></p>
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={onlyMeasured} onCheckedChange={(v) => { setOnlyMeasured(!!v); setPage(0); }} /> Measured only</label>
          </div>
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-[11px] text-muted-foreground">
                <tr>{["Qubits", "εcx", "Ordering", "χ", "Exact F", "Exact CNOTs", "MPS F", "MPS CNOTs", "Status", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={recordKey(r)} className={cn("border-t", !measuredRec(r) && "text-muted-foreground")}>
                    <td className="px-3 py-2 font-mono">{r.qubits}</td>
                    <td className="px-3 py-2 font-mono">{fmtEps(r.eps)}</td>
                    <td className="px-3 py-2">{orderingLabel(r.ordering)}</td>
                    <td className="px-3 py-2 font-mono">{r.chi}</td>
                    <td className="px-3 py-2 font-mono">{f4(r.rec?.noisy_fidelity_exact)}</td>
                    <td className="px-3 py-2 font-mono">{r.rec?.exact_cnots ?? "—"}</td>
                    <td className="px-3 py-2 font-mono font-medium text-primary">{f4(r.rec?.noisy_fidelity_mps)}</td>
                    <td className="px-3 py-2 font-mono">{r.rec?.mps_cnots ?? "—"}</td>
                    <td className="px-3 py-2">{measuredRec(r) ? <StatusPill status="complete" /> : r.rec?.status === "failed" ? <StatusPill status="failed" /> : <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-[11px]" onClick={() => runThis(r)}><Play className="h-3 w-3" /> {r.saved ? "Saved" : "Run this config"}</Button>}</td>
                    <td className="px-3 py-2"><button aria-label="Provenance" onClick={() => setProv(r)} className="text-muted-foreground hover:text-foreground"><FileText className="h-4 w-4" /></button></td>
                  </tr>
                ))}
                {pageRows.length === 0 && <tr><td colSpan={10} className="px-5 py-14 text-center text-sm text-muted-foreground">No rows match. Untick “Measured only” to see pending combinations.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 border-t px-5 py-2.5 text-xs">
            <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Pareto · noisy fidelity vs compiled CNOTs" desc="Colour = ordering · shape = χ (▲1 ●2 ■4 ◆8) · dashed = higher noise · grey crosses = exact loader." chartLabel="Scatter of noisy fidelity against compiled CNOT count"
          table={{ head: ["Loader", "Qubits", "εcx", "Ordering", "χ", "CNOTs", "Noisy F"], rows: noisy.flatMap((r) => [["MPS", r.qubits, fmtEps(r.eps_cx), orderingLabel(r.ordering), r.chi, r.mps_cnots!, r.noisy_fidelity_mps!.toFixed(4)]]) }}>
          <div className="h-72">
            {noisy.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 8, bottom: 20, left: -8 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" scale="log" domain={[10, 2000]} ticks={[10, 30, 100, 300, 1000]} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} label={{ value: "Compiled CNOTs (log)", position: "bottom", fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                  <YAxis type="number" dataKey="y" domain={[0, 1]} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                  <ZAxis range={[60, 60]} />
                  <Tooltip content={({ payload }) => {
                    const r = (payload?.[0]?.payload as { r?: ResultRecord } | undefined)?.r;
                    if (!r) return null;
                    return <div className="rounded-lg border bg-popover p-3 font-mono text-[11px] shadow-md">{[["id", r.id], ["qubits", r.qubits], ["ordering", r.ordering], ["χ", r.chi], ["εcx", fmtEps(r.eps_cx)], ["MPS F", f4(r.noisy_fidelity_mps)], ["MPS CNOTs", r.mps_cnots], ["Exact F", f4(r.noisy_fidelity_exact)], ["Exact CNOTs", r.exact_cnots]].map(([k, v]) => <p key={String(k)}><span className="text-muted-foreground">{k}</span> {String(v ?? "Pending")}</p>)}</div>;
                  }} />
                  {pareto.series.map((s) => CHIS.map((c) => {
                    const pts = (s.pts as { chi: number }[]).filter((p) => p.chi === c);
                    return pts.length ? <Scatter key={`${s.name}-${c}`} data={pts} fill={ORD_COLOR[s.ordering]} shape={SHAPES[c]} line={false} fillOpacity={s.dash ? 0.55 : 1} /> : null;
                  }))}
                  {pareto.series.map((s) => <Scatter key={`l-${s.name}`} data={[...s.pts].sort((a, b) => (a as { x: number }).x - (b as { x: number }).x)} fill="none" line={{ stroke: ORD_COLOR[s.ordering], strokeDasharray: s.dash }} shape={() => <g />} />)}
                  <Scatter data={pareto.exact} fill="var(--color-muted-foreground)" shape="cross" />
                </ScatterChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </div>
        </ChartCard>

        <ChartCard title="Optimal χ by noise and size" desc="χ with the highest measured noisy fidelity. Cells with fewer than 2 measured χ say “Insufficient data”." chartLabel="Heatmap of best bond dimension"
          table={{ head: ["εcx", "Qubits", "Best χ", "Noisy F"], rows: heat.flat().map((h) => [fmtEps(h.e), h.q, h.best ? h.best.chi : "Insufficient data", h.best ? h.best.noisy_fidelity_mps!.toFixed(4) : "—"]) }}>
          <table className="w-full border-separate border-spacing-1 text-xs">
            <thead><tr><th className="text-left font-medium text-muted-foreground">εcx</th>{QUBITS.map((q) => <th key={q} className="font-medium text-muted-foreground">{q} qubits</th>)}</tr></thead>
            <tbody>{heat.map((row) => (
              <tr key={row[0]!.e}><td className="font-mono text-muted-foreground">{fmtEps(row[0]!.e)}</td>
                {row.map((h) => <td key={h.q} className={cn("rounded-md px-2 py-4 text-center", h.best ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground")}>{h.best ? <><span className="block font-mono text-base font-semibold">χ={h.best.chi}</span><span className="font-mono text-[10px]">F {h.best.noisy_fidelity_mps!.toFixed(3)}</span></> : "Insufficient data"}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </ChartCard>

        <ChartCard className="lg:col-span-2" title="Scaling · compiled CNOTs vs qubits" desc="Only 8 and 10 qubits are measured so far; lines between two points are not a fitted trend." chartLabel="Line chart of CNOT count against qubit count"
          table={{ head: ["Qubits", ...scaleKeys], rows: scaling.map((r) => [r.qubits!, ...scaleKeys.map((k) => r[k] ?? "Pending")]) }}>
          <div className="h-64">
            {scaling.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scaling} margin={{ top: 8, right: 16, bottom: 4, left: -4 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="qubits" tick={{ fontSize: 10 }} />
                  <YAxis scale="log" domain={[10, 2000]} allowDataOverflow tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {scaleKeys.map((k, i) => <Line key={k} dataKey={k} stroke={k === "Exact" ? "var(--color-muted-foreground)" : `var(--color-chart-${(i % 5) + 1})`} strokeDasharray={k === "Exact" ? "4 3" : ""} />)}
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </div>
        </ChartCard>
      </div>
      <ProvenanceNote />

      <Sheet open={!!prov} onOpenChange={(o) => !o && setProv(null)}>
        <SheetContent className="w-[420px] overflow-y-auto sm:max-w-[420px]">
          <SheetHeader>
            <SheetTitle>Provenance</SheetTitle>
            <SheetDescription>{prov?.rec ? `Record ${prov.rec.id}` : "Pending — benchmark not run"}</SheetDescription>
          </SheetHeader>
          {prov && (
            <dl className="mt-6 space-y-3 px-4 text-sm">
              {[
                ["Status", prov.rec?.status ?? "pending"],
                ["Qiskit", prov.rec?.qiskit_version ?? ENV.qiskit],
                ["Aer", prov.rec?.aer_version ?? "not recorded"],
                ["Seed", prov.rec?.seed ?? "not recorded"],
                ["Commit", prov.rec?.commit_hash ?? "not recorded"],
                ["Image", prov.rec?.image ?? "camera"],
                ["Resolution", prov.qubits === 10 ? "32×32 · 10 qubits" : "16×16 · 8 qubits"],
                ["Ordering", orderingLabel(prov.ordering)],
                ["Bond dimension", `χ=${prov.chi}`],
                ["Noise model", `depol(εcx=${fmtEps(prov.eps)}) on cx · εcx/10 on 1q · T1 ${DEFAULT_NOISE.t1} µs · T2 ${DEFAULT_NOISE.t2} µs`],
                ["PSNR / SSIM", `${f4(prov.rec?.psnr)} / ${f4(prov.rec?.ssim)}`],
                ...(prov.rec?.failure_reason ? [["Failure", prov.rec.failure_reason]] : []),
              ].map(([k, v]) => (
                <div key={String(k)} className="grid grid-cols-[120px_1fr] gap-2 border-b pb-3"><dt className="text-muted-foreground">{k}</dt><dd className="font-mono text-xs leading-relaxed">{String(v)}</dd></div>
              ))}
              {prov.rec && <Button asChild size="sm" variant="outline"><Link to="/runs/$runId" params={{ runId: prov.rec.id }}>Open run detail</Link></Button>}
            </dl>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Empty() {
  return <div className="flex h-full items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">No measured data in results.json yet.</div>;
}
