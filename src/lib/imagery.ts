// Typed-array pixel loops: indices are bounds-checked by construction.
// @ts-nocheck
/** Image utilities. All "reconstructions" here are illustrative previews, never Aer output. */
export interface Img {
  size: number;
  channels: Float32Array[]; // 1 (gray) or 3 (rgb), values 0..1
}

const HI = 128;

/** Procedural camera-like grayscale scene (stand-in sample tile, not the skimage asset). */
function hiResScene(): Float32Array {
  const a = new Float32Array(HI * HI);
  for (let y = 0; y < HI; y++) {
    for (let x = 0; x < HI; x++) {
      const u = x / HI, v = y / HI;
      let p = 0.78 - v * 0.25 + Math.sin(u * 3) * 0.03; // sky
      if (v > 0.72) p = 0.55 - (v - 0.72) * 0.6 + Math.sin(u * 40 + v * 30) * 0.03; // ground
      // distant buildings
      if (v > 0.6 && v < 0.72 && ((u > 0.05 && u < 0.14) || (u > 0.78 && u < 0.84))) p = 0.62;
      // figure: head
      const hx = u - 0.42, hy = v - 0.24;
      if (hx * hx + hy * hy < 0.0065) p = 0.1;
      // body
      if (v > 0.3 && v < 0.8) {
        const half = 0.07 + (v - 0.3) * 0.22;
        if (Math.abs(u - 0.41) < half) p = 0.08 + (u - 0.41) * 0.2;
      }
      // camera on tripod
      if (u > 0.5 && u < 0.62 && v > 0.3 && v < 0.38) p = 0.18;
      const leg = (x0: number, x1: number) => {
        const t = (v - 0.38) / 0.5;
        if (t < 0 || t > 1) return false;
        return Math.abs(u - (x0 + (x1 - x0) * t)) < 0.006;
      };
      if (leg(0.56, 0.48) || leg(0.56, 0.66) || leg(0.56, 0.57)) p = 0.15;
      a[y * HI + x] = Math.max(0, Math.min(1, p));
    }
  }
  return a;
}

function downsample(src: Float32Array, srcSize: number, size: number) {
  const out = new Float32Array(size * size);
  const f = srcSize / size;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let s = 0;
      for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) s += src[(y * f + j) * srcSize + x * f + i];
      out[y * size + x] = s / (f * f);
    }
  return out;
}

let sceneCache: Float32Array | null = null;
export function sampleImage(size: number, rgb = false): Img {
  sceneCache ??= hiResScene();
  const g = downsample(sceneCache, HI, size);
  if (!rgb) return { size, channels: [g] };
  // gentle warm/cool tint so RGB channels differ slightly
  const r = g.map((v, i) => Math.min(1, v * (i < (size * size) / 1.4 ? 0.92 : 1.05)));
  const b = g.map((v, i) => Math.min(1, v * (i < (size * size) / 1.4 ? 1.06 : 0.85)));
  return { size, channels: [r, g, b] };
}

export async function imageFromFile(file: File, size: number, rgb: boolean): Promise<Img> {
  const url = URL.createObjectURL(file);
  try {
    const el = new Image();
    await new Promise<void>((res, rej) => {
      el.onload = () => res();
      el.onerror = () => rej(new Error("This file could not be decoded as an image."));
      el.src = url;
    });
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d")!;
    const s = Math.min(el.width, el.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(el, (el.width - s) / 2, (el.height - s) / 2, s, s, 0, 0, size, size);
    const d = ctx.getImageData(0, 0, size, size).data;
    const n = size * size;
    const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), Y = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      R[i] = d[i * 4] / 255; G[i] = d[i * 4 + 1] / 255; B[i] = d[i * 4 + 2] / 255;
      Y[i] = 0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i];
    }
    return { size, channels: rgb ? [R, G, B] : [Y] };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function rand(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * Illustrative degradation: blend toward the uniform (maximally mixed) image by (1 − F),
 * plus block smoothing for low χ. Visual aid only.
 */
export function illustrate(img: Img, opts: { fidelity: number; blockiness: number; seed: number }): Img {
  const { size } = img;
  const r = rand(opts.seed);
  const channels = img.channels.map((ch) => {
    let src = ch;
    if (opts.blockiness > 1) {
      const b = opts.blockiness;
      src = new Float32Array(ch.length);
      for (let y = 0; y < size; y += b)
        for (let x = 0; x < size; x += b) {
          let s = 0, c = 0;
          for (let j = 0; j < b && y + j < size; j++) for (let i = 0; i < b && x + i < size; i++) { s += ch[(y + j) * size + x + i]; c++; }
          for (let j = 0; j < b && y + j < size; j++) for (let i = 0; i < b && x + i < size; i++) src[(y + j) * size + x + i] = 0.55 * (s / c) + 0.45 * ch[(y + j) * size + x + i];
        }
    }
    const mean = src.reduce((a, b) => a + b, 0) / src.length;
    const f = Math.max(0, Math.min(1, opts.fidelity));
    return src.map((v) => Math.max(0, Math.min(1, f * v + (1 - f) * mean + (r() - 0.5) * (1 - f) * 0.5)));
  });
  return { size, channels };
}

export function difference(a: Img, b: Img): Img {
  const n = a.size * a.size;
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    a.channels.forEach((ch, c) => (s += Math.abs(ch[i] - (b.channels[c] ?? b.channels[0])[i])));
    d[i] = Math.min(1, (s / a.channels.length) * 2.5);
  }
  return { size: a.size, channels: [d] };
}
