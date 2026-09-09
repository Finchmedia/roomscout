/**
 * „Foto folgt vom Anbieter“ — the hatched stand-in for a listing without a
 * photo (ScreensB.jsx / ScreensC.jsx, SCOUT_SCREENS §10.2 / §14).
 *
 * The hatch is `--rs-white` at 5 % and 2 % through `color-mix`, so the pattern
 * stays on the token layer instead of carrying a literal colour.
 */

import type * as React from "react";
import { cn } from "@/lib/utils";

interface PhotoPlaceholderProps {
  className?: string;
  children: React.ReactNode;
}

const HATCH =
  "repeating-linear-gradient(135deg," +
  "color-mix(in srgb, var(--rs-white) 5%, transparent) 0 10px," +
  "color-mix(in srgb, var(--rs-white) 2%, transparent) 10px 20px)";

export function PhotoPlaceholder({ className, children }: PhotoPlaceholderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center font-mono text-[length:var(--text-micro-size)] text-rs-ink-6",
        className,
      )}
      style={{ background: HATCH }}
    >
      {children}
    </div>
  );
}
