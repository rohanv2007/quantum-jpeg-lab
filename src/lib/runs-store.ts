import { useSyncExternalStore } from "react";
import { DEFAULT_CONFIG, DEFAULT_NOISE, type SimConfig } from "./data";

export type RunStatus = "complete" | "running" | "pending" | "failed";
export type RunKind = "benchmark" | "illustrative" | "saved";

export interface Run {
  id: string;
  name: string;
  config: SimConfig;
  status: RunStatus;
  kind: RunKind;
  createdAt: string;
  note?: string;
}

const KEY = "qjpeg.runs.v1";

const cfg = (p: Partial<SimConfig> & { eps?: number }): SimConfig => ({
  ...DEFAULT_CONFIG,
  ...p,
  noise: { ...DEFAULT_NOISE, epsCx: p.eps ?? DEFAULT_NOISE.epsCx },
});

const SEED: Run[] = [
  { id: "BR-1003", name: "Camera 32×32 · χ=2 · εcx 0.3%", config: cfg({ chi: 2, eps: 0.003 }), status: "complete", kind: "benchmark", createdAt: "2026-10-14T09:12:00Z" },
  { id: "BR-1004", name: "Camera 32×32 · χ=4 · εcx 0.8%", config: cfg({ chi: 4, eps: 0.008 }), status: "complete", kind: "benchmark", createdAt: "2026-10-14T09:40:00Z" },
  { id: "BR-1007", name: "Camera 16×16 · χ=8 · εcx 0.3%", config: cfg({ chi: 8, eps: 0.003, resolution: 16 }), status: "complete", kind: "benchmark", createdAt: "2026-10-14T10:05:00Z" },
  { id: "UI-2011", name: "Camera 32×32 · Z-order · χ=4", config: cfg({ chi: 4, ordering: "z-order" }), status: "pending", kind: "saved", createdAt: "2026-10-18T14:22:00Z", note: "Pending — benchmark not run" },
  { id: "UI-2014", name: "Camera 16×16 · χ=1 · εcx 1.5%", config: cfg({ chi: 1, eps: 0.015, resolution: 16 }), status: "failed", kind: "illustrative", createdAt: "2026-10-19T08:03:00Z", note: "Preview aborted: reset during transpilation stage." },
  { id: "UI-2019", name: "Camera 32×32 · Row-major · χ=2", config: cfg({ chi: 2, ordering: "row-major" }), status: "running", kind: "saved", createdAt: "2026-10-20T16:48:00Z", note: "Queued for the benchmark runner (run_all.py, not yet implemented)." },
];

let runs: Run[] = SEED;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) runs = JSON.parse(raw);
  } catch {
    /* ignore */
  }
}
function emit() {
  try { localStorage.setItem(KEY, JSON.stringify(runs)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function addRun(r: Omit<Run, "id" | "createdAt">) {
  load();
  const id = `UI-${2020 + runs.filter((x) => x.id.startsWith("UI")).length}`;
  const run: Run = { ...r, id, createdAt: new Date().toISOString() };
  runs = [run, ...runs];
  emit();
  return run;
}

export function useRuns() {
  return useSyncExternalStore(
    (l) => {
      load();
      listeners.add(l);
      l();
      return () => listeners.delete(l);
    },
    () => runs,
    () => SEED,
  );
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}
