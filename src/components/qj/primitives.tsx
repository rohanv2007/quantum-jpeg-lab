import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Img } from "@/lib/imagery";
import type { RunStatus } from "@/lib/runs-store";
import { PROVENANCE_LABEL, type Measured } from "@/lib/data";

export function Logo({ className }: { className?: string }) {
  // pixel grid flowing into a circuit wire
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden>
      <rect x="3" y="7" width="5" height="5" rx="1" fill="currentColor" opacity="0.95" />
      <rect x="9" y="7" width="5" height="5" rx="1" fill="currentColor" opacity="0.55" />
      <rect x="3" y="13" width="5" height="5" rx="1" fill="currentColor" opacity="0.35" />
      <rect x="9" y="13" width="5" height="5" rx="1" fill="currentColor" opacity="0.8" />
      <rect x="3" y="19" width="5" height="5" rx="1" fill="currentColor" opacity="0.65" />
      <rect x="9" y="19" width="5" height="5" rx="1" fill="currentColor" opacity="0.25" />
      <path d="M15 9.5h14M15 21.5h14" stroke="var(--color-cyan)" strokeWidth="1.5" />
      <circle cx="22" cy="9.5" r="2" fill="var(--color-cyan)" />
      <path d="M22 9.5v12" stroke="var(--color-cyan)" strokeWidth="1.5" />
      <circle cx="22" cy="21.5" r="3" fill="none" stroke="var(--color-cyan)" strokeWidth="1.5" />
    </svg>
  );
}

export function InfoTip({ children, label = "More information" }: { children: ReactNode; label?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} className="inline-flex text-muted-foreground hover:text-foreground">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{children}</TooltipContent>
    </Tooltip>
  );
}

const STATUS: Record<RunStatus, string> = {
  complete: "bg-success-soft text-success",
  running: "bg-primary-soft text-primary",
  pending: "bg-warning-soft text-warning",
  failed: "bg-destructive/10 text-destructive",
};
export function StatusPill({ status }: { status: RunStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", STATUS[status])}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", status === "running" && "animate-pulse")} />
      {status}
    </span>
  );
}

export function Tag({ tone = "muted", children, className }: { tone?: "muted" | "measured" | "pending" | "illustrative" | "cyan"; children: ReactNode; className?: string }) {
  const t = {
    muted: "bg-muted text-muted-foreground border-border",
    measured: "bg-success-soft text-success border-transparent",
    pending: "bg-warning-soft text-warning border-transparent",
    illustrative: "bg-primary-soft text-primary border-transparent",
    cyan: "bg-cyan-soft text-foreground border-transparent",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide", t, className)}>{children}</span>;
}

export function ProvenanceNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 font-mono text-[11px] text-muted-foreground", className)}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
      {PROVENANCE_LABEL}
    </p>
  );
}

export function MetricValue({ m, digits = 4, suffix }: { m: Measured<number>; digits?: number; suffix?: string }) {
  if (!m.measured) return <span className="text-sm font-medium text-warning">Pending</span>;
  return (
    <span className="font-mono text-lg font-medium tabular text-foreground">
      {Number.isInteger(m.value) && digits === 0 ? m.value.toLocaleString() : m.value.toFixed(digits)}
      {suffix}
    </span>
  );
}

export function PixelCanvas({ img, className, grid, zoom = 1, label }: { img: Img | null; className?: string; grid?: boolean; zoom?: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !img) return;
    c.width = img.size;
    c.height = img.size;
    const ctx = c.getContext("2d")!;
    const d = ctx.createImageData(img.size, img.size);
    const rgb = img.channels.length === 3;
    for (let i = 0; i < img.size * img.size; i++) {
      const r = img.channels[0][i], g = rgb ? img.channels[1][i] : r, b = rgb ? img.channels[2][i] : r;
      d.data[i * 4] = r * 255; d.data[i * 4 + 1] = g * 255; d.data[i * 4 + 2] = b * 255; d.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(d, 0, 0);
  }, [img]);
  const n = img?.size ?? 32;
  return (
    <div className={cn("relative aspect-square overflow-hidden rounded-lg bg-muted", className)}>
      <div className="h-full w-full transition-transform duration-300" style={{ transform: `scale(${zoom})` }}>
        <canvas ref={ref} role="img" aria-label={label} className="pixelated h-full w-full" />
        {grid && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(to right, color-mix(in oklab, var(--color-cyan) 45%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--color-cyan) 45%, transparent) 1px, transparent 1px)`,
              backgroundSize: `${100 / n}% ${100 / n}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setV(true), io.disconnect()), { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-visible={v} className={cn("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Schematic sequential-isometry circuit: each site gets an isometry acting on itself + log2(χ) bond qubits. */
export function CircuitDiagram({ qubits = 10, chi = 2, className }: { qubits?: number; chi?: number; className?: string }) {
  const bond = Math.max(0, Math.log2(chi));
  const rowH = 18, w = 560, left = 44;
  const h = qubits * rowH + 12;
  const step = (w - left - 20) / qubits;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("w-full", className)} role="img" aria-label={`Schematic sequential isometry circuit, ${qubits} qubits, χ=${chi}`}>
      {Array.from({ length: qubits }, (_, i) => (
        <g key={i}>
          <text x={6} y={10 + i * rowH + 4} className="fill-muted-foreground font-mono" fontSize="9">q{i}</text>
          <line x1={left - 10} x2={w - 10} y1={10 + i * rowH} y2={10 + i * rowH} stroke="var(--color-border)" strokeWidth="1" />
        </g>
      ))}
      {Array.from({ length: qubits }, (_, k) => {
        const site = qubits - 1 - k;
        const span = Math.min(bond, qubits - 1 - site);
        const top = site;
        const x = left + k * step;
        const y = 10 + top * rowH - 7;
        const hh = span * rowH + 14;
        return (
          <g key={k}>
            <rect x={x} y={y} width={step - 8} height={hh} rx={3} fill="var(--color-primary-soft)" stroke="var(--color-primary)" strokeWidth="1" />
            <text x={x + (step - 8) / 2} y={y + hh / 2 + 3} textAnchor="middle" fontSize="8.5" className="fill-primary font-mono">V{site}</text>
            {span > 0 && <circle cx={x + step - 8} cy={y + hh / 2} r={2} fill="var(--color-cyan)" />}
          </g>
        );
      })}
    </svg>
  );
}
