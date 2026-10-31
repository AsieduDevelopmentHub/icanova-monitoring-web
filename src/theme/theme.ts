export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "icanova-theme";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function storage(): StorageLike | null {
  try {
    if (typeof localStorage === "undefined") {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
}

export function readStoredTheme(store: StorageLike | null = storage()): ThemeMode | null {
  if (!store) {
    return null;
  }
  try {
    const value = store.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark") {
      return value;
    }
  } catch {
    /* private mode / blocked storage */
  }
  return null;
}

/** Light is the product default. Stored preference wins when present. */
export function resolveTheme(stored: ThemeMode | null = readStoredTheme()): ThemeMode {
  return stored ?? "light";
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
}

export function persistTheme(mode: ThemeMode, store: StorageLike | null = storage()): void {
  applyTheme(mode);
  if (!store) {
    return;
  }
  try {
    store.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function toggleTheme(current: ThemeMode, store: StorageLike | null = storage()): ThemeMode {
  const next: ThemeMode = current === "light" ? "dark" : "light";
  persistTheme(next, store);
  return next;
}
