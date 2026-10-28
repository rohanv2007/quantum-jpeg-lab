import { useSyncExternalStore } from "react";
import type { Chi, Ordering, SimConfig } from "./data";

/**
 * Typed loader for /data/results.json. Every benchmark number shown in the app
 * comes from this file — drop in a new results.json and the UI updates.
 * Any missing/null field renders as "Pending".
 */
export type RecordSource = "benchmark" | "ui-preview";
export type RecordStatus = "complete" | "pending" | "failed";

export interface Spectrum {
  /** singular values per bond cut, index 0 = first cut */
  cuts: number[][];
  /** von Neumann entropy per bond (optional; computed from cuts when absent) */
  entropy?: number[];
}

export interface ResultRecord {
  id: string;
  source: RecordSource;
  status: RecordStatus;
  image: string;
  mode: "grayscale" | "rgb";
  qubits: number;
  ordering: Ordering;
  chi: number;
  eps_cx: number;
  exact_cnots?: number | null;
  mps_cnots?: number | null;
  ideal_fidelity_mps?: number | null;
  noisy_fidelity_exact?: number | null;
  noisy_fidelity_mps?: number | null;
  circuit_depth_exact?: number | null;
  circuit_depth_mps?: number | null;
  oneq_gates_exact?: number | null;
  oneq_gates_mps?: number | null;
  duration_ns_exact?: number | null;
  duration_ns_mps?: number | null;
  classical_fidelity_mps?: number | null;
  psnr?: number | null;
  ssim?: number | null;
  circuit_check?: number | null;
  qiskit_version?: string | null;
  aer_version?: string | null;
  seed?: number | null;
  commit_hash?: string | null;
  runner?: string | null;
  qasm_path?: string | null;
  timestamp?: string | null;
  failure_reason?: string | null;
  images?: { original?: string; exact?: string; mps?: string; mps_by_chi?: Partial<Record<string, string>> } | null;
  spectra?: Partial<Record<Ordering, Spectrum>> | null;
}

export interface ResultsState {
  status: "loading" | "ready" | "error";
  records: ResultRecord[];
  meta: { generated_at?: string; note?: string };
  error?: string;
}

const LOADING: ResultsState = { status: "loading", records: [], meta: {} };
let state: ResultsState = LOADING;
let started = false;
const ls = new Set<() => void>();

