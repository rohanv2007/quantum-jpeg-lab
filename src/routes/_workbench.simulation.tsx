import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Columns3, Grid3x3, ImageIcon, Loader2, Maximize, Minus, Play, Plus, RotateCcw, Save, SplitSquareHorizontal, Upload, X, Diff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoTip, MetricValue, PixelCanvas, ProvenanceNote, Tag } from "@/components/qj/primitives";
import { CHIS, NOISE_PRESETS, ORDERINGS, qubitsFor, resolveMetrics, fmtEps, orderingLabel, type SimConfig, type ResolvedMetrics, type Chi } from "@/lib/data";
import { difference, illustrate, imageFromFile, sampleImage, type Img } from "@/lib/imagery";
import { takeDraftConfig, loadDefaults } from "@/lib/draft";
import { addRun } from "@/lib/runs-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_workbench/simulation")({
  head: () => ({
    meta: [
      { title: "Simulation workbench — Quantum JPEG" },
      { name: "description", content: "Configure image, ordering, bond dimension and noise, then compare original, exact-loader and MPS-loader reconstructions." },
      { property: "og:title", content: "Simulation workbench — Quantum JPEG" },
      { property: "og:description", content: "Three-way comparator for exact vs MPS image-state preparation under configured Aer noise." },
    ],
  }),
  component: Workbench,
});

const STAGES = ["Preprocessing", "State preparation", "Transpilation", "Noise simulation", "Reconstruction", "Scoring"];

type Phase = "idle" | "running" | "done" | "error";
interface Result { config: SimConfig; original: Img; exact: Img; mps: Img; metrics: ResolvedMetrics }

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-lg bg-muted p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("rounded-md px-2 py-1.5 text-xs font-medium transition-all", value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, tip, children }: { label: string; tip?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5"><Label className="text-xs font-medium text-muted-foreground">{label}</Label>{tip && <InfoTip>{tip}</InfoTip>}</div>
      {children}
    </div>
  );
}

