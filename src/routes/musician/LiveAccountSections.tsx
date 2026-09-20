import * as React from "react";
import { ActionDialog } from "../../components/ui/ActionDialog";
import { Button } from "../../components/ui/button";
import { Icon, type IconName } from "../../components/ui/icon";
import { Overline } from "../../components/ui/overline";
import { useCopy } from "../../ui/copy";
import { PageLead, PageTitle, SettingsRow } from "../../ui/settings/primitives";

export interface BillingActivity {
  activeSearches?: number;
  providersContacted?: number;
  scoutConversations?: number;
}

export interface LiveBillingSectionProps {
  activity?: BillingActivity;
}

function DisabledLine({ icon, title, detail, action }: { icon: IconName; title: string; detail: string; action: string }) {
  return <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[var(--space-9)] border-b border-rs-border-divider py-[var(--space-9)] max-[959px]:grid-cols-[auto_minmax(0,1fr)] max-[959px]:[&>button]:col-start-2 max-[959px]:[&>button]:justify-self-start">
    <Icon name={icon} size={26} strokeWidth={1.5} className="text-rs-ink-2" />
    <div><div className="text-[length:var(--text-body-lg-size)]">{title}</div><div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">{detail}</div></div>
    <Button variant="secondary" size="xs" disabled>{action}</Button>
  </div>;
}

function ActivityValue({ value, label, divided }: { value?: number; label: string; divided?: boolean }) {
  const { t } = useCopy();
  return <div className={`${divided ? "border-l border-rs-border-divider ps-[var(--space-13)]" : ""} py-[var(--space-2)]`}>
    <div className={value === undefined ? "pt-[var(--space-5)] text-[22px] text-rs-ink-2" : "text-[40px] font-medium tracking-[-0.02em]"}>{value ?? t("liveSettings.billingNotTracked")}</div>
    <div className="mt-[2px] text-[length:var(--text-body-size)] text-rs-ink-4">{label}</div>
  </div>;
}

export function LiveBillingSection({ activity }: LiveBillingSectionProps) {
  const { t } = useCopy();
  return <>
    <PageTitle>{t("settings.billing.title")}</PageTitle>
    <PageLead>{t("settings.billing.subtitle")}</PageLead>
    <Overline className="mt-[var(--space-12)] border-t border-rs-border-divider pt-[var(--space-10)]">{t("liveSettings.billingAccess")}</Overline>
    <div className="mt-[var(--space-4)] flex items-center justify-between gap-[var(--space-9)] border-b border-rs-border-divider pb-[var(--space-10)]">
      <div><div className="text-[22px]">{t("liveSettings.billingDemoAccess")}</div><div className="mt-[var(--space-1)] text-[length:var(--text-body-sm-size)] text-rs-ink-4">{t("liveSettings.billingNoSubscription")}</div></div>
      <Button variant="secondary" size="sm" disabled>{t("liveSettings.billingViewPlans")}</Button>
    </div>
    <Overline className="mt-[var(--space-11)]">{t("liveSettings.billingActivity")}</Overline>
    <div className="mt-[var(--space-6)] grid grid-cols-[repeat(3,minmax(0,1fr))] max-[959px]:grid-cols-1 max-[959px]:[&>div]:border-l-0 max-[959px]:[&>div]:border-b max-[959px]:[&>div]:border-rs-border-divider max-[959px]:[&>div]:ps-0">
      <ActivityValue value={activity?.activeSearches} label={t("liveSettings.billingActiveSearches")} />
      <ActivityValue value={activity?.providersContacted} label={t("liveSettings.billingProvidersContacted")} divided />
      <ActivityValue value={activity?.scoutConversations} label={t("liveSettings.billingScoutConversations")} divided />
    </div>
    <div className="mt-[var(--space-4)] border-b border-rs-border-divider pb-[var(--space-10)] text-[length:var(--text-caption-size)] text-rs-ink-6">{t("liveSettings.billingActivityFootnote")}</div>
    <DisabledLine icon="card" title={t("liveSettings.billingPaymentTitle")} detail={t("liveSettings.billingPaymentDetail")} action={t("liveSettings.billingManage")} />
    <DisabledLine icon="home" title={t("liveSettings.billingAddressTitle")} detail={t("liveSettings.billingAddressDetail")} action={t("liveSettings.billingAdd")} />
    <Overline className="mt-[var(--space-11)]">{t("liveSettings.billingInvoices")}</Overline>
    <div className="mt-[var(--space-6)] grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[var(--space-9)]"><Icon name="doc" size={26} strokeWidth={1.5} className="text-rs-ink-2" /><div><div className="text-[length:var(--text-body-lg-size)]">{t("liveSettings.billingNoInvoices")}</div><div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">{t("liveSettings.billingReceiptsLater")}</div></div></div>
    <div className="mt-[var(--space-13)] text-end text-[length:var(--text-caption-size)] text-rs-ink-6">{t("liveSettings.billingNoIntegration")}</div>
  </>;
}

/** Demo reset progress as the page projects it from `api.demoReset.statusMine`. */
export interface LiveResetState {
  phase: "idle" | "running" | "done";
  deletedDocumentCount: number;
  onStart: () => void;
}

