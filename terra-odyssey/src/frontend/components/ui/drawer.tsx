"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  side?: "right" | "bottom";
  className?: string;
}

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "right",
  className,
}: DrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer content */}
      <div
        className={cn(
          "relative z-50 flex flex-col bg-slate-900 border-slate-800 text-slate-100 shadow-2xl transition-all duration-300",
          side === "right"
            ? "h-full w-full max-w-md border-l animate-in slide-in-from-right"
            : "w-full border-t max-h-[80vh] animate-in slide-in-from-bottom",
          className
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            {title && <h2 className="text-sm font-semibold tracking-wide text-slate-200">{title}</h2>}
            {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
