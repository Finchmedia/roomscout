/**
 * The arrival toast (App.jsx `notify` / `toast`, SCOUT_SCREENS §2.7).
 *
 * It only ever fires while the user is away from the Scout — in Settings or in
 * the Operator view — and it never expires: DECISIONS.md item 29 pins it to
 * sonner `duration: Infinity`, dismissed by the X or by „Zum Scout“.
 *
 * Renders nothing itself; the `<Toaster />` lives on the page.
 */

import * as React from "react";
import { showToast } from "@/components/ui/sonner";
import { toast as sonnerToast } from "sonner";
import { useCopy } from "@/ui/copy";
import type { StringCopyKey } from "@/ui/copy";

interface ScoutToastProps {
  toast: { readonly id: number; readonly key: StringCopyKey } | null;
  onAction: () => void;
  onDismiss: () => void;
}

export function ScoutToast({ toast, onAction, onDismiss }: ScoutToastProps) {
  const { t } = useCopy();

  // The handlers change identity with the machine's state; the toast must fire
  // once per arrival, so they are read through a ref instead of a dependency.
  const handlers = React.useRef({ onAction, onDismiss, t });
  // Declared before the firing effect below, so the handlers are current when it runs.
  React.useEffect(() => {
    handlers.current = { onAction, onDismiss, t };
  });

  const id = toast?.id;
  const key = toast?.key;

  React.useEffect(() => {
    if (id === undefined || key === undefined) return;
    const handle = showToast(handlers.current.t(key), {
      duration: Number.POSITIVE_INFINITY,
      actionLabel: handlers.current.t("scout.toast.action"),
      dismissLabel: handlers.current.t("scout.toast.dismiss.aria"),
      onAction: () => handlers.current.onAction(),
      onDismiss: () => handlers.current.onDismiss(),
    });
    return () => {
      sonnerToast.dismiss(handle);
    };
  }, [id, key]);

  return null;
}
