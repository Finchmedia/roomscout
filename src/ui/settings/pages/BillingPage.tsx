/**
 * „Tarif & Nutzung“ — access, activity figures, payment placeholders, invoices.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Settings.jsx:185-208`
 * (`BillingPage`), measured in `docs/UI_PORT/SETTINGS_SCREENS.md` §10.
 * Nothing here is billable: the page is a product concept with no payment
 * integration, which its own footnote says out loud.
 */

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Icon, type IconName } from "@/components/ui/icon"
import { Overline } from "@/components/ui/overline"
import { useCopy } from "@/ui/copy"

import { PageLead, PageTitle } from "../primitives"
import type { SettingsPageContext } from "../state/useSettingsDemoState"

function InfoPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-[var(--space-6)] animate-rs-fade-up rounded-card border border-rs-border-card-soft bg-rs-surface-subtle px-[var(--space-10)] py-[var(--space-8)]">
      <div className="text-[length:var(--text-body-lg-size)]">{title}</div>
      <div className="mt-[var(--space-1)] text-[length:var(--text-caption-size)] text-rs-ink-4">
        {body}
      </div>
    </div>
  )
}

function LineItem({
  icon,
  title,
  sub,
  cta,
  onCta,
}: {
  icon: IconName
  title: string
  sub: string
  cta: string
  onCta: () => void
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[var(--space-9)] border-b border-rs-border-divider py-[var(--space-9)]">
      <Icon name={icon} size={26} strokeWidth={1.5} className="text-rs-ink-2" />
      <div className="min-w-0">
        <div className="text-[length:var(--text-body-lg-size)]">{title}</div>
        <div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">
          {sub}
        </div>
      </div>
      <Button variant="secondary" size="xs" onClick={onCta}>
        {cta}
      </Button>
    </div>
  )
}

function BillingPage({ data }: SettingsPageContext) {
  const { t, tp } = useCopy()
  const [tariffOpen, setTariffOpen] = React.useState(false)
  const [payOpen, setPayOpen] = React.useState(false)

  return (
    <>
      <PageTitle>{t("settings.billing.title")}</PageTitle>
      <PageLead>{t("settings.billing.subtitle")}</PageLead>

      <Overline className="mt-[var(--space-12)] border-t border-rs-border-divider pt-[var(--space-10)]">
        {t("settings.billing.access.label")}
      </Overline>
      <div className="mt-[var(--space-4)] flex items-center justify-between gap-[var(--space-9)] border-b border-rs-border-divider pb-[var(--space-10)]">
        <div>
          <div className="text-[22px]">{t("settings.billing.access.plan")}</div>
          <div className="mt-[var(--space-1)] text-[length:var(--text-body-sm-size)] text-rs-ink-4">
            {t("settings.billing.access.sub")}
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          aria-expanded={tariffOpen}
          onClick={() => setTariffOpen((value) => !value)}
        >
          {t("settings.billing.access.cta")}
        </Button>
      </div>
      {tariffOpen ? (
        <InfoPanel
          title={t("settings.billing.tariff.title")}
          body={t("settings.billing.tariff.body")}
        />
      ) : null}

      <Overline className="mt-[var(--space-11)]">
        {t("settings.billing.usage.label")}
      </Overline>
      <div className="mt-[var(--space-6)] grid grid-cols-[repeat(3,minmax(0,1fr))]">
        <div className="py-[var(--space-2)]">
          <div className="text-[40px] font-medium tracking-[-0.02em]">
            {data.usage.searches}
          </div>
          <div className="mt-[2px] text-[length:var(--text-body-size)] text-rs-ink-4">
            {tp("settings.billing.usage.searches", data.usage.searches)}
          </div>
        </div>
        <div className="border-l border-rs-border-divider py-[var(--space-2)] ps-[var(--space-13)]">
          <div className="text-[40px] font-medium tracking-[-0.02em]">
            {data.usage.contacted}
          </div>
          <div className="mt-[2px] text-[length:var(--text-body-size)] text-rs-ink-4">
            {t("settings.billing.usage.contacted")}
          </div>
        </div>
        <div className="border-l border-rs-border-divider py-[var(--space-2)] ps-[var(--space-13)]">
          <div className="pt-[var(--space-5)] text-[22px] text-rs-ink-2">
            {t("settings.billing.usage.talkNone")}
          </div>
          <div className="mt-[var(--space-2)] text-[length:var(--text-body-size)] text-rs-ink-4">
            {t("settings.billing.usage.talk")}
          </div>
        </div>
      </div>
      <div className="mt-[var(--space-4)] border-b border-rs-border-divider pb-[var(--space-10)] text-[length:var(--text-caption-size)] text-rs-ink-6">
        {t("settings.billing.usage.footnote")}
      </div>

      <LineItem
        icon="card"
        title={t("settings.billing.payment.title")}
        sub={t("settings.billing.payment.sub")}
        cta={t("settings.billing.payment.cta")}
        onCta={() => setPayOpen((value) => !value)}
      />
      <LineItem
        icon="home"
        title={t("settings.billing.address.title")}
        sub={t("settings.billing.address.sub")}
        cta={t("settings.billing.address.cta")}
        onCta={() => setPayOpen((value) => !value)}
      />
      {payOpen ? (
        <InfoPanel
          title={t("settings.billing.pay.title")}
          body={t("settings.billing.pay.body")}
        />
      ) : null}

      <Overline className="mt-[var(--space-11)]">
        {t("settings.billing.invoices.label")}
      </Overline>
      <div className="mt-[var(--space-6)] grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[var(--space-9)]">
        <Icon name="doc" size={26} strokeWidth={1.5} className="text-rs-ink-2" />
        <div className="min-w-0">
          <div className="text-[length:var(--text-body-lg-size)]">
            {t("settings.billing.invoices.emptyTitle")}
          </div>
          <div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">
            {t("settings.billing.invoices.emptySub")}
          </div>
        </div>
      </div>

      <div className="mt-[var(--space-13)] text-end text-[length:var(--text-caption-size)] text-rs-ink-6">
        {t("settings.billing.footnote")}
      </div>
    </>
  )
}

export { BillingPage }
