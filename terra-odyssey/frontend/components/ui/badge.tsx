import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-semibold tracking-wide transition-colors uppercase font-mono",
  {
    variants: {
      variant: {
        default:
          "border-slate-700 bg-slate-800 text-slate-200",
        secondary:
          "border-slate-800 bg-slate-900 text-slate-400",
        supported:
          "border-emerald-500/40 bg-emerald-950/60 text-emerald-300",
        inconclusive:
          "border-amber-500/40 bg-amber-950/60 text-amber-300",
        ineligible:
          "border-rose-500/40 bg-rose-950/60 text-rose-300",
        exploratory:
          "border-purple-500/40 bg-purple-950/60 text-purple-300",
        regionA:
          "border-amber-500/60 bg-amber-950/80 text-amber-300",
        regionB:
          "border-cyan-500/60 bg-cyan-950/80 text-cyan-300",
        outline: "text-slate-300 border-slate-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
