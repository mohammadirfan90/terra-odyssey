"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SPRING_GLIDE = { stiffness: 700, damping: 50, mass: 0.5 } as const;

export interface RangeSliderProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  showTicks?: boolean;
  disabled?: boolean;
  className?: string;
  /** Override the track container classes. */
  trackClassName?: string;
  /** Override the filled portion classes. */
  fillClassName?: string;
  /** Override the thumb classes. */
  thumbClassName?: string;
  /** Override the tick dot classes. */
  tickClassName?: string;
  "aria-label"?: string;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export function RangeSlider({
  value,
  defaultValue = 0,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  showTicks = true,
  disabled = false,
  className,
  trackClassName,
  fillClassName,
  thumbClassName,
  tickClassName,
  "aria-label": ariaLabel,
}: RangeSliderProps) {
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [internal, setInternal] = useState(defaultValue);
  const [active, setActive] = useState(false);

  const controlled = value !== undefined;
  const current = clamp(controlled ? value : internal, min, max);
  const percent = ((current - min) / (max - min)) * 100;

  const target = useMotionValue(percent);

  useEffect(() => {
    target.set(percent);
  }, [percent, target]);

  const smooth = useSpring(target, SPRING_GLIDE);
  const pos = reduce ? target : smooth;
  const left = useMotionTemplate`${pos}%`;
  const thumbX = useTransform(pos, (p) => `${-p}%`);

  const steps = Math.floor((max - min) / step);

  const ticks =
    showTicks && steps > 0 && steps <= 50
      ? Array.from({ length: steps + 1 }, (_, i) => min + i * step)
      : [];

  const commit = useCallback(
    (next: number) => {
      const snapped = clamp(
        Math.round((next - min) / step) * step + min,
        min,
        max,
      );

      if (!controlled) setInternal(snapped);

      onValueChange?.(snapped);
    },
    [controlled, onValueChange, min, max, step],
  );

  const valueFromX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();

      if (!rect) return current;

      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);

      return min + ratio * (max - min);
    },
    [current, min, max],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (disabled) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      setActive(true);
      commit(valueFromX(event.clientX));
    },
    [disabled, commit, valueFromX],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!active || disabled) return;

      commit(valueFromX(event.clientX));
    },
    [active, disabled, commit, valueFromX],
  );

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setActive(false);
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      const map: Record<string, number> = {
        ArrowRight: current + step,
        ArrowUp: current + step,
        ArrowLeft: current - step,
        ArrowDown: current - step,
        Home: min,
        End: max,
      };

      if (event.key in map) {
        event.preventDefault();
        commit(map[event.key]);
      }
    },
    [disabled, current, step, min, max, commit],
  );

  // Default iOS-style aesthetics: thin gray track, cyan filled portion,
  // large white circle thumb with cyan border, visible dot ticks.
  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn(
        // Track container — minimal height so the thin progress strip hugs
        // the row. Base track is transparent so only the cyan-filled portion
        // shows.
        "relative h-4 w-full touch-none select-none rounded-full bg-transparent",
        disabled
          ? "pointer-events-none opacity-40"
          : "cursor-pointer",
        className,
        trackClassName,
      )}
    >
      {/* Filled portion (left of thumb) — thin underline-style progress strip */}
      <motion.div
        className={cn(
          "absolute left-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-cyan-500/60",
          fillClassName,
        )}
        style={{ width: left }}
      />

      {/* Dot ticks */}
      {ticks.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 inset-y-0">
          {ticks.map((t) => {
            const tp = ((t - min) / (max - min)) * 100;
            return (
              <span
                key={t}
                className={cn(
                  "absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400 ring-1 ring-white/70",
                  tickClassName,
                )}
                style={{ left: `${tp}%` }}
              />
            );
          })}
        </div>
      )}

      {/* Thumb — invisible (kept in DOM for keyboard accessibility + ARIA).
          The motion-animated fill bar already shows the position visually. */}
      <motion.div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        className={cn(
          "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-cyan-500 bg-white opacity-0",
          thumbClassName,
        )}
        style={{ left, x: thumbX }}
      />
    </div>
  );
}
