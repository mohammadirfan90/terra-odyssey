"use client";

/**
 * ThemeSwitcher — segmented Light / Dark / System control.
 *
 * Reads/writes via the global `useTheme()` hook. Visual colors are driven
 * by the CSS variables defined in `app/globals.css` (`:root[data-theme="…"]`),
 * so the switcher itself needs no theme-specific styling — it just picks
 * up the active palette automatically.
 *
 * Used inside the MenuPanel footer. Hidden on screens narrower than the
 * `md` breakpoint by the parent container.
 */

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme, type Theme } from "@/lib/state/theme";
import { cn } from "@/lib/utils";

export interface ThemeSwitcherProps {
  className?: string;
  /** Optional override of the option label/visible text size. */
  size?: "sm" | "md";
}

const OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeSwitcher({ className, size = "sm" }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();
  const padding = size === "md" ? "px-2.5 py-1.5 text-[11px]" : "px-2 py-1 text-[10px]";
  const iconSize = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={cn(
        "inline-flex items-center rounded-lg border p-0.5",
        "border-[var(--border-default)] bg-[var(--bg-surface)]",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md font-semibold uppercase tracking-wider transition",
              padding,
              active
                ? "bg-[var(--bg-surface-2)] text-[var(--accent-fg)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]",
            )}
            title={`${label} theme`}
          >
            <Icon className={iconSize} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ThemeSwitcher;
