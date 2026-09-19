import * as React from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Icon } from "../../components/ui/icon";
import { Overline } from "../../components/ui/overline";
import { Switch } from "../../components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody } from "../../components/ui/sheet";
import { useCopy } from "../../ui/copy";
import { PageTitle, PageLead } from "../../ui/settings/primitives";
import { SourceRowSurface } from "../../ui/settings/SourceRow";

type Portal = FunctionReturnType<typeof api.portalConnections.listMine>[number];
type Source = FunctionReturnType<typeof api.searchSources.listForNeed>["sources"][number];
interface Props {
  city?: string;
  address?: string;
  portals: Portal[];
  sources: Source[];
  busy: boolean;
  preference: (portal: Portal) => boolean;
  onPortalToggle: (portal: Portal, checked: boolean) => void;
  onSourceToggle: (source: Source, checked: boolean) => void;
  portalActions: (portal: Portal) => React.ReactNode;
  addressAction: React.ReactNode;
  moreSources: React.ReactNode;
}

function hostname(value: string) {
  try { return new URL(value).hostname; } catch { return value; }
}

function hasIndexedEvidence(source: Source) {
  const evidence = source as Source & { hasIndexedEvidence?: boolean; indexedEntryCount?: number };
  return evidence.hasIndexedEvidence === true || (evidence.indexedEntryCount ?? 0) > 0;
}

