import type * as React from "react";
import { Wordmark, type WordmarkSize } from "@/components/ui/wordmark";
import { cn } from "@/lib/utils";

interface BrandLockupProps {
  className?: string;
  size?: WordmarkSize;
  suffix?: React.ReactNode;
}

const LOGO_SIZE: Record<WordmarkSize, string> = {
  sm: "size-5",
  md: "size-6",
  default: "size-6",
  xl: "size-9",
};

/** The existing RoomScout cube beside the canonical lowercase wordmark. */
export function BrandLockup({ className, size = "default", suffix }: BrandLockupProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img aria-hidden="true" alt="" className={cn("shrink-0 object-contain", LOGO_SIZE[size])} src="/logo.png" />
      <Wordmark as="span" size={size} />
      {suffix}
    </span>
  );
}

export type { BrandLockupProps };
