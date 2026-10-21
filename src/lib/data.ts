export type Ordering = "row-major" | "z-order" | "hilbert";
export type Chi = 1 | 2 | 4 | 8;
export type Resolution = 16 | 32;
export type ImageMode = "grayscale" | "rgb";

export const ORDERINGS: { value: Ordering; label: string }[] = [
  { value: "row-major", label: "Row-major" },
  { value: "z-order", label: "Z-order (Morton)" },
  { value: "hilbert", label: "Hilbert" },
];
export const CHIS: Chi[] = [1, 2, 4, 8];
export const EPS_VALUES = [0.001, 0.003, 0.008, 0.015];

export const ENV = {
  qiskit: "2.6",
  aer: "Not recorded in sandbox run — Pending",
  basis: "rz, sx, x, cx",
  optimizationLevel: 1,
  image: "skimage.data.camera (area-downsampled)",
  method: "AerSimulator(method=\"density_matrix\")",
};

export const PROVENANCE_LABEL =
  "Earlier sandbox run · Qiskit 2.6 · single camera image · Hilbert ordering · reproduce before relying";

export interface NoiseConfig {
  epsCx: number; // depolarizing probability on cx
  t1: number; // µs
  t2: number; // µs
  cxDuration: number; // ns
  oneQDuration: number; // ns
}

export const DEFAULT_NOISE: NoiseConfig = {
  epsCx: 0.003,
  t1: 150,
  t2: 100,
  cxDuration: 300,
  oneQDuration: 35,
};

export const NOISE_PRESETS: { label: string; epsCx: number; measured: boolean }[] = [
  { label: "Noiseless", epsCx: 0, measured: true },
  { label: "εcx 0.1%", epsCx: 0.001, measured: false },
  { label: "εcx 0.3%", epsCx: 0.003, measured: true },
  { label: "εcx 0.8%", epsCx: 0.008, measured: true },
  { label: "εcx 1.5%", epsCx: 0.015, measured: false },
];

/** Preliminary noisy measurements — the ONLY noisy values in the app. */
export interface NoisyRecord {
  qubits: 8 | 10;
  epsCx: number;
  exact: { fidelity: number; cnots: number };
  mps: Partial<Record<Chi, { fidelity: number; cnots: number }>>;
}

export const NOISY_RECORDS: NoisyRecord[] = [
  {
    qubits: 10,
    epsCx: 0.003,
    exact: { fidelity: 0.0056, cnots: 1013 },
    mps: { 2: { fidelity: 0.8464, cnots: 25 }, 4: { fidelity: 0.5134, cnots: 157 }, 8: { fidelity: 0.103, cnots: 601 } },
  },
  {
    qubits: 10,
    epsCx: 0.008,
    exact: { fidelity: 0.0013, cnots: 1013 },
    mps: { 2: { fidelity: 0.7582, cnots: 25 }, 4: { fidelity: 0.2769, cnots: 157 }, 8: { fidelity: 0.0213, cnots: 601 } },
  },
  {
    qubits: 8,
    epsCx: 0.003,
    exact: { fidelity: 0.2501, cnots: 247 },
    mps: { 2: { fidelity: 0.8807, cnots: 19 }, 4: { fidelity: 0.629, cnots: 107 }, 8: { fidelity: 0.2479, cnots: 359 } },
  },
  {
    qubits: 8,
    epsCx: 0.008,
    exact: { fidelity: 0.0958, cnots: 247 },
    mps: { 2: { fidelity: 0.8096, cnots: 19 }, 4: { fidelity: 0.4103, cnots: 107 }, 8: { fidelity: 0.0812, cnots: 359 } },
  },
];

/** Noiseless measurements, n=10, camera 32×32, Hilbert. */
export const NOISELESS_N10: Record<Chi, { cnots: number; idealFidelity: number }> = {
  1: { cnots: 0, idealFidelity: 0.827 },
  2: { cnots: 25, idealFidelity: 0.951 },
  4: { cnots: 157, idealFidelity: 0.976 },
  8: { cnots: 601, idealFidelity: 0.995 },
};

