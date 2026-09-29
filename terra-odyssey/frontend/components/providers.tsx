"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgentationWrapper } from "@/components/AgentationWrapper";
import {
  hydrateTheme,
  type ResolvedTheme,
} from "@/lib/state/theme";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Hydrate the theme store from localStorage and keep
  // <html data-theme="…"> in sync. Also listens for OS-level preference
  // changes so "system" mode tracks them without a reload.
  React.useEffect(() => {
    hydrateTheme();
    const apply = (resolved: ResolvedTheme) => {
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", resolved);
      }
    };
    // The inline bootstrap script in <head> already set the correct
    // data-theme before paint. We don't need to reapply on every mount —
    // just rely on the theme-change event for user-initiated flips and
    // the matchMedia listener for "system" mode tracking.
    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      try {
        const raw = window.localStorage.getItem("terra-odyssey:theme");
        if (raw === null || raw === "system") {
          apply(mql?.matches ? "dark" : "light");
        }
      } catch {
        /* ignore */
      }
    };
    const onThemeEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ resolved: ResolvedTheme }>).detail;
      if (detail?.resolved) apply(detail.resolved);
    };
    mql?.addEventListener?.("change", onSystemChange);
    window.addEventListener("terra-odyssey:theme-change", onThemeEvent);
    return () => {
      mql?.removeEventListener?.("change", onSystemChange);
      window.removeEventListener("terra-odyssey:theme-change", onThemeEvent);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <AgentationWrapper />
    </QueryClientProvider>
  );
}
