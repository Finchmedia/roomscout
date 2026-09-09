/**
 * „Verbindung zu roomscout.dev“ — the right-hand portal-connection sheet with
 * its three modes: info, disconnect confirmation and the login simulation.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Settings.jsx:227-246`
 * (`ConnSheet`), measured in `docs/UI_PORT/SETTINGS_SCREENS.md` §12.
 * Applied delta: DECISIONS item 36 — the sheet is parameterised by source id
 * instead of being hard-wired to `roomscout`.
 */

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Overline } from "@/components/ui/overline"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { StatusDot } from "@/components/ui/status-dot"
import { useCopy } from "@/ui/copy"

import type { DemoSource, SourceId } from "./state/useSettingsDemoState"

type ConnectionMode = "info" | "confirm" | "login"

interface ConnectionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The portal row this sheet was opened from; `undefined` renders nothing. */
  source: DemoSource | undefined
  onSetAccess: (id: SourceId, access: DemoSource["access"]) => void
}

function ConnectionSheet({
  open,
  onOpenChange,
  source,
  onSetAccess,
}: ConnectionSheetProps) {
  const { t } = useCopy()

  if (!source) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={t("settings.connection.closeAria")}
        className="w-[min(480px,100%)] px-[var(--space-15)] pt-[var(--space-15)] pb-[var(--space-14)]"
        aria-describedby={undefined}
      >
        {/* The body only mounts while the sheet is open, so every open starts
            from the info mode without an effect resetting it. */}
        <ConnectionSheetBody source={source} onSetAccess={onSetAccess} />
      </SheetContent>
    </Sheet>
  )
}

function ConnectionSheetBody({
  source,
  onSetAccess,
}: Pick<ConnectionSheetProps, "source" | "onSetAccess"> & {
  source: DemoSource
}) {
  const { t } = useCopy()
  const [mode, setMode] = React.useState<ConnectionMode>("info")
  const [message, setMessage] = React.useState<string | null>(null)

  const connected = source.access === "connected"
  const stateLabel = connected
    ? t("settings.connection.state.connected")
    : source.access === "expired"
      ? t("settings.connection.state.expired")
      : t("settings.connection.state.disconnected")

  const fields: { label: string; value: React.ReactNode }[] = [
    {
      label: t("settings.connection.field.profile"),
      value: t("settings.sources.demo.roomscout.profile"),
    },
    {
      label: t("settings.connection.field.state"),
      value: (
        <StatusDot
          tone={connected ? "success" : "warning"}
          className="text-[length:var(--text-body-size)] text-rs-ink"
        >
          {stateLabel}
        </StatusDot>
      ),
    },
    {
      label: t("settings.connection.field.lastAccess"),
      value:
        source.lastAccess ??
        (connected
          ? t("settings.connection.lastAccess.connectedNone")
          : t("settings.connection.lastAccess.none")),
    },
  ]

  return (
    <>
        <SheetHeader className="px-0 pt-0">
          <SheetTitle className="text-[length:var(--text-card-title-size)] font-medium tracking-[-0.01em]">
            {t("settings.connection.title")}
          </SheetTitle>
        </SheetHeader>

        <SheetBody className="px-0 pt-[var(--space-12)]">
          <div className="flex flex-col gap-[var(--space-6)] text-[length:var(--text-body-size)] leading-[var(--text-body-leading)]">
            {fields.map((field) => (
              <div
                key={field.label}
                className="flex justify-between gap-[var(--space-7)] border-b border-rs-border-divider pb-[var(--space-5)]"
              >
                <span className="text-rs-ink-6">{field.label}</span>
                <span className="text-right">{field.value}</span>
              </div>
            ))}
            <p className="m-0 text-[length:var(--text-body-sm-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4">
              {t("settings.connection.explain")}
            </p>
          </div>

          <div className="flex-1" />

          {connected && mode === "info" ? (
            <Button
              variant="secondary"
              size="sm"
              className="mt-[var(--space-11)] self-start"
              onClick={() => setMode("confirm")}
            >
              {t("settings.connection.disconnect")}
            </Button>
          ) : null}

          {mode === "confirm" ? (
            <div className="mt-[var(--space-11)] animate-rs-fade-up rounded-card border border-rs-border-panel bg-rs-surface-subtle px-[var(--space-9)] py-[var(--space-8)]">
              <p className="m-0 text-[length:var(--text-body-sm-size)] leading-[var(--text-body-leading)]">
                {t("settings.connection.confirm.body")}
              </p>
              <div className="mt-[var(--space-7)] flex flex-wrap justify-end gap-[var(--space-4)]">
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setMode("info")}
                >
                  {t("settings.connection.confirm.stay")}
                </Button>
                <Button
                  variant="danger"
                  size="xs"
                  onClick={() => {
                    onSetAccess(source.id, "disconnected")
                    setMode("info")
                    setMessage(t("settings.connection.msg.removed"))
                  }}
                >
                  {t("settings.connection.confirm.disconnect")}
                </Button>
              </div>
            </div>
          ) : null}

          {!connected && mode === "info" ? (
            <>
              <p className="mt-[var(--space-11)] mb-0 text-[length:var(--text-body-sm-size)] text-rs-ink-2">
                {t("settings.connection.disconnected.hint")}
              </p>
              <Button
                size="sm"
                className="mt-[var(--space-6)] self-start"
                onClick={() => setMode("login")}
              >
                {t("settings.connection.disconnected.cta")}
              </Button>
            </>
          ) : null}

          {mode === "login" ? (
            <div className="mt-[var(--space-11)] animate-rs-fade-up rounded-card border border-dashed border-rs-border-accent bg-rs-surface-subtle p-[var(--space-9)]">
              <Overline tone="accent">
                {t("settings.connection.login.eyebrow")}
              </Overline>
              <p className="mt-[var(--space-4)] mb-0 text-[length:var(--text-body-sm-size)] leading-[var(--text-body-leading)] text-rs-ink-2">
                {t("settings.connection.login.body")}
              </p>
              <div className="mt-[var(--space-7)] flex flex-wrap justify-end gap-[var(--space-4)]">
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setMode("info")}
                >
                  {t("settings.connection.login.cancel")}
                </Button>
                <Button
                  size="xs"
                  onClick={() => {
                    onSetAccess(source.id, "connected")
                    setMode("info")
                    setMessage(t("settings.connection.msg.saved"))
                  }}
                >
                  {t("settings.connection.login.finish")}
                </Button>
              </div>
            </div>
          ) : null}

          <p
            role="status"
            aria-live="polite"
            className="mt-[var(--space-6)] mb-0 min-h-[var(--space-9)] text-[length:var(--text-caption-size)] text-rs-ink-4"
          >
            {message}
          </p>
        </SheetBody>
    </>
  )
}

export { ConnectionSheet }
