/**
 * The profile dropdown under the avatar (App.jsx `ProfileMenu`,
 * SCOUT_SCREENS §2.4.3 — `position:absolute; right:0; top:52px`).
 *
 * Built from the `dropdown-menu` primitive's own cva pairs
 * (`dropdownMenuContentVariants` / `dropdownMenuItemVariants`) rather than from
 * its Radix parts: Radix's `DropdownMenuTrigger` has to *wrap* the trigger
 * element, and the avatar button is rendered inside `AppHeader`, which exposes
 * the menu only as the `avatarMenu` slot. `AppHeader`'s own contract says so —
 * „the menu's own markup, state and dismissal stay with the owning screen; only
 * its anchor lives here“ — so the panel keeps the DS skin and this file owns
 * open state, outside-click and Escape.
 *
 * Rows, per the kit plus the port brief: Einstellungen · Betreiberansicht ·
 * the DE/EN toggle · „Zurück zum Scout“ while a panel is open.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  dropdownMenuContentVariants,
  dropdownMenuItemVariants,
} from "@/components/ui/dropdown-menu";
import { Icon, type IconName } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { LanguageToggle, useCopy } from "@/ui/copy";

interface ProfileMenuProps {
  open: boolean;
  /** Resolved band name („Herzbuben“) — the menu's identity block. */
  name: string;
  /** True while Settings or Operator is on top, which adds the back row. */
  inPanel: boolean;
  onClose: () => void;
  onSettings: () => void;
  onOperator: () => void;
  onBackToScout: () => void;
}

interface MenuRow {
  id: string;
  label: string;
  icon: IconName;
  onClick: () => void;
}

export function ProfileMenu({
  open,
  name,
  inPanel,
  onClose,
  onSettings,
  onOperator,
  onBackToScout,
}: ProfileMenuProps) {
  const { t } = useCopy();
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Dismissal — the kit closes the menu on any click outside it; Escape is the
  // keyboard equivalent a real menu owes its users.
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointerDown = (event: MouseEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = event.target as Node;
      // The avatar wrapper holds both the trigger and this panel; a click on the
      // trigger must reach its own toggle instead of being closed from here.
      const anchor = panel.closest('[data-slot="app-header-avatar"]') ?? panel;
      if (!anchor.contains(target)) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const rows: MenuRow[] = [
    {
      id: "settings",
      label: t("scout.chrome.menu.settings"),
      icon: "sliders",
      onClick: onSettings,
    },
    {
      id: "operator",
      label: t("operator.host.demoControls.openOperator"),
      icon: "building",
      onClick: onOperator,
    },
  ];
  if (inPanel) {
    rows.push({
      id: "back",
      label: t("scout.chrome.menu.backToScout"),
      icon: "arrow-left",
      onClick: onBackToScout,
    });
  }

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={t("scout.chrome.avatar.aria")}
      className={cn(dropdownMenuContentVariants(), "absolute top-[52px] right-0")}
    >
      <div className="px-[var(--space-5)] pt-[var(--space-4)] pb-[var(--space-3)]">
        <div className="text-[length:var(--text-body-sm-size)] font-medium">{name}</div>
        <div className="text-[length:var(--text-micro-size)] text-rs-ink-6">
          {t("scout.chrome.menu.subtitle")}
        </div>
      </div>
      <Separator className="mx-[var(--space-1)] mt-[var(--space-1)] mb-[var(--space-2)]" />
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          role="menuitem"
          className={cn(dropdownMenuItemVariants(), "text-left")}
          onClick={row.onClick}
        >
          <Icon name={row.icon} />
          {row.label}
        </button>
      ))}
      {/* Renders nothing while only one dictionary is registered. */}
      <LanguageToggle className="flex items-center gap-[var(--space-1)] px-[var(--space-5)] pt-[var(--space-2)]" />
    </div>
  );
}
