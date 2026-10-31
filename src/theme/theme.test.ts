import { describe, expect, it } from "vitest";
import { persistTheme, readStoredTheme, resolveTheme, toggleTheme } from "./theme";

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
  };
}

describe("theme", () => {
  it("defaults to light when nothing is stored", () => {
    expect(resolveTheme(null)).toBe("light");
    expect(resolveTheme(readStoredTheme(memoryStore()))).toBe("light");
  });

  it("persists and reads theme preference", () => {
    const store = memoryStore();
    persistTheme("dark", store);
    expect(readStoredTheme(store)).toBe("dark");
    expect(resolveTheme(readStoredTheme(store))).toBe("dark");
  });

  it("toggles between light and dark", () => {
    const store = memoryStore();
    expect(toggleTheme("light", store)).toBe("dark");
    expect(readStoredTheme(store)).toBe("dark");
    expect(toggleTheme("dark", store)).toBe("light");
    expect(readStoredTheme(store)).toBe("light");
  });
});