export interface LivePrivacySectionProps {
  storedFactCount?: number;
  portalConnectionCount?: number;
  onKnowledge: () => void;
  onSources: () => void;
  onScout: () => void;
  reset: LiveResetState;
}

export function LivePrivacySection({ storedFactCount, portalConnectionCount, onKnowledge, onSources, onScout, reset }: LivePrivacySectionProps) {
  const { t } = useCopy();
  const [resetOpen, setResetOpen] = React.useState(false);
  const resetLabel = reset.phase === "running"
    ? t("settings.privacy.reset.running", { count: reset.deletedDocumentCount })
    : reset.phase === "done" ? t("settings.privacy.reset.done") : t("settings.privacy.reset.action");
  const storedCount = storedFactCount === undefined
    ? t("liveSettings.privacyStoredFallback")
    : t(storedFactCount === 1 ? "liveSettings.privacyStoredOne" : "liveSettings.privacyStoredMany", { count: storedFactCount });
  const portalCount = portalConnectionCount === undefined
    ? t("liveSettings.privacyPortalsFallback")
    : t(portalConnectionCount === 1 ? "liveSettings.privacyPortalsOne" : "liveSettings.privacyPortalsMany", { count: portalConnectionCount });
  return <>
    <PageTitle>{t("liveSettings.privacyDataTitle")}</PageTitle>
    <PageLead>{t("liveSettings.privacyDataLead")}</PageLead>
    <div className="mt-[var(--space-12)]">
      <SettingsRow className="border-t border-t-rs-border-divider py-[var(--space-8)] max-[959px]:flex-col max-[959px]:items-start"><div><div className="text-[length:var(--text-body-lg-size)]">{t("liveSettings.privacyStoredTitle")}</div><div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">{storedCount}</div></div><Button variant="secondary" size="xs" onClick={onKnowledge}>{t("liveSettings.privacyViewStored")}</Button></SettingsRow>
      <SettingsRow className="py-[var(--space-8)] max-[959px]:flex-col max-[959px]:items-start"><div><div className="text-[length:var(--text-body-lg-size)]">{t("liveSettings.privacyTranscriptTitle")}</div><div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">{t("liveSettings.privacyTranscriptDetail")}</div></div><Button variant="secondary" size="xs" onClick={onScout}>{t("liveSettings.privacyViewTranscript")}</Button></SettingsRow>
      <SettingsRow className="py-[var(--space-8)] max-[959px]:flex-col max-[959px]:items-start"><div><div className="text-[length:var(--text-body-lg-size)]">{t("liveSettings.privacyPortalsTitle")}</div><div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">{portalCount}</div></div><Button variant="secondary" size="xs" onClick={onSources}>{t("liveSettings.privacyManagePortals")}</Button></SettingsRow>
      <SettingsRow className="py-[var(--space-8)] max-[959px]:flex-col max-[959px]:items-start"><div><div className="text-[length:var(--text-body-lg-size)]">{t("liveSettings.privacyExportTitle")}</div><div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">{t("liveSettings.privacyExportDetail")}</div></div><Button variant="secondary" size="xs" disabled>{t("liveSettings.privacyExport")}</Button></SettingsRow>
      <SettingsRow className="py-[var(--space-8)] max-[959px]:flex-col max-[959px]:items-start"><div><div className="text-[length:var(--text-body-lg-size)]">{t("liveSettings.privacyDeleteTitle")}</div><div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">{t("liveSettings.privacyDeleteDetail")}</div></div><Button variant="secondary" size="xs" disabled>{t("liveSettings.privacyDelete")}</Button></SettingsRow>
      <div className="py-[var(--space-8)]"><div className="text-[length:var(--text-body-lg-size)]">{t("liveSettings.privacyVendorsTitle")}</div><div className="mt-[2px] text-[length:var(--text-caption-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4">{t("liveSettings.privacyVendorsDetail")}</div></div>
      <SettingsRow data-testid="privacy-reset-row" className="border-t border-t-rs-border-divider border-b-0 py-[var(--space-8)] max-[959px]:flex-col max-[959px]:items-start"><div><div className="text-[length:var(--text-body-lg-size)]">{t("settings.privacy.reset.title")}</div><div className="mt-[2px] text-[length:var(--text-caption-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4">{t("settings.privacy.reset.subtitle")}</div></div><Button variant="danger" size="xs" disabled={reset.phase !== "idle"} aria-busy={reset.phase === "running"} onClick={() => setResetOpen(true)}>{resetLabel}</Button></SettingsRow>
    </div>
    <ActionDialog
      open={resetOpen}
      onOpenChange={setResetOpen}
      title={t("settings.privacy.reset.confirmTitle")}
      footer={<>
        <Button variant="secondary" onClick={() => setResetOpen(false)}>{t("settings.privacy.reset.cancel")}</Button>
        <Button variant="danger" onClick={() => { setResetOpen(false); reset.onStart(); }}>{t("settings.privacy.reset.confirm")}</Button>
      </>}
    ><p>{t("settings.privacy.reset.confirmBody")}</p></ActionDialog>
  </>;
}
