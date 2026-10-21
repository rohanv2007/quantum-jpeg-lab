import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tag } from "@/components/qj/primitives";
import { CHIS, DEFAULT_CONFIG, ENV, ORDERINGS, type SimConfig } from "@/lib/data";
import { loadDefaults, saveDefaults } from "@/lib/draft";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_workbench/settings")({
  head: () => ({
    meta: [
      { title: "Settings & provenance — Quantum JPEG" },
      { name: "description", content: "Theme, simulation defaults, dependency versions and dataset provenance for Quantum JPEG." },
      { property: "og:title", content: "Settings & provenance — Quantum JPEG" },
      { property: "og:description", content: "Workbench preferences and data provenance." },
    ],
  }),
  component: SettingsPage,
});

type Theme = "light" | "dark" | "system";
function applyTheme(t: Theme) {
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("qjpeg.theme", t);
}

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-b py-7 last:border-0 md:grid-cols-[260px_1fr]">
      <div><h3 className="text-sm font-semibold">{title}</h3>{desc && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>}</div>
      <div>{children}</div>
    </section>
  );
}

function SettingsPage() {
  const [theme, setTheme] = useState<Theme>("light");
  const [d, setD] = useState<SimConfig>(DEFAULT_CONFIG);
  useEffect(() => {
    setTheme((localStorage.getItem("qjpeg.theme") as Theme) ?? "light");
    setD(loadDefaults());
  }, []);

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border bg-card px-8">
      <Card title="Theme" desc="Applies to this browser.">
        <div className="flex gap-2">
          {(["light", "dark", "system"] as Theme[]).map((t) => (
            <button key={t} onClick={() => { setTheme(t); applyTheme(t); }} className={cn("rounded-lg border px-4 py-2 text-sm capitalize", theme === t ? "border-primary bg-primary-soft text-primary" : "hover:bg-muted")}>{t}</button>
          ))}
        </div>
      </Card>
      <Card title="Simulation defaults" desc="Used when you start a new simulation.">
        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1.5 text-xs text-muted-foreground">Image mode
            <Select value={d.mode} onValueChange={(v) => setD({ ...d, mode: v as SimConfig["mode"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="grayscale">Grayscale</SelectItem><SelectItem value="rgb">RGB</SelectItem></SelectContent></Select>
          </label>
          <label className="space-y-1.5 text-xs text-muted-foreground">Ordering
            <Select value={d.ordering} onValueChange={(v) => setD({ ...d, ordering: v as SimConfig["ordering"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ORDERINGS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
          </label>
          <label className="space-y-1.5 text-xs text-muted-foreground">Bond dimension
            <Select value={String(d.chi)} onValueChange={(v) => setD({ ...d, chi: Number(v) as SimConfig["chi"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CHIS.map((c) => <SelectItem key={c} value={String(c)}>χ={c}</SelectItem>)}</SelectContent></Select>
          </label>
          <label className="space-y-1.5 text-xs text-muted-foreground">Resolution
            <Select value={String(d.resolution)} onValueChange={(v) => setD({ ...d, resolution: Number(v) as SimConfig["resolution"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="16">16×16 · 8 qubits</SelectItem><SelectItem value="32">32×32 · 10 qubits</SelectItem></SelectContent></Select>
          </label>
          <label className="space-y-1.5 text-xs text-muted-foreground">Default εcx
            <Input type="number" step={0.001} value={d.noise.epsCx} onChange={(e) => setD({ ...d, noise: { ...d.noise, epsCx: Number(e.target.value) } })} className="font-mono" />
          </label>
          <label className="space-y-1.5 text-xs text-muted-foreground">Optimization level
            <Input type="number" min={0} max={3} value={d.optimizationLevel} onChange={(e) => setD({ ...d, optimizationLevel: Number(e.target.value) })} className="font-mono" />
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={() => { saveDefaults(d); toast.success("Defaults saved"); }}>Save defaults</Button>
          <Button size="sm" variant="ghost" onClick={() => { setD(DEFAULT_CONFIG); saveDefaults(DEFAULT_CONFIG); toast("Defaults restored"); }}>Restore documented defaults</Button>
        </div>
      </Card>
      <Card title="Dependencies" desc="Versions recorded for the preliminary dataset.">
        <dl className="grid grid-cols-[160px_1fr] gap-y-2 font-mono text-xs">
          <dt className="text-muted-foreground">qiskit</dt><dd>{ENV.qiskit}</dd>
          <dt className="text-muted-foreground">qiskit-aer</dt><dd className="text-warning">not recorded — pending</dd>
          <dt className="text-muted-foreground">simulator</dt><dd>{ENV.method}</dd>
          <dt className="text-muted-foreground">basis</dt><dd>{ENV.basis}</dd>
          <dt className="text-muted-foreground">benchmark runner</dt><dd className="text-warning">run_all.py — pending</dd>
        </dl>
      </Card>
      <Card title="Dataset provenance" desc="Only license-clear examples are used.">
        <ul className="space-y-3 text-sm">
          <li className="flex items-start justify-between gap-4"><span><span className="font-mono text-xs">skimage.data.camera</span><span className="block text-xs text-muted-foreground">Source of the preliminary measurements, area-downsampled. Confirm license before redistribution.</span></span><Tag tone="measured">Used</Tag></li>
          <li className="flex items-start justify-between gap-4"><span><span className="font-mono text-xs">skimage.data.astronaut</span><span className="block text-xs text-muted-foreground">Candidate for multi-image aggregates.</span></span><Tag tone="pending">Planned</Tag></li>
          <li className="flex items-start justify-between gap-4"><span><span className="font-mono text-xs">sklearn load_digits</span><span className="block text-xs text-muted-foreground">Candidate for a stretch QNN experiment.</span></span><Tag tone="pending">Planned</Tag></li>
          <li className="text-xs text-muted-foreground">The in-app sample tile is a procedural camera-like stand-in for display. MNIST, CIFAR, MRI and sonar assets are excluded. YCbCr chroma and ROI compression are planned features.</li>
        </ul>
      </Card>
      <Card title="About the noise model">
        <p className="text-sm leading-relaxed text-muted-foreground">Noise settings configure a Qiskit Aer density-matrix simulation. They do not represent measurements of any physical device, and no result in this workbench claims quantum advantage or hardware performance.</p>
      </Card>
    </div>
  );
}
