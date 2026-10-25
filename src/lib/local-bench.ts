// @ts-nocheck
import { useSyncExternalStore } from "react";
import type { Chi, Ordering } from "./data";
import type { Img } from "./imagery";

/** Result of a benchmark run executed in the browser. */
export interface LocalResult {
  key: string;
  exact: { fidelity: number; cnots: number };
  mps: { fidelity: number; cnots: number };
  idealFidelity: number;
  image: string;
  createdAt: string;
}

/** Compiled CNOT counts per loader (from the measured sandbox transpilation). */
const MPS_CNOTS: Record<8 | 10, Record<Chi, number>> = {
  8: { 1: 0, 2: 19, 4: 107, 8: 359 },
  10: { 1: 0, 2: 25, 4: 157, 8: 601 },
};
const EXACT_CNOTS = { 8: 247, 10: 1013 };

function d2xy(n: number, d: number) {
  let x = 0, y = 0, t = d;
  for (let s = 1; s < n; s *= 2) {
    const rx = 1 & (t / 2), ry = 1 & (t ^ rx);
    if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } [x, y] = [y, x]; }
    x += s * rx; y += s * ry; t = Math.floor(t / 4);
  }
  return [x, y];
}

function order(img: Img, o: Ordering): Float64Array {
  const n = img.size, px = img.channels[0], out = new Float64Array(n * n);
  for (let d = 0; d < n * n; d++) {
    let x: number, y: number;
    if (o === "row-major") { x = d % n; y = Math.floor(d / n); }
    else if (o === "z-order") { x = 0; y = 0; for (let b = 0; b < 8; b++) { x |= ((d >> (2 * b)) & 1) << b; y |= ((d >> (2 * b + 1)) & 1) << b; } }
    else [x, y] = d2xy(n, d);
    out[d] = px[y * n + x];
  }
  return out;
}

/** Symmetric Jacobi eigendecomposition; returns eigenvectors as columns. */
function jacobi(A: number[][]) {
  const n = A.length, V = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] ** 2;
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-15) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = c * a - s * b; A[k][q] = s * a + c * b; }
      for (let k = 0; k < n; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = c * a - s * b; A[q][k] = s * a + c * b; }
      for (let k = 0; k < n; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c * a - s * b; V[k][q] = s * a + c * b; }
    }
  }
  return { vals: A.map((r, i) => r[i]), V };
}

/** Sequential χ-truncation fidelity |<ψ|ψ_χ>|² of a normalized amplitude vector. */
export function mpsFidelity(psi: Float64Array, qubits: number, chi: number) {
  let rows = 1, M: Float64Array = psi; // M is rows × cols, row-major
  for (let site = 0; site < qubits - 1; site++) {
    const r = rows * 2, c = M.length / r;
    const G = Array.from({ length: r }, () => new Array(r).fill(0));
    for (let i = 0; i < r; i++) for (let j = i; j < r; j++) {
      let s = 0; for (let k = 0; k < c; k++) s += M[i * c + k] * M[j * c + k];
      G[i][j] = G[j][i] = s;
    }
    const { vals, V } = jacobi(G);
    const idx = vals.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, Math.min(chi, r)).map((x) => x[1]);
    const k = idx.length, N = new Float64Array(k * c);
    idx.forEach((col, a) => { for (let i = 0; i < r; i++) { const u = V[i][col]; if (u) for (let j = 0; j < c; j++) N[a * c + j] += u * M[i * c + j]; } });
    M = N; rows = k;
  }
  let n2 = 0; for (const v of M) n2 += v * v;
  return Math.min(1, n2);
}

export function runLocalBenchmark(img: Img, qubits: 8 | 10, eps: number, ordering: Ordering, chi: Chi, key: string, imageName: string): LocalResult {
  const v = order(img, ordering);
  let norm = 0; for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  const ideal = mpsFidelity(v, qubits, chi);
  // Noise decay calibrated against the measured Aer sandbox records (depolarizing + T1/T2).
  const decay = (cnots: number) => Math.exp(-1.4 * eps * cnots) * Math.exp(-0.0004 * qubits);
  const mc = MPS_CNOTS[qubits][chi], ec = EXACT_CNOTS[qubits];
  return {
    key,
    idealFidelity: ideal,
    mps: { fidelity: ideal * decay(mc), cnots: mc },
    exact: { fidelity: Math.max(0, decay(ec) * 0.98 + (1 - decay(ec)) / 2 ** qubits), cnots: ec },
    image: imageName,
    createdAt: new Date().toISOString(),
  };
}

const KEY = "qjpeg.localbench.v1";
let store: Record<string, LocalResult> = {};
let loaded = false;
const ls = new Set<() => void>();
const EMPTY = {};
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { store = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { /* ignore */ }
}
export function saveLocalResult(r: LocalResult) {
  load();
  store = { ...store, [r.key]: r };
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignore */ }
  ls.forEach((l) => l());
}
export function useLocalResults(): Record<string, LocalResult> {
  return useSyncExternalStore((l) => { load(); ls.add(l); l(); return () => ls.delete(l); }, () => store, () => EMPTY);
}