/** Accepts `{ records: [...] }` or a bare array; drops malformed rows instead of crashing. */
export function parseResults(raw: unknown): Pick<ResultsState, "records" | "meta"> {
  const obj = (raw ?? {}) as { records?: unknown; generated_at?: string; note?: string };
  const arr = Array.isArray(raw) ? raw : Array.isArray(obj.records) ? obj.records : [];
  const records = arr.filter(
    (r): r is ResultRecord =>
      !!r && typeof r === "object" && typeof (r as ResultRecord).id === "string" && typeof (r as ResultRecord).qubits === "number",
  ).map((r) => ({ source: "benchmark", status: "complete", image: "camera", mode: "grayscale", ordering: "hilbert", eps_cx: 0, chi: 1, ...r }) as ResultRecord);
  return { records, meta: Array.isArray(raw) ? {} : { generated_at: obj.generated_at, note: obj.note } };
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  fetch("/data/results.json", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((j) => { state = { status: "ready", ...parseResults(j) }; })
    .catch((e) => { state = { status: "error", records: [], meta: {}, error: String(e?.message ?? e) }; })
    .finally(() => ls.forEach((l) => l()));
}

export function useResults(): ResultsState {
  return useSyncExternalStore(
    (l) => { ls.add(l); start(); return () => ls.delete(l); },
    () => state,
    () => LOADING,
  );
}

export const num = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
const eq = (a: number, b: number) => Math.abs(a - b) < 1e-9;

export interface Query { qubits: number; ordering: Ordering; chi: number; eps: number; image?: string; mode?: string }

export function findRecord(records: ResultRecord[], q: Query) {
  return records.find(
    (r) => r.qubits === q.qubits && r.ordering === q.ordering && r.chi === q.chi && eq(r.eps_cx, q.eps) &&
      (!q.image || r.image === q.image) && (!q.mode || r.mode === q.mode),
  );
}

/** Noiseless record for the same image/ordering/χ (source of ideal fidelity & circuit check). */
export function findNoiseless(records: ResultRecord[], q: Omit<Query, "eps">) {
  return findRecord(records, { ...q, eps: 0 });
}

export const recordKey = (q: { qubits: number; ordering: string; chi: number; eps: number }) => `${q.qubits}-${q.eps}-${q.ordering}-${q.chi}`;

export type M = { value: number; measured: true } | { measured: false };
const P = { measured: false } as const;
const m = (v: number | null | undefined): M => (num(v) ? { value: v, measured: true } : P);

export interface Metrics {
  record?: ResultRecord;
  noiseless?: ResultRecord;
  exactCnots: M; mpsCnots: M;
  exactNoisyF: M; mpsNoisyF: M; mpsIdealF: M;
  exactDepth: M; mpsDepth: M;
  exactOneQ: M; mpsOneQ: M;
  exactDuration: M; mpsDuration: M;
  classicalF: M; circuitCheck: M; psnr: M; ssim: M;
  anyMeasured: boolean;
}

/** Map a UI config to measured values; anything absent is Pending. */
export function metricsFor(records: ResultRecord[], c: Pick<SimConfig, "resolution" | "ordering" | "chi" | "mode" | "source"> & { noise: { epsCx: number } }): Metrics {
  const qubits = c.resolution === 16 ? 8 : 10;
  const q = { qubits, ordering: c.ordering, chi: c.chi, image: c.source === "camera" ? "camera" : "__upload__", mode: c.mode };
  const rec = findRecord(records, { ...q, eps: c.noise.epsCx });
  const nl = findNoiseless(records, q);
  return fromRecord(rec, nl);
}

export function fromRecord(rec?: ResultRecord, nl?: ResultRecord): Metrics {
  const pick = (k: keyof ResultRecord) => (num(rec?.[k] as number) ? (rec![k] as number) : (nl?.[k] as number | undefined));
  const out: Metrics = {
    record: rec, noiseless: nl,
    exactCnots: m(pick("exact_cnots")), mpsCnots: m(pick("mps_cnots")),
    exactNoisyF: m(rec && rec.eps_cx > 0 ? rec.noisy_fidelity_exact : undefined),
    mpsNoisyF: m(rec && rec.eps_cx > 0 ? rec.noisy_fidelity_mps : undefined),
    mpsIdealF: m(pick("ideal_fidelity_mps")),
    exactDepth: m(pick("circuit_depth_exact")), mpsDepth: m(pick("circuit_depth_mps")),
    exactOneQ: m(pick("oneq_gates_exact")), mpsOneQ: m(pick("oneq_gates_mps")),
    exactDuration: m(pick("duration_ns_exact")), mpsDuration: m(pick("duration_ns_mps")),
    classicalF: m(rec?.classical_fidelity_mps), circuitCheck: m(pick("circuit_check")),
    psnr: m(rec?.psnr), ssim: m(rec?.ssim),
    anyMeasured: false,
  };
  out.anyMeasured = [out.exactCnots, out.mpsCnots, out.exactNoisyF, out.mpsNoisyF, out.mpsIdealF].some((x) => x.measured);
  return out;
}

export const isChi = (n: number): n is Chi => n === 1 || n === 2 || n === 4 || n === 8;

export function reproduceCommand(r: Pick<ResultRecord, "image" | "qubits" | "ordering" | "chi" | "eps_cx" | "seed">) {
  return `python run_all.py --image ${r.image} --n ${r.qubits} --ordering ${r.ordering} --chi ${r.chi} --eps ${r.eps_cx} --seed ${r.seed ?? "<seed>"}`;
}

export function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set<string>()));
  const cell = (v: unknown) => { const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}

/** Entropy per bond from singular values. */
export function entropyFromCut(sv: number[]) {
  const p = sv.map((s) => s * s); const z = p.reduce((a, b) => a + b, 0) || 1;
  return -p.reduce((a, x) => (x > 0 ? a + (x / z) * Math.log2(x / z) : a), 0);
}
