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
  aer: "not recorded",
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

export const NOISE_PRESETS: { label: string; epsCx: number }[] = [
  { label: "Noiseless", epsCx: 0 },
  { label: "εcx 0.1%", epsCx: 0.001 },
  { label: "εcx 0.3%", epsCx: 0.003 },
  { label: "εcx 0.8%", epsCx: 0.008 },
  { label: "εcx 1.5%", epsCx: 0.015 },
];

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

/** Records in results.json assume the documented noise timings and transpilation settings. */
export function matchesRecordedSettings(c: SimConfig) {
  return (
    c.basis.replace(/\s/g, "") === ENV.basis.replace(/\s/g, "") &&
    c.optimizationLevel === 1 &&
    c.noise.t1 === DEFAULT_NOISE.t1 &&
    c.noise.t2 === DEFAULT_NOISE.t2 &&
    c.noise.cxDuration === DEFAULT_NOISE.cxDuration &&
    c.noise.oneQDuration === DEFAULT_NOISE.oneQDuration
  );
}

export const fmtEps = (e: number) => `${+(e * 100).toFixed(2)}%`;
export const orderingLabel = (o: Ordering) => ORDERINGS.find((x) => x.value === o)!.label;
