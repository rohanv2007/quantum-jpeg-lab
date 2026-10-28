import { useMemo, useSyncExternalStore } from "react";
import { DEFAULT_CONFIG, DEFAULT_NOISE, type Chi, type SimConfig } from "./data";
import { isChi, useResults, type RecordSource, type RecordStatus, type ResultRecord } from "./results";

export type RunStatus = RecordStatus;

/** A run is either a benchmark record from results.json (BR-) or a saved UI config (UI-). */
export interface Run {
  id: string;
  name: string;
  config: SimConfig;
  status: RunStatus;
  source: RecordSource;
  createdAt: string;
  note?: string;
  record?: ResultRecord;
}

const KEY = "qjpeg.saved.v2";

export function configFromRecord(r: ResultRecord): SimConfig {
  return {
    ...DEFAULT_CONFIG,
    source: r.image === "camera" ? "camera" : "upload",
    uploadName: r.image === "camera" ? undefined : r.image,
    mode: r.mode,
    resolution: r.qubits === 8 ? 16 : 32,
    ordering: r.ordering,
    chi: (isChi(r.chi) ? r.chi : 2) as Chi,
    noise: { ...DEFAULT_NOISE, epsCx: r.eps_cx },
  };
}

const runName = (c: SimConfig, image: string) =>
  `${image} ${c.resolution}×${c.resolution} · χ=${c.chi} · ${c.noise.epsCx === 0 ? "noiseless" : `εcx ${+(c.noise.epsCx * 100).toFixed(2)}%`}`;

let saved: Run[] = [];
let loaded = false;
const ls = new Set<() => void>();
const EMPTY: Run[] = [];
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { saved = (JSON.parse(localStorage.getItem(KEY) || "[]") as Run[]).filter((r) => r.status === "pending"); } catch { /* ignore */ }
}
function emit() {
  try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* ignore */ }
  ls.forEach((l) => l());
}

/** Save a configuration as pending (no values are attached). */
export function savePendingConfig(config: SimConfig) {
  load();
  const image = config.source === "camera" ? "camera" : config.uploadName ?? "upload";
  const dup = saved.find((r) => JSON.stringify(r.config) === JSON.stringify(config));
  if (dup) return dup;
  const nextId = Math.max(2000, ...saved.map((r) => Number(r.id.slice(3)) || 0)) + 1;
  const run: Run = { id: `UI-${nextId}`, name: runName(config, image), config, status: "pending", source: "ui-preview", createdAt: new Date().toISOString(), note: "Pending — benchmark not run" };
  saved = [run, ...saved];
  emit();
  return run;
}

export function removeSaved(id: string) {
  load();
  saved = saved.filter((r) => r.id !== id);
  emit();
}

function useSaved() {
  return useSyncExternalStore((l) => { load(); ls.add(l); l(); return () => ls.delete(l); }, () => saved, () => EMPTY);
}

/** All runs, newest first. */
export function useRuns(): { runs: Run[]; loading: boolean } {
  const res = useResults();
  const s = useSaved();
  const runs = useMemo(() => {
    const fromData: Run[] = res.records.map((r) => {
      const config = configFromRecord(r);
      return { id: r.id, name: runName(config, r.image), config, status: r.status, source: r.source, createdAt: r.timestamp ?? "", note: r.failure_reason ?? undefined, record: r };
    });
    return [...fromData, ...s].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [res.records, s]);
  return { runs, loading: res.status === "loading" };
}

export function fmtDate(iso: string) {
  if (!iso) return "Not recorded";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}