export const qubitsFor = (r: Resolution) => (r === 16 ? 8 : 10) as 8 | 10;

export interface SimConfig {
  source: "camera" | "upload";
  uploadName?: string;
  mode: ImageMode;
  resolution: Resolution;
  ordering: Ordering;
  chi: Chi;
  noise: NoiseConfig;
  basis: string;
  optimizationLevel: number;
}

export const DEFAULT_CONFIG: SimConfig = {
  source: "camera",
  mode: "grayscale",
  resolution: 32,
  ordering: "hilbert",
  chi: 2,
  noise: DEFAULT_NOISE,
  basis: ENV.basis,
  optimizationLevel: 1,
};

export type Measured<T> = { value: T; measured: true } | { measured: false };

export interface ResolvedMetrics {
  /** true when a noisy record exactly matches */
  noisyMatch: boolean;
  anyMeasured: boolean;
  exactCnots: Measured<number>;
  mpsCnots: Measured<number>;
  exactNoisyF: Measured<number>;
  mpsNoisyF: Measured<number>;
  mpsIdealF: Measured<number>;
  circuitVsMps: Measured<number>;
  psnr: Measured<number>;
  ssim: Measured<number>;
}

const P = { measured: false } as const;
const M = <T,>(value: T) => ({ value, measured: true }) as const;

const eq = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** Whether the non-εcx settings match the documented sandbox conditions. */
export function matchesSandboxConditions(c: SimConfig) {
  return (
    c.source === "camera" &&
    c.mode === "grayscale" &&
    c.ordering === "hilbert" &&
    c.basis.replace(/\s/g, "") === ENV.basis.replace(/\s/g, "") &&
    c.optimizationLevel === 1
  );
}

const noiseDefaults = (n: NoiseConfig) =>
  n.t1 === DEFAULT_NOISE.t1 &&
  n.t2 === DEFAULT_NOISE.t2 &&
  n.cxDuration === DEFAULT_NOISE.cxDuration &&
  n.oneQDuration === DEFAULT_NOISE.oneQDuration;

export function findNoisyRecord(qubits: number, epsCx: number) {
  return NOISY_RECORDS.find((r) => r.qubits === qubits && eq(r.epsCx, epsCx));
}

export function resolveMetrics(c: SimConfig): ResolvedMetrics {
  const q = qubitsFor(c.resolution);
  const base = matchesSandboxConditions(c);
  const out: ResolvedMetrics = {
    noisyMatch: false,
    anyMeasured: false,
    exactCnots: P,
    mpsCnots: P,
    exactNoisyF: P,
    mpsNoisyF: P,
    mpsIdealF: P,
    circuitVsMps: P,
    psnr: P,
    ssim: P,
  };
  if (!base) return out;

  if (q === 10) {
    out.exactCnots = M(1013);
    out.mpsCnots = M(NOISELESS_N10[c.chi].cnots);
    out.mpsIdealF = M(NOISELESS_N10[c.chi].idealFidelity);
    out.circuitVsMps = M(1.0);
    out.anyMeasured = true;
  }
  const rec = noiseDefaults(c.noise) ? findNoisyRecord(q, c.noise.epsCx) : undefined;
  if (rec) {
    out.exactCnots = M(rec.exact.cnots);
    out.exactNoisyF = M(rec.exact.fidelity);
    out.anyMeasured = true;
    const m = rec.mps[c.chi];
    if (m) {
      out.mpsCnots = M(m.cnots);
      out.mpsNoisyF = M(m.fidelity);
      out.noisyMatch = true;
    }
  }
  return out;
}

export const fmtEps = (e: number) => `${+(e * 100).toFixed(2)}%`;
export const orderingLabel = (o: Ordering) => ORDERINGS.find((x) => x.value === o)!.label;
