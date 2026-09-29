/**
 * Shared theme state hook.
 *
 * Mirrors the `lib/state/investigation.ts` pattern: a module-scoped store
 * subscribed to via `useSyncExternalStore` so every consumer reads the same
 * value and re-renders when the user flips the theme.
 *
 * Three user-selectable values:
 *   • "light"  — always use the light palette
 *   • "dark"   — always use the dark NASA night-ops palette
 *   • "system" — follow `prefers-color-scheme: dark`
 *
 * The resolved value ("light" | "dark") is the canonical answer for any
 * non-React consumer (e.g. MapLibre basemap key) and for the inline script
 * in `app/layout.tsx`. The script reads localStorage and writes
 * `data-theme="light|dark"` on `<html>` before paint to avoid FOUC.
 *
 * Persistence: localStorage key `terra-odyssey:theme`.
 *
 * Cross-component updates also dispatch a `terra-odyssey:theme-change`
 * window event so any non-React consumer can react without subscribing to
 * the store directly.
 */

"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "terra-odyssey:theme";

/* ── module-scoped state ─────────────────────────────────────────────── */

let currentTheme: Theme = "light";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // localStorage unavailable — fall through
  }
  return "light";
}

function writeStoredTheme(t: Theme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, t);
  } catch {
    // ignore quota / privacy-mode errors
  }
}

/** System-preference resolver. Returns "dark" if the OS reports it. */
function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** Resolve a user theme to a concrete light/dark. SSR-safe (defaults to light). */
export function resolveTheme(t: Theme): ResolvedTheme {
  if (t === "light" || t === "dark") return t;
  return systemPrefersDark() ? "dark" : "light";
}

/* ── pub/sub ─────────────────────────────────────────────────────────── */

const listeners = new Set<() => void>();
function notify(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Theme {
  return currentTheme;
}

function getServerSnapshot(): Theme {
  // SSR rendering uses the default — the inline script in <head> will set
  // the real value before paint.
  return "light";
}

/* ── setter ──────────────────────────────────────────────────────────── */

export function setTheme(t: Theme): void {
  if (currentTheme === t) return;
  currentTheme = t;
  writeStoredTheme(t);
  notify();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<{ theme: Theme; resolved: ResolvedTheme }>(
        "terra-odyssey:theme-change",
        { detail: { theme: t, resolved: resolveTheme(t) } },
      ),
    );
  }
}

/** Non-subscribing access to the live theme value (used by Providers & maps). */
export function getTheme(): Theme {
  return currentTheme;
}

/** Hydrate the store from localStorage on first mount. Idempotent. */
export function hydrateTheme(): void {
  const stored = readStoredTheme();
  if (stored !== currentTheme) {
    currentTheme = stored;
    notify();
  }
}

/* ── React hook ──────────────────────────────────────────────────────── */

export interface ThemeApi {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (t: Theme) => void;
}

/**
 * Hook returning the current theme plus the resolved value and a setter.
 * The setter is stable (the underlying function never changes identity), so
 * consumers can safely put it in dependency arrays without churn.
 */
export function useTheme(): ThemeApi {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // resolveTheme reads matchMedia at call time; we re-evaluate on each
  // render so live system changes flip the workspace immediately.
  const resolvedTheme = resolveTheme(theme);
  return {
    theme,
    resolvedTheme,
    setTheme,
  };
}
