import { DEFAULT_CONFIG, type SimConfig } from "./data";

/** Hand-off for "Duplicate configuration" and saved defaults into the workbench. */
let draft: SimConfig | null = null;
export const setDraftConfig = (c: SimConfig) => (draft = structuredClone(c));
export const takeDraftConfig = (): SimConfig | null => {
  const d = draft;
  draft = null;
  return d;
};

const DEF_KEY = "qjpeg.defaults.v1";
export function loadDefaults(): SimConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(DEF_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}
export const saveDefaults = (c: SimConfig) => localStorage.setItem(DEF_KEY, JSON.stringify(c));
