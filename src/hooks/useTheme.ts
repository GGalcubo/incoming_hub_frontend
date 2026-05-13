import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "proxy:theme";

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

function systemPref(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? systemPref() : mode;
}

export function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolved;
}

/**
 * Sync theme application before React mounts so there is no flash.
 * Safe to call multiple times.
 */
export function bootstrapTheme() {
  applyTheme(resolveTheme(readStored()));
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(readStored);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(readStored()));

  useEffect(() => {
    const r = resolveTheme(mode);
    setResolved(r);
    applyTheme(r);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const r: ResolvedTheme = mql.matches ? "light" : "dark";
      setResolved(r);
      applyTheme(r);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mode]);

  return { mode, setMode: setModeState, resolved };
}
