/**
 * The narrow-stage bottom sheet (ScreensA.jsx `BottomSheet`, SCOUT_SCREENS §4.4).
 *
 * Two shapes, both on the DS `Sheet`:
 *   · `pill` — the collapsed „5 Wünsche gemerkt“ strip in Discovery; the title
 *     row is the disclosure and the facts expand inside it.
 *   · `card` — the full-bleed „Euer Suchauftrag“ review card in Brief.
 *
 * It is part of the stage, not a modal: no scrim, no focus trap, no dismissal.
 * The kit renders it as an in-stage layer, and a sheet that steals focus the
 * moment the Scout remembers a wish would interrupt the conversation.
 */

import * as React from "react";
import { Icon } from "@/components/ui/icon";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface StageSheetProps {
  title: string;
  /** `card` renders a static title; `pill` renders the disclosure row. */
  variant: "card" | "pill";
  /** Disclosure state of the `pill` variant. */
  open?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}

export function StageSheet({ title, variant, open, onToggle, children }: StageSheetProps) {
  return (
    <Sheet open modal={false}>
      <SheetContent
        side="bottom"
        variant={variant}
        showOverlay={false}
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <SheetHeader>
          {variant === "card" ? (
            <SheetTitle>{title}</SheetTitle>
          ) : (
            <button
              type="button"
              aria-expanded={open}
              onClick={onToggle}
              className="flex w-full cursor-pointer items-center justify-between gap-[var(--space-5)] px-[var(--space-1)] py-[var(--space-2)] text-left"
            >
              <SheetTitle asChild>
                <span>{title}</span>
              </SheetTitle>
              <Icon
                name="chevron-up"
                size={16}
                className={cn(
                  "transition-transform duration-(--duration-quick) ease-out-soft",
                  open && "rotate-180",
                )}
              />
            </button>
          )}
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
