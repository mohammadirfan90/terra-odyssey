import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-cyan-600 text-white shadow hover:bg-cyan-500 active:bg-cyan-700",
        destructive:
          "bg-rose-600 text-white shadow-sm hover:bg-rose-500 active:bg-rose-700",
        outline:
          "border border-slate-700 bg-slate-800/80 text-slate-200 shadow-sm hover:bg-slate-700 hover:text-white",
        secondary:
          "bg-slate-800 text-slate-200 shadow-sm hover:bg-slate-700",
        ghost:
          "text-slate-300 hover:bg-slate-800 hover:text-white",
        link: "text-cyan-400 underline-offset-4 hover:underline",
        scientific:
          "border border-cyan-500/40 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60 hover:border-cyan-400",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 rounded px-2 text-xs",
        lg: "h-9 rounded-md px-4 text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
