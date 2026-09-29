import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-semibold tracking-wide transition-colors uppercase font-mono",
  {
    variants: {
      variant: {
        default:
          "border-slate-200 bg-slate-100 text-slate-800",
        secondary:
          "border-slate-200 bg-slate-50 text-slate-600",
        supported:
          "border-emerald-300 bg-emerald-50 text-emerald-800",
        inconclusive:
          "border-amber-300 bg-amber-50 text-amber-800",
        ineligible:
          "border-rose-300 bg-rose-50 text-rose-800",
        exploratory:
          "border-purple-300 bg-purple-50 text-purple-800",
        regionA:
          "border-amber-300 bg-amber-50 text-amber-800",
        regionB:
          "border-cyan-300 bg-cyan-50 text-cyan-800",
        outline: "text-slate-700 border-slate-300 bg-white",
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