export function LiveSourcesSection(props: Props) {
  const { t } = useCopy();
  const [connectionId, setConnectionId] = React.useState<string | null>(null);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState(false);
  const activePortal = props.portals.find((p) => p._id === connectionId);
  const domains = new Set(props.portals.map((p) => hostname(p.baseUrl)));
  const publicSources = props.sources.filter((s) => !domains.has(s.domain));
  const status = (portal: Portal) => portal.status === "active"
    ? t("settings.sources.status.connected")
    : portal.latestAuthenticationRun?.status === "queued" ? t("liveSettings.registrationQueued")
    : portal.latestAuthenticationRun?.status === "running" && portal.latestAuthenticationRun.onboardingStage === "opening_signup" ? t("liveSettings.registrationOpening")
    : portal.latestAuthenticationRun?.status === "running" && portal.latestAuthenticationRun.onboardingStage === "waiting_verification" ? t("liveSettings.registrationWaitingVerification")
    : portal.latestAuthenticationRun?.status === "running" && portal.latestAuthenticationRun.onboardingStage === "submitting_verification" ? t("liveSettings.registrationSubmittingVerification")
    : portal.latestAuthenticationRun?.status === "failed" || portal.latestAuthenticationRun?.onboardingStage === "failed" ? t("liveSettings.registrationFailed")
    : t(portal.status === "paused" ? "liveSettings.portalStatusPaused" : portal.status === "disabled" ? "liveSettings.portalStatusDisabled" : "liveSettings.portalStatusNeedsAuth");

  return <>
    <PageTitle>{t("settings.sources.title")}</PageTitle>
    <PageLead>{props.city ? t("settings.sources.subtitle.withOrder", { city: props.city }) : t("settings.sources.subtitle.noOrder")}</PageLead>
    <div className="mt-[var(--space-12)] flex items-center justify-between gap-[var(--space-9)] border-y border-rs-border-divider py-[var(--space-10)]">
      <div><div className="text-[length:var(--text-lead-size)]">{t("settings.sources.auto.title")}</div><div className="mt-[var(--space-1)] text-[length:var(--text-body-sm-size)] text-rs-ink-4">{t("settings.sources.auto.sub")}</div></div>
      <Switch checked disabled label={t("settings.sources.auto.title")} title={t("liveSettings.autoSourcesFixed")} />
    </div>
    <div className="mt-[var(--space-12)] flex items-baseline justify-between gap-[var(--space-9)]"><Overline>{t("settings.sources.list.label")}</Overline><span className="text-[length:var(--text-caption-size)] text-rs-ink-6">{t("settings.sources.list.scope")}</span></div>
    <div className="mt-[var(--space-5)]">
      {props.portals.map((portal) => {
        const controlled = hostname(portal.baseUrl) === "roomscout.dev";
        return <SourceRowSurface key={portal._id}
        name={hostname(portal.baseUrl) || portal.platformName || portal.sourceName}
        description={controlled ? t("settings.sources.demo.roomscout.desc") : portal.sourceName}
        brand={controlled}
        enabled={props.preference(portal)} disabled={props.busy || !props.city}
        status={{ label: props.preference(portal) ? status(portal) : t("settings.sources.status.excluded"), tone: props.preference(portal) && portal.status === "active" ? "success" : "muted" }}
        statusSupplement={!controlled ? <Badge variant="muted">{t("settings.sources.status.contactDisabledDemo")}</Badge> : undefined}
        onToggle={(checked) => props.onPortalToggle(portal, checked)} defaultOpen
        detail={<><div>{props.address ?? t("liveSettings.notConfigured")}</div><div>{t(controlled ? "settings.sources.detail.portalScope" : "settings.sources.detail.reviewedReadOnly")}</div></>}
        connectionAction={<Button variant="link" size="2xs" className="text-[length:var(--text-body-sm-size)] text-rs-ink" onClick={() => setConnectionId(portal._id)}>{t("settings.sources.detail.manageConnection")}<Icon name="arrow-up-right" size={14} /></Button>}
      />;
      })}
      {publicSources.map((source) => {
        const indexed = hasIndexedEvidence(source);
        return <SourceRowSurface key={source.platformId} name={source.name} description={source.domain} enabled={source.preference !== "exclude"} disabled={props.busy || source.platformStatus === "restricted"}
          status={{ label: t(source.preference === "exclude" ? "settings.sources.status.excluded" : indexed ? "settings.sources.status.indexed" : "settings.sources.status.reviewed"), tone: "muted" }}
          statusSupplement={<Badge variant="muted">{t("settings.sources.status.contactDisabledDemo")}</Badge>}
          onToggle={(checked) => props.onSourceToggle(source, checked)} detail={t(indexed ? "settings.sources.detail.indexedReadOnly" : "settings.sources.detail.reviewedReadOnly")} />;
      })}
      {!props.portals.length && !publicSources.length ? <p className="py-6 text-rs-ink-4">{t("liveSettings.noSourcesYet")}</p> : null}
    </div>
    <div className="mt-[var(--space-10)] grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-[var(--space-9)] border-t border-rs-border-divider pt-[var(--space-10)]">
      <Icon name="mail" size={26} className="mt-[var(--space-1)] text-rs-ink-2" />
      <div className="min-w-0"><div className="text-[length:var(--text-body-lg-size)]">{t("settings.sources.address.title")}</div><div className="mt-[var(--space-1)] select-all break-all text-[length:var(--text-body-lg-size)]">{props.address ?? t("liveSettings.notConfigured")}</div><div className="mt-[var(--space-2)] text-[length:var(--text-caption-size)] text-rs-ink-4">{t("settings.sources.address.hint")}</div>{props.addressAction}{copyError ? <p role="alert">{t("settings.sources.address.copyFail")}</p> : null}</div>
      <Button variant="secondary" size="sm" className="min-w-[120px]" disabled={!props.address} onClick={async () => { try { await navigator.clipboard.writeText(props.address!); setCopied(true); setCopyError(false); } catch { setCopyError(true); } }}>{t(copied ? "settings.sources.address.copied" : "settings.sources.address.copy")}</Button>
    </div>
    <div className="mt-[var(--space-12)] flex flex-wrap items-center justify-between gap-[var(--space-9)]"><Button variant="link" size="2xs" className="text-[length:var(--text-body-sm-size)] text-rs-ink" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>{t(moreOpen ? "settings.sources.more.hide" : "settings.sources.more.show")}</Button><span className="text-[length:var(--text-caption-size)] text-rs-ink-6">{t("settings.sources.more.note")}</span></div>
    {moreOpen ? <div className="mt-[var(--space-7)]">{props.moreSources}</div> : null}
    <Sheet open={!!activePortal} onOpenChange={(open) => { if (!open) setConnectionId(null); }}>
      <SheetContent side="right" closeLabel={t("settings.connection.closeAria")} className="w-[min(480px,100%)] px-[var(--space-15)] pt-[var(--space-15)] pb-[var(--space-14)]" aria-describedby={undefined}>
        <SheetHeader className="px-0 pt-0"><SheetTitle>{activePortal ? hostname(activePortal.baseUrl) : t("liveSettings.portalConnections")}</SheetTitle></SheetHeader>
        <SheetBody className="px-0 pt-[var(--space-12)]">{activePortal ? <><p className="text-rs-ink-4">{status(activePortal)}</p><p className="mt-4 text-rs-ink-4">{t("liveSettings.connectionScope")}</p><div className="mt-8 flex flex-wrap gap-3">{props.portalActions(activePortal)}</div></> : null}</SheetBody>
      </SheetContent>
    </Sheet>
  </>;
}
