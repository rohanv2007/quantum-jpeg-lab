import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Clock, Copy, Github, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CircuitDiagram, Logo, ProvenanceNote, RecordImage, Reveal, Tag } from "@/components/qj/primitives";
import { CHIS } from "@/lib/data";
import { findRecord, num, useResults } from "@/lib/results";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Quantum JPEG — Approximate quantum image-state preparation" },
      { name: "description", content: "A research workbench comparing exact state preparation with truncated MPS circuits for small images under simulated Aer noise." },
      { property: "og:title", content: "Quantum JPEG — Approximate quantum image-state preparation" },
      { property: "og:description", content: "Amplitude encoding, right-canonical MPS truncation, sequential isometry synthesis and Aer noise simulation — with measured and pending results kept apart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="border-t py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-8 lg:grid-cols-[260px_1fr]">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight">{title}</h2>
        </Reveal>
        <Reveal delay={80}>{children}</Reveal>
      </div>
    </section>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return <div className="my-5 overflow-x-auto rounded-xl border bg-card px-5 py-4 font-mono text-[13px] leading-relaxed text-foreground">{children}</div>;
}

function Home() {
  const { records } = useResults();
  const get = (chi: number, eps: number, qubits = 10) => findRecord(records, { qubits, ordering: "hilbert", chi, eps, image: "camera" });
  const feat = get(2, 0.003);
  const fx = (v?: number | null, d = 4) => (num(v) ? v.toFixed(d) : "Pending");
  const noisyEps = useMemo(() => [...new Set(records.filter((r) => r.qubits === 10 && r.eps_cx > 0).map((r) => r.eps_cx))].sort(), [records]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-8">
          <Link to="/" className="flex items-center gap-2.5 text-foreground">
            <Logo className="text-primary" />
            <span className="font-semibold tracking-tight">Quantum JPEG</span>
          </Link>
          <nav className="hidden flex-1 items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#problem" className="hover:text-foreground">Problem</a>
            <a href="#method" className="hover:text-foreground">Method</a>
            <a href="#noise" className="hover:text-foreground">Noise model</a>
            <a href="#evidence" className="hover:text-foreground">Evidence</a>
            <a href="#roadmap" className="hover:text-foreground">Roadmap</a>
          </nav>
          <Button asChild size="sm"><Link to="/overview">Open workbench <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-8 pb-24 pt-20 lg:grid-cols-[1.1fr_1fr]">
        <Reveal>
          <Tag tone="cyan" className="font-mono">Simulation & benchmarking · no hardware claims</Tag>
          <h1 className="mt-6 font-display text-5xl leading-[1.05] tracking-tight lg:text-6xl">
            Loading images into quantum states, with fewer gates and honest numbers.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Quantum JPEG compares an exact state-preparation baseline with truncated Matrix Product State circuits for small images, then measures what survives configured gate noise in Qiskit Aer.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/simulation">Start a simulation</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/benchmarks">View benchmark results</Link></Button>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="grid grid-cols-3 gap-3">
              {([["Original", feat?.images?.original], ["Exact loader", feat?.images?.exact], ["MPS · χ=2", feat?.images?.mps]] as const).map(([l, src]) => (
                <figure key={l}>
                  <RecordImage src={src} label={l} emptyText="Illustrative placeholder" />
                  <figcaption className="mt-2 text-xs text-muted-foreground">{l}</figcaption>
                </figure>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <span className="font-mono text-[11px] text-muted-foreground">32×32 · 10 qubits · Hilbert</span>
              <Tag tone="illustrative">{feat?.images?.mps ? "From results data" : "Illustrative"}</Tag>
            </div>
          </div>
        </Reveal>
      </section>

      <Section id="problem" eyebrow="01 · The problem" title="Exact loaders are expensive, and noise punishes depth.">
        <div className="space-y-5 text-[15px] leading-relaxed text-muted-foreground">
          <p>
            Encoding a classical image into the amplitudes of a quantum state is a common first step for quantum image processing. Generic exact state preparation has a worst-case gate cost that grows exponentially with qubit count. Every additional two-qubit gate is another opportunity for noise to pull the prepared state away from the image.
          </p>
          <p>
            Quantum JPEG studies a narrow, testable question: <span className="text-foreground">can a deliberately approximate, low-depth circuit retain more of the original image state under simulated noise than an exact one?</span> It compares row-major, Z-order (Morton) and Hilbert pixel orderings without assuming any of them wins.
          </p>
          <div className="grid gap-3 pt-3 sm:grid-cols-3">
            {[[String(get(2, 0)?.exact_cnots ?? "Pending"), "CNOTs · exact loader, 10 qubits"], [String(get(2, 0)?.mps_cnots ?? "Pending"), "CNOTs · MPS χ=2, 10 qubits"], [fx(get(2, 0)?.ideal_fidelity_mps, 3), "Ideal fidelity · χ=2 to original"]].map(([v, l]) => (
              <div key={l} className="rounded-xl border bg-card p-4">
                <p className="font-mono text-2xl text-foreground tabular">{v}</p>
                <p className="mt-1 text-xs">{l}</p>
              </div>
            ))}
          </div>
          <ProvenanceNote />
        </div>
      </Section>

      <Section id="method" eyebrow="02 · Amplitude encoding" title="Pixels become a normalized statevector.">
        <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground">
          <p>Each channel of a 2ⁿ-pixel image is flattened through a chosen spatial ordering π, then normalized. A 16×16 image uses 8 qubits; 32×32 uses 10.</p>
          <Formula>
            |ψ⟩ = (1 / ‖x‖) · Σ<sub>k</sub> x<sub>π(k)</sub> |k⟩ ,  x ≥ 0 ,  scale = ‖x‖ stored for reconstruction
          </Formula>
          <ul className="space-y-2">
            <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-success" /> The MPS path supports real, nonnegative amplitudes only; the preprocessor asserts this before normalizing.</li>
            <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-success" /> An all-zero channel maps to |0…0⟩ with scale = 0, so reconstruction returns the zero channel.</li>
            <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-success" /> Qiskit little-endian indexing: site i corresponds to qubit i, and every ordering is validated as a bijection.</li>
            <li className="flex gap-2"><Clock className="mt-1 h-4 w-4 shrink-0 text-warning" /> Signed chroma (YCbCr) needs a separate reversible encoding — planned, not implemented.</li>
          </ul>
        </div>
      </Section>

      <Section id="mps" eyebrow="03 · Right-canonical MPS" title="Truncate entanglement with a right-to-left SVD sweep.">
        <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground">
          <p>The statevector is reshaped into n binary physical indices and swept from the right. At every cut, an SVD keeps at most χ singular values; the right factors become right-canonical tensors and the remainder is renormalized.</p>
          <Formula>
            ψ<sub>s₀…s₍ₙ₋₁₎</sub> ≈ A<sup>s₀</sup> B<sup>s₁</sup> ⋯ B<sup>s₍ₙ₋₁₎</sup> ,  Σ<sub>s</sub> B<sup>s</sup> B<sup>s†</sup> = 𝟙 ,  bond dim ≤ χ
          </Formula>
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr><th className="px-4 py-2 text-left font-medium">Bond dimension</th><th className="px-4 py-2 text-right font-medium">Compiled CNOTs</th><th className="px-4 py-2 text-right font-medium">Ideal fidelity to original</th></tr>
              </thead>
              <tbody className="font-mono">
                {([1, 2, 4, 8] as const).map((c) => (
                  <tr key={c} className="border-t"><td className="px-4 py-2 text-foreground">χ={c}</td><td className="px-4 py-2 text-right">{get(c, 0)?.mps_cnots ?? "Pending"}</td><td className="px-4 py-2 text-right text-foreground">{fx(get(c, 0)?.ideal_fidelity_mps, 3)}</td></tr>
                ))}
                <tr className="border-t"><td className="px-4 py-2 text-foreground">Exact</td><td className="px-4 py-2 text-right">{get(2, 0)?.exact_cnots ?? "Pending"}</td><td className="px-4 py-2 text-right">by construction</td></tr>
              </tbody>
            </table>
            <p className="border-t px-4 py-2 text-xs">Noiseless · camera 32×32 · Hilbert · single image · earlier sandbox run (Qiskit 2.6)</p>
          </div>
        </div>
      </Section>

      <Section id="synthesis" eyebrow="04 · Circuit synthesis" title="Sequential isometries turn each tensor into gates.">
        <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground">
          <p>Each right-canonical tensor defines an isometry from an incoming bond basis state to a physical site and outgoing bond. It is embedded with Qiskit <span className="font-mono text-foreground">Isometry</span>, acting on one site qubit plus log₂χ bond qubits, completed by an orthogonal complement.</p>
          <div className="rounded-xl border bg-card p-4"><CircuitDiagram qubits={10} chi={4} /></div>
          <p>The construction is validated end to end: contract the MPS, prepare the circuit, and assert squared overlap &gt; 1 − 10⁻⁹. In the earlier sandbox run this circuit correctness check returned <span className="font-mono text-foreground">1.0000000000</span> for every tested case. Gate counts are compared only after transpiling to <span className="font-mono text-foreground">rz, sx, x, cx</span> at optimization level 1.</p>
        </div>
      </Section>

      <Section id="noise" eyebrow="05 · Aer noise simulation" title="Score every loader against the original image state.">
        <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground">
          <p>Circuits run on <span className="font-mono text-foreground">AerSimulator(method="density_matrix")</span> with a documented model. Pixel probabilities come from the diagonal of ρ and the inverse amplitude mapping.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[["cx depolarizing", "depolarizing_error(εcx, 2)"], ["1-qubit depolarizing", "depolarizing_error(εcx/10, 1)"], ["Thermal relaxation", "T1 = 150 µs · T2 = 100 µs"], ["Gate durations", "cx 300 ns · 1q 35 ns"]].map(([k, v]) => (
              <div key={k} className="rounded-xl border bg-card p-4"><p className="text-xs">{k}</p><p className="mt-1 font-mono text-sm text-foreground">{v}</p></div>
            ))}
          </div>
          <Formula>F<sub>noisy</sub> = ⟨ψ<sub>original</sub>| ρ |ψ<sub>original</sub>⟩   — for both the exact and the MPS loader</Formula>
          <p>Noisy MPS fidelity is never scored against the MPS approximation itself. These are configured simulator settings and do not represent measurements of a physical device.</p>
        </div>
      </Section>

      <Section id="evidence" eyebrow="06 · Evidence" title="What is measured, and what is still pending.">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3"><p className="text-sm font-medium">Noisy fidelity (CNOTs) · 10 qubits</p><Tag tone="measured">Measured · preliminary</Tag></div>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground"><tr><th className="px-4 py-2 text-left font-medium">εcx</th><th className="px-4 py-2 text-right font-medium">Exact</th><th className="px-4 py-2 text-right font-medium">χ=2</th><th className="px-4 py-2 text-right font-medium">χ=4</th><th className="px-4 py-2 text-right font-medium">χ=8</th></tr></thead>
              <tbody className="font-mono">
                {noisyEps.map((e) => (
                  <tr key={e} className="border-t">
                    <td className="px-4 py-2">{(e * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right">{fx(get(2, e)?.noisy_fidelity_exact)} <span className="text-muted-foreground">({get(2, e)?.exact_cnots ?? "—"})</span></td>
                    {([2, 4, 8] as const).map((c) => (
                      <td key={c} className={`px-4 py-2 text-right ${c === 2 ? "text-primary" : ""}`}>{fx(get(c, e)?.noisy_fidelity_mps)} <span className="text-muted-foreground">({get(c, e)?.mps_cnots ?? "—"})</span></td>
                    ))}
                  </tr>
                ))}
                {!noisyEps.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No noisy records yet — Pending.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-[15px] leading-relaxed text-muted-foreground">In this single-image run, χ=2 retained more fidelity to the original state than χ=4, χ=8 and the exact loader at both tested error rates — while its ideal fidelity was only {fx(get(2, 0)?.ideal_fidelity_mps, 3)}. That is a statement about state fidelity, not image quality: noisy PSNR and SSIM have not been measured.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm font-medium">Measured · earlier sandbox run</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {["Noiseless CNOTs & ideal fidelity, χ=1–8 (n=10)", "Noisy fidelity, χ=2/4/8 + exact, εcx 0.3% & 0.8%", "Both 8 and 10 qubits, Hilbert ordering", "Circuit-vs-MPS correctness check = 1.0"].map((t) => (
                  <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{t}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm font-medium">Pending</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {["χ=1 noisy fidelity", "Row-major and Z-order under noise", "εcx 0.1% and 1.5%", "Noisy PSNR and SSIM", "Multi-image aggregates", "YCbCr chroma and ROI compression"].map((t) => (
                  <li key={t} className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />{t}</li>
                ))}
              </ul>
            </div>
          </div>
          <ProvenanceNote />
        </div>
      </Section>

      <section className="border-t bg-sidebar py-20 text-sidebar-foreground">
        <Reveal className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-8 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl tracking-tight text-sidebar-accent-foreground">Explore the tradeoff yourself.</h2>
            <p className="mt-2 text-sm text-sidebar-muted">Configure ordering, bond dimension and noise; see which results are measured and which are pending.</p>
          </div>
          <div className="flex gap-3">
            <Button asChild size="lg"><Link to="/simulation">Open the workbench</Link></Button>
            <Button asChild size="lg" variant="secondary"><Link to="/overview">Overview</Link></Button>
          </div>
        </Reveal>
      </section>
      <RoadmapAndLimits />
      <Footer />
    </div>
  );
}

const ROADMAP: [string, "Done" | "In progress" | "Planned"][] = [
  ["Hilbert ordering · χ=2/4/8 noisy runs (8 & 10 qubits)", "Done"],
  ["Row-major & Z-order runs", "Planned"],
  ["χ=1 under noise", "Planned"],
  ["Multi-image aggregates (camera, astronaut, textures, noise images)", "Planned"],
  ["PSNR / SSIM", "Planned"],
  ["Equal-budget baselines (layered/variational loader, FRQI/NEQR)", "Planned"],
  ["12–16 qubit scaling", "Planned"],
  ["Fake-backend noise with coupling map", "Planned"],
  ["One small hardware run", "Planned"],
  ["YCbCr & ROI compression", "Planned"],
  ["QNN testbed", "Planned"],
];
const LIMITS = [
  ["Single image", "All measured values come from one downsampled camera image."],
  ["Simulation only", "Every number comes from a Qiskit Aer density-matrix simulation, not hardware."],
  ["Fidelity ≠ image quality", "High state fidelity does not guarantee a visually good reconstruction; PSNR/SSIM are pending."],
  ["Readout shot cost", "Reading out an N-pixel image needs on the order of N/ε² shots, which can erase any gate savings."],
  ["Smooth images favour MPS", "Smooth images have low entanglement across cuts; textured or noisy images may need much larger χ."],
];
const BIBTEX = `@software{quantum_jpeg_2026,
  title  = {Quantum JPEG: Approximate image-state preparation with truncated MPS circuits},
  author = {Rohan V},
  year   = {2026},
  note   = {Simulation study; preliminary single-image results}
}`;

function RoadmapAndLimits() {
  return (
    <>
      <Section id="roadmap" eyebrow="07 · Roadmap" title="What comes next.">
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {ROADMAP.map(([t, st]) => (
            <li key={t} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span>{t}</span>
              <Tag tone={st === "Done" ? "measured" : st === "In progress" ? "illustrative" : "muted"}>
                {st === "Done" ? <Check className="h-3 w-3" /> : st === "In progress" ? <Loader2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />} {st}
              </Tag>
            </li>
          ))}
        </ul>
      </Section>
      <Section id="limitations" eyebrow="08 · Limitations" title="Read the results with these in mind.">
        <dl className="grid gap-3 sm:grid-cols-2">
          {LIMITS.map(([t, d]) => <div key={t} className="rounded-xl border bg-card p-4"><dt className="text-sm font-medium">{t}</dt><dd className="mt-1 text-sm text-muted-foreground">{d}</dd></div>)}
        </dl>
      </Section>
    </>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-8 py-10 text-xs text-muted-foreground md:grid-cols-[1fr_1.2fr]">
        <div className="space-y-2">
          <p className="font-medium text-foreground">Quantum JPEG · research software prototype</p>
          <a href="#" className="inline-flex items-center gap-1.5 hover:text-foreground"><Github className="h-3.5 w-3.5" /> GitHub repository (link coming soon)</a>
          <p>License: to be confirmed before public release.</p>
          <p>Built with Qiskit and Qiskit Aer. Not affiliated with or endorsed by IBM. No claims of quantum advantage or hardware performance.</p>
        </div>
        <div>
          <div className="flex items-center justify-between"><p className="font-medium text-foreground">Cite this</p>
            <button onClick={() => navigator.clipboard.writeText(BIBTEX).then(() => toast.success("BibTeX copied"))} className="inline-flex items-center gap-1 hover:text-foreground"><Copy className="h-3 w-3" /> Copy</button></div>
          <pre className="mt-2 overflow-x-auto rounded-lg border bg-card p-3 font-mono text-[11px]">{BIBTEX}</pre>
        </div>
      </div>
    </footer>
  );
}