function Workbench() {
  const [cfg, setCfg] = useState<SimConfig>(() => takeDraftConfig() ?? loadDefaults());
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [mode, setMode] = useState<"side" | "split" | "diff">("side");
  const [zoom, setZoom] = useState(1);
  const [grid, setGrid] = useState(false);
  const [split, setSplit] = useState(50);
  const [splitTarget, setSplitTarget] = useState<"exact" | "mps">("mps");
  const timers = useRef<number[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const set = <K extends keyof SimConfig>(k: K, v: SimConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const setNoise = (k: keyof SimConfig["noise"], v: number) => setCfg((c) => ({ ...c, noise: { ...c.noise, [k]: v } }));
  const live = useMemo(() => resolveMetrics(cfg), [cfg]);
  const preview = useMemo(() => (cfg.source === "camera" ? sampleImage(cfg.resolution, cfg.mode === "rgb") : null), [cfg.source, cfg.resolution, cfg.mode]);

  const reset = () => {
    timers.current.forEach(clearTimeout);
    setCfg(loadDefaults());
    setFile(null);
    setPhase("idle");
    setResult(null);
    setStage(0);
  };

  const run = async () => {
    timers.current.forEach(clearTimeout);
    setError("");
    if (cfg.source === "upload" && !file) {
      setPhase("error");
      setError("No image selected. Drop a PNG or JPEG into the upload area, or switch to the camera sample.");
      return;
    }
    let original: Img;
    try {
      original = file && cfg.source === "upload" ? await imageFromFile(file, cfg.resolution, cfg.mode === "rgb") : sampleImage(cfg.resolution, cfg.mode === "rgb");
    } catch (e) {
      setPhase("error");
      setError((e as Error).message);
      return;
    }
    const snap = structuredClone(cfg);
    const m = resolveMetrics(snap);
    // Illustrative visuals: use measured fidelity when present, otherwise a heuristic.
    const eps = snap.noise.epsCx, q = qubitsFor(snap.resolution);
    const exF = m.exactNoisyF.measured ? m.exactNoisyF.value : Math.exp(-eps * (q === 10 ? 1013 : 247) * 1.6);
    const mpsF = m.mpsNoisyF.measured ? m.mpsNoisyF.value : Math.min(0.99, ({ 1: 0.83, 2: 0.95, 4: 0.976, 8: 0.995 } as const)[snap.chi] * Math.exp(-eps * snap.chi * snap.chi * 6));
    const res: Result = {
      config: snap,
      original,
      exact: illustrate(original, { fidelity: Math.max(exF, 0.04), blockiness: 1, seed: 11 }),
      mps: illustrate(original, { fidelity: mpsF, blockiness: ({ 1: 8, 2: 4, 4: 2, 8: 1 } as const)[snap.chi], seed: 7 }),
      metrics: m,
    };
    setPhase("running");
    setStage(0);
    STAGES.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setStage(i + 1), 520 * (i + 1)));
    });
    timers.current.push(
      window.setTimeout(() => {
        setResult(res);
        setPhase("done");
        addRun({
          name: `${snap.source === "camera" ? "Camera" : snap.uploadName ?? "Upload"} ${snap.resolution}×${snap.resolution} · ${orderingLabel(snap.ordering)} · χ=${snap.chi}`,
          config: snap,
          status: m.noisyMatch ? "complete" : "pending",
          kind: m.noisyMatch ? "benchmark" : "illustrative",
          note: m.noisyMatch ? "Matched preliminary sandbox record." : "Pending — benchmark not run. Visuals are illustrative.",
        });
      }, 520 * STAGES.length + 250),
    );
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!/image\/(png|jpeg|webp)/.test(f.type)) {
      toast.error("Unsupported file", { description: "Use PNG, JPEG or WebP." });
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error("File too large", { description: "Maximum size is 8 MB." });
      return;
    }
    setFile(f);
    setCfg((c) => ({ ...c, source: "upload", uploadName: f.name }));
  };

  const imgId = cfg.source === "camera" ? "camera_sample" : file?.name ?? "—";
  const shown = result ?? null;
  const metrics = shown?.metrics ?? live;

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_300px] lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Configuration */}
      <aside className="space-y-5 rounded-2xl border bg-card p-5 lg:row-span-2 xl:row-span-1">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Configuration</h2>
          <button onClick={reset} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><RotateCcw className="h-3 w-3" /> Reset</button>
        </div>

        <Field label="Image source">
          <Seg label="Image source" value={cfg.source} onChange={(v) => set("source", v)} options={[{ value: "camera", label: "Camera (sample)" }, { value: "upload", label: "Upload image" }]} />
        </Field>
        {cfg.source === "upload" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
            className={cn("rounded-xl border border-dashed p-4 text-center transition-colors", drag ? "border-primary bg-primary-soft" : "bg-muted/40")}
          >
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            {file ? (
              <div className="flex items-center gap-2 text-left">
                <ImageIcon className="h-8 w-8 shrink-0 rounded-md bg-primary-soft p-1.5 text-primary" />
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{file.name}</p><p className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · center-cropped, resized</p></div>
                <button aria-label="Remove file" onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-xs">{drag ? "Release to use this image" : "Drag an image here"}</p>
                <button onClick={() => fileInput.current?.click()} className="mt-1 text-xs font-medium text-primary hover:underline">or browse files</button>
                <p className="mt-2 text-[11px] text-muted-foreground">PNG, JPEG, WebP · ≤ 8 MB · uploads are previewed illustratively</p>
              </>
            )}
          </div>
        )}

        <Field label="Image mode" tip="The MPS path supports real, nonnegative amplitudes. RGB encodes each channel separately; signed YCbCr chroma is planned.">
          <Seg label="Image mode" value={cfg.mode} onChange={(v) => set("mode", v)} options={[{ value: "grayscale", label: "Grayscale" }, { value: "rgb", label: "RGB" }]} />
        </Field>
        <Field label="Resolution">
          <Seg label="Resolution" value={cfg.resolution} onChange={(v) => set("resolution", v)} options={[{ value: 16, label: "16×16 · 8 q" }, { value: 32, label: "32×32 · 10 q" }]} />
        </Field>
        <Field label="Spatial ordering" tip="The order in which pixels are laid along the statevector. Space-filling curves keep neighbouring pixels close together; whether that helps is an open question.">
          <Select value={cfg.ordering} onValueChange={(v) => set("ordering", v as SimConfig["ordering"])}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{ORDERINGS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="MPS bond dimension" tip="χ limits how much correlation between image regions the approximation keeps. Lower χ means fewer gates but a rougher approximation.">
          <Seg label="Bond dimension" value={cfg.chi} onChange={(v) => set("chi", v as Chi)} options={CHIS.map((c) => ({ value: c, label: `χ=${c}` }))} />
        </Field>

        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between"><h3 className="text-xs font-semibold">Noise model</h3><Tag tone="cyan">Simulated</Tag></div>
          <div className="flex flex-wrap gap-1.5">
            {NOISE_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setNoise("epsCx", p.epsCx)}
                className={cn("rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors", Math.abs(cfg.noise.epsCx - p.epsCx) < 1e-9 ? "border-primary bg-primary-soft text-primary" : "hover:bg-muted")}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <NumField label="εcx (prob.)" tip="Depolarizing probability applied to each CNOT — the chance it is replaced by random noise. Not average gate infidelity." value={cfg.noise.epsCx} step={0.001} onChange={(v) => setNoise("epsCx", v)} />
            <NumField label="T1 (µs)" value={cfg.noise.t1} onChange={(v) => setNoise("t1", v)} />
            <NumField label="T2 (µs)" value={cfg.noise.t2} onChange={(v) => setNoise("t2", v)} />
            <NumField label="cx (ns)" value={cfg.noise.cxDuration} onChange={(v) => setNoise("cxDuration", v)} />
            <NumField label="1q gate (ns)" value={cfg.noise.oneQDuration} onChange={(v) => setNoise("oneQDuration", v)} />
          </div>
        </div>

        <Accordion type="single" collapsible className="border-t">
          <AccordionItem value="adv" className="border-none">
            <AccordionTrigger className="py-3 text-xs font-semibold hover:no-underline">Advanced · transpilation</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <Field label="Basis gates"><Input value={cfg.basis} onChange={(e) => set("basis", e.target.value)} className="h-9 font-mono text-xs" /></Field>
              <Field label="Optimization level">
                <Seg label="Optimization level" value={cfg.optimizationLevel} onChange={(v) => set("optimizationLevel", v)} options={[0, 1, 2, 3].map((n) => ({ value: n, label: String(n) }))} />
              </Field>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button className="w-full gap-2" onClick={run} disabled={phase === "running"}>
          {phase === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {phase === "running" ? "Running…" : "Run simulation"}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          {live.noisyMatch ? <span className="text-success">Matches a preliminary measured record</span> : "No measured record for this configuration"}
        </p>
      </aside>

      {/* Canvas */}
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-2.5">
          <div className="flex rounded-lg bg-muted p-1" role="tablist" aria-label="Comparison mode">
            {([["side", "Side by side", Columns3], ["split", "Split", SplitSquareHorizontal], ["diff", "Difference", Diff]] as const).map(([v, l, I]) => (
              <button key={v} role="tab" aria-selected={mode === v} onClick={() => setMode(v)} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", mode === v ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <I className="h-3.5 w-3.5" /> {l}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1}><Minus className="h-3.5 w-3.5" /></Button>
            <span className="w-11 text-center font-mono text-xs tabular">{zoom.toFixed(1)}×</span>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 0.5))} disabled={zoom >= 4}><Plus className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Fit to view" onClick={() => setZoom(1)}><Maximize className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant={grid ? "secondary" : "ghost"} className="h-8 gap-1.5 text-xs" aria-pressed={grid} onClick={() => setGrid((g) => !g)}><Grid3x3 className="h-3.5 w-3.5" /> Pixel grid</Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{(shown?.config.source ?? cfg.source) === "camera" ? "camera_sample" : imgId} · {(shown?.config.resolution ?? cfg.resolution)}×{shown?.config.resolution ?? cfg.resolution} · {qubitsFor(shown?.config.resolution ?? cfg.resolution)} qubits · {orderingLabel(shown?.config.ordering ?? cfg.ordering)}</span>
            {phase === "done" && <Tag tone="illustrative" className="ml-auto">Illustrative preview · not an Aer benchmark</Tag>}
          </div>

          {phase === "error" ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="mt-3 text-sm font-medium">Simulation could not start</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">{error}</p>
              <Button size="sm" variant="outline" className="mt-4" onClick={() => setPhase("idle")}>Dismiss</Button>
            </div>
          ) : mode === "side" || !shown ? (
            <div className="grid grid-cols-3 gap-4">
              {(["Original", "Exact loader", "MPS loader"] as const).map((t, i) => {
                const img = i === 0 ? shown?.original ?? preview : i === 1 ? shown?.exact : shown?.mps;
                return (
                  <figure key={t}>
                    {img ? (
                      <PixelCanvas img={img} grid={grid} zoom={zoom} label={t} className="animate-in fade-in duration-500" />
                    ) : phase === "running" ? (
                      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted"><div className="progress-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-card/70 to-transparent" /></div>
                    ) : (
                      <div className="flex aspect-square flex-col items-center justify-center rounded-lg border border-dashed bg-muted/40 text-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
                        <p className="mt-2 text-xs text-muted-foreground">{i === 0 ? "Upload an image" : "Run to preview"}</p>
                      </div>
                    )}
                    <figcaption className="mt-2.5 flex items-center justify-between text-xs">
                      <span className="font-medium">{t}{i === 2 && <span className="ml-1 font-mono text-muted-foreground">χ={shown?.config.chi ?? cfg.chi}</span>}</span>
                      {i > 0 && shown && (
                        <span className="font-mono text-muted-foreground">
                          F={i === 1 ? (shown.metrics.exactNoisyF.measured ? shown.metrics.exactNoisyF.value.toFixed(4) : "pending") : shown.metrics.mpsNoisyF.measured ? shown.metrics.mpsNoisyF.value.toFixed(4) : "pending"}
                        </span>
                      )}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          ) : mode === "split" ? (
            <div className="mx-auto max-w-md">
              <div className="mb-3 flex justify-center"><Seg label="Compare against" value={splitTarget} onChange={setSplitTarget} options={[{ value: "exact", label: "Original | Exact" }, { value: "mps", label: "Original | MPS" }]} /></div>
              <div className="relative">
                <PixelCanvas img={shown[splitTarget]} grid={grid} zoom={zoom} label="Reconstruction" />
                <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}><PixelCanvas img={shown.original} grid={grid} zoom={zoom} label="Original" /></div>
                <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-cyan" style={{ left: `${split}%` }} />
              </div>
              <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(+e.target.value)} className="mt-3 w-full accent-primary" aria-label="Split position" />
              <div className="flex justify-between text-xs text-muted-foreground"><span>Original</span><span>{splitTarget === "exact" ? "Exact loader" : `MPS χ=${shown.config.chi}`}</span></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {(["exact", "mps"] as const).map((k) => (
                <figure key={k}>
                  <PixelCanvas img={difference(shown.original, shown[k])} grid={grid} zoom={zoom} label={`Difference ${k}`} />
                  <figcaption className="mt-2 text-xs"><span className="font-medium">|Original − {k === "exact" ? "Exact" : "MPS"}|</span> <span className="text-muted-foreground">· brighter = larger deviation</span></figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline */}
        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Pipeline</h3>
            <span className="text-xs text-muted-foreground">{phase === "running" ? `Stage ${Math.min(stage + 1, 6)} of 6` : phase === "done" ? "Completed" : phase === "error" ? "Not started" : "Idle"}</span>
          </div>
          <ol className="grid grid-cols-6 gap-2">
            {STAGES.map((s, i) => {
              const done = phase === "done" || (phase === "running" && stage > i);
              const active = phase === "running" && stage === i;
              return (
                <li key={s}>
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full transition-all duration-500", done ? "w-full bg-primary" : active ? "w-1/2 bg-cyan" : "w-0")} />
                  </div>
                  <p className={cn("mt-2 flex items-center gap-1 text-[11px]", done ? "text-foreground" : active ? "text-primary" : "text-muted-foreground")}>
                    {done ? <Check className="h-3 w-3 text-success" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {s}
                  </p>
                </li>
              );
            })}
          </ol>
          {phase === "done" && shown && !shown.metrics.noisyMatch && (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-warning-soft px-4 py-3">
              <div><p className="text-sm font-medium text-warning">Pending — benchmark not run</p><p className="text-xs text-muted-foreground">No measured record matches this configuration. Images above are illustrative only.</p></div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toast.success("Configuration saved", { description: "Added to Run history as Pending." })}><Save className="h-3.5 w-3.5" /> Save configuration</Button>
            </div>
          )}
          {phase === "done" && shown?.metrics.noisyMatch && (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-success-soft px-4 py-3">
              <div><p className="text-sm font-medium text-success">Matched a preliminary measured record</p><ProvenanceNote className="mt-1" /></div>
              <Button size="sm" variant="outline" asChild><Link to="/runs">View in history</Link></Button>
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      <aside className="space-y-4 lg:col-start-2 xl:col-start-auto">
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Run summary</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
            {[
              ["Image", (shown?.config ?? cfg).source === "camera" ? "camera_sample" : imgId],
              ["Mode", (shown?.config ?? cfg).mode],
              ["Qubits", qubitsFor((shown?.config ?? cfg).resolution)],
              ["Ordering", orderingLabel((shown?.config ?? cfg).ordering)],
              ["χ", (shown?.config ?? cfg).chi],
              ["εcx", fmtEps((shown?.config ?? cfg).noise.epsCx)],
              ["Basis", (shown?.config ?? cfg).basis],
              ["Opt. level", (shown?.config ?? cfg).optimizationLevel],
            ].map(([k, v]) => (
              <div key={k as string} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="truncate text-right font-mono">{v}</dd></div>
            ))}
          </dl>
          {!shown && <p className="mt-3 border-t pt-3 text-[11px] text-muted-foreground">Values below reflect the current configuration before running.</p>}
        </div>

        <MetricGroup title="Circuit resources" items={[
          ["Compiled CNOTs · exact", <MetricValue key="a" m={metrics.exactCnots} digits={0} />, "Number of two-qubit CNOT gates after transpiling to the recorded basis and optimization level. More CNOTs mean more exposure to noise."],
          ["Compiled CNOTs · MPS", <MetricValue key="b" m={metrics.mpsCnots} digits={0} />],
        ]} />
        <MetricGroup title="State fidelity" tip="Noisy fidelity is ⟨ψ_original|ρ|ψ_original⟩ for both loaders — always scored against the original normalized image state after spatial ordering." items={[
          ["Ideal fidelity · MPS to original", <MetricValue key="c" m={metrics.mpsIdealF} digits={3} />],
          ["Noisy fidelity · exact", <MetricValue key="d" m={metrics.exactNoisyF} />],
          ["Noisy fidelity · MPS", <MetricValue key="e" m={metrics.mpsNoisyF} />],
        ]} />
        <MetricGroup title="Image quality" items={[
          ["PSNR", <MetricValue key="f" m={metrics.psnr} />],
          ["SSIM", <MetricValue key="g" m={metrics.ssim} />],
        ]} />
        <div className="rounded-2xl border border-dashed bg-card/60 p-4">
          <div className="flex items-center gap-1.5"><p className="text-xs font-semibold">Circuit fidelity vs. contracted MPS</p><InfoTip>A circuit correctness check: does the synthesized circuit prepare its own contracted MPS state? It is not an image-fidelity score.</InfoTip></div>
          <div className="mt-2 flex items-center justify-between"><Tag>Correctness check</Tag>{metrics.circuitVsMps.measured ? <span className="font-mono text-sm">1.0000000000</span> : <span className="text-sm text-warning">Pending</span>}</div>
        </div>
        {metrics.anyMeasured && <ProvenanceNote className="px-1" />}
      </aside>
    </div>
  );
}

function MetricGroup({ title, tip, items }: { title: string; tip?: string; items: [string, React.ReactNode, string?][] }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-1.5"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>{tip && <InfoTip>{tip}</InfoTip>}</div>
      <div className="mt-3 space-y-2.5">
        {items.map(([l, v, t]) => (
          <div key={l} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">{l}{t && <InfoTip>{t}</InfoTip>}</span>
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, step = 1, tip }: { label: string; value: number; onChange: (v: number) => void; step?: number; tip?: string }) {
  return (
    <label className="space-y-1">
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">{label}{tip && <InfoTip>{tip}</InfoTip>}</span>
      <Input type="number" value={value} step={step} min={0} onChange={(e) => onChange(Number(e.target.value))} className="h-8 font-mono text-xs" />
    </label>
  );
}
