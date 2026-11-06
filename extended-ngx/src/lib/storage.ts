// Typed, defensive localStorage helpers. Every access is wrapped so that a
// disabled, full, or quota-limited store — or a value written by an older
// schema — degrades to the provided default instead of throwing during render.

export const STORAGE_KEYS = {
  columnVisibility: 'paperless_colvis',
  filterPresets: 'paperless_filter_presets',
} as const;

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / privacy-mode failures — persistence is a convenience,
    // not a correctness requirement.
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // no-op
  }
}
