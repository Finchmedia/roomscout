import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon, type IconName } from "@/components/ui/icon";
import { Overline } from "@/components/ui/overline";
import { StatusDot } from "@/components/ui/status-dot";
import { Switch } from "@/components/ui/switch";
import { BrandLockup } from "@/components/navigation/BrandLockup";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppHeader } from "@/ui/chrome/AppHeader";
import { PanelDialog } from "@/ui/chrome/PanelDialog";
import { StageBackground } from "@/ui/chrome/StageBackground";
import { useCopy, type StringCopyKey } from "@/ui/copy";
import { formatMessageStamp } from "@/ui/copy/format";
import { PartnerLogo } from "@/ui/operator/IntegrationTile";
import { PageIntro } from "@/ui/operator/PageIntro";

export type LiveOperatorSection =
  "overview" | "sources" | "tasks" | "integrations" | "flags" | "diag";
export type LiveOperatorToolId =
  "sources" | "signals" | "outreach" | "inbox" | "audit";
export interface LiveOperatorMetric {
  id:
    | "publishedSignals"
    | "staleSignals"
    | "detailBacklog"
    | "detailFailures"
    | "awaitingApproval"
    | "repliedThreads"
    | "unhealthySources"
    | "activeVoiceSessions"
    | "activeMailboxes";
  value: number;
  attention?: boolean;
}
export interface LiveOperatorActivity {
  id: string;
  title: string;
  detail: string;
  status: string;
  at: number;
}
export interface LiveOperatorProvider {
  id:
    | "convexAiGateway"
    | "firecrawl"
    | "agentmail"
    | "browserbase"
    | "mapbox"
    | "openaiDirect";
  status: "configured" | "incomplete" | "disabled" | "client_only";
}
export interface LiveOperatorSource {
  id: string;
  name: string;
  region?: string;
  status: string;
  health: string;
  accessMode?: string;
  baseUrl?: string;
  lastCheckedAt?: number;
}
interface LiveOperatorSurfaceProps {
  section: LiveOperatorSection;
  metrics: readonly LiveOperatorMetric[];
  activity: readonly LiveOperatorActivity[];
  providers: readonly LiveOperatorProvider[];
  sources?: readonly LiveOperatorSource[];
  boundedSample: number;
  readinessLoading: boolean;
  readinessError?: string;
  /** Captured once by the route so a render stays reproducible. */
  now: number;
  /** A demo source check is queued or running. */
  sourceCheckRunning?: boolean;
  onRefreshReadiness: () => void;
  onCheckSources?: () => void;
  /** Resolves when the toggle mutation settled — the row stays disabled until then. */
  onToggleSource?: (sourceId: string, active: boolean) => void | Promise<void>;
  onSectionChange: (section: LiveOperatorSection) => void;
  onToolOpen: (tool: LiveOperatorToolId) => void;
  onClose: () => void;
}

const SECTIONS: readonly LiveOperatorSection[] = [
  "overview",
  "sources",
  "tasks",
  "integrations",
  "flags",
  "diag",
];
const SECTION_META: Record<
  LiveOperatorSection,
  { icon: IconName; label: StringCopyKey }
> = {
  overview: { icon: "bars", label: "liveOperator.overview" },
  sources: { icon: "database", label: "liveOperator.sources" },
  tasks: { icon: "tasks", label: "liveOperator.tasks" },
  integrations: { icon: "plug", label: "liveOperator.integrations" },
  flags: { icon: "flag", label: "liveOperator.flags" },
  diag: { icon: "pulse", label: "liveOperator.diag" },
};
const TOOLS: Record<
  LiveOperatorToolId,
  { icon: IconName; label: StringCopyKey }
> = {
  sources: { icon: "database", label: "liveOperator.toolLabels.sources" },
  signals: { icon: "search", label: "liveOperator.toolLabels.signals" },
  outreach: { icon: "send", label: "liveOperator.toolLabels.outreach" },
  inbox: { icon: "mail", label: "liveOperator.toolLabels.inbox" },
  audit: { icon: "list", label: "liveOperator.toolLabels.audit" },
};
const LOGOS: Partial<Record<LiveOperatorProvider["id"], string>> = {
  convexAiGateway: "/design/partners/logo-convex.svg",
  firecrawl: "/design/partners/logo-firecrawl.svg",
  agentmail: "/design/partners/logo-agentmail.png",
  browserbase: "/design/partners/logo-browserbase.png",
  openaiDirect: "/design/partners/logo-openai.svg",
};
/**
 * Fixed display order. `browserbase` is deliberately absent: the portal engine
 * is shown as a picker inside the Firecrawl entry instead of as its own tile.
 */
const PROVIDER_IDS: readonly LiveOperatorProvider["id"][] = [
  "convexAiGateway",
  "agentmail",
  "openaiDirect",
  "firecrawl",
  "mapbox",
];
const ATTENTION_STATUSES = new Set([
  "failed",
  "error",
  "blocked",
  "expired",
  "degraded",
  "unhealthy",
]);
const DEGRADED_HEALTH = new Set([
  "degraded",
  "failing",
  "failed",
  "unhealthy",
]);
/**
 * The „Anbindung“ cell. A degraded source reads as disturbed whatever its
 * status says; an active source on the controlled demo origin names it.
 */
function sourceConnection(source: LiveOperatorSource): {
  tone: "success" | "warning" | "muted";
  key: StringCopyKey;
} {
  if (DEGRADED_HEALTH.has(source.health.toLowerCase()))
    return { tone: "warning", key: "liveOperator.connection.degraded" };
  if (source.status !== "active")
    return { tone: "muted", key: "liveOperator.connection.inactive" };
  return {
    tone: "success",
    key: source.baseUrl?.includes("roomscout")
      ? "liveOperator.connection.demo"
      : "liveOperator.connection.connected",
  };
}
const statusKey = (
  status: LiveOperatorProvider["status"] | null,
): StringCopyKey =>
  status === null
    ? "liveOperator.notChecked"
    : status === "configured"
      ? "liveOperator.configured"
      : status === "disabled"
        ? "liveOperator.disabled"
        : status === "client_only"
          ? "liveOperator.clientOnly"
          : "liveOperator.incomplete";
const statusTone = (
  status: LiveOperatorProvider["status"] | null,
): "success" | "warning" | "muted" | "idle" =>
  status === null
    ? "idle"
    : status === "configured"
      ? "success"
      : status === "disabled"
        ? "muted"
        : "warning";

function ProviderMark({
  provider,
}: {
  provider: Pick<LiveOperatorProvider, "id">;
}) {
  const logo = LOGOS[provider.id];
  return logo ? (
    <PartnerLogo src={logo} size={28} />
  ) : (
    <span className="flex size-[var(--space-13)] items-center justify-center rounded-circle border border-rs-border-control bg-rs-surface-subtle">
      <Icon name="globe" size={16} />
    </span>
  );
}
/**
 * Portal-engine picker inside the Firecrawl entry. Purely informational — the
 * engine is a deployment decision, so the menu states it rather than changing
 * it, and Browserbase stays listed as the inactive alternative.
 */
function EnginePicker() {
  const { t } = useCopy();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="2xs" className="self-start text-rs-ink-4">
          {t("liveOperator.engineLabel")}: {t("liveOperator.providers.firecrawl")}
          <Icon name="chevron-down" size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent size="compact" align="start">
        <DropdownMenuItem>
          <Icon name="check" />
          {t("liveOperator.providers.firecrawl")} ·{" "}
          {t("liveOperator.engineDefault")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          {t("liveOperator.providers.browserbase")} ·{" "}
          {t("liveOperator.engineInactive")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
/**
 * Overview integration tile. The card is a plain container so the Firecrawl
 * tile can carry the engine picker next to — never inside — the open button.
 */
function ProviderTile({
  provider,
  onOpen,
  footer,
  checking = false,
}: {
  provider: { id: LiveOperatorProvider["id"]; status: LiveOperatorProvider["status"] | null };
  onOpen: () => void;
  footer?: React.ReactNode;
  /** The configuration check is running: an unchecked tile says so instead of "Noch nicht geprüft". */
  checking?: boolean;
}) {
  const { t } = useCopy();
  return (
    <Card
      size="sm"
      className="flex flex-col gap-[var(--space-6)] rounded-card px-[var(--space-9)] py-[var(--space-8)] transition-[background-color] duration-[var(--duration-fast)] hover:bg-rs-surface-hover-soft"
    >
      <button
        type="button"
        className="flex cursor-pointer flex-col gap-[var(--space-6)] text-left"
        onClick={onOpen}
      >
        <span className="flex items-center gap-[var(--space-5)]">
          <ProviderMark provider={provider} />
          <span className="min-w-0">
            <span className="block text-[16.5px] font-medium">
              {t(`liveOperator.providers.${provider.id}`)}
            </span>
            <span className="mt-px block text-[length:var(--text-caption-size)] text-rs-ink-4">
              {t(`liveOperator.providerRoles.${provider.id}`)}
            </span>
          </span>
        </span>
        <StatusDot tone={statusTone(provider.status)}>
          {t(provider.status === null && checking ? "liveOperator.refreshing" : statusKey(provider.status))}
        </StatusDot>
      </button>
      {footer}
    </Card>
  );
}
function ActivityList({
  activity,
  empty,
}: {
  activity: readonly LiveOperatorActivity[];
  empty: string;
}) {
  const { t } = useCopy();
  const [openId, setOpenId] = React.useState<string | null>(null);
  return (
    <div className="mt-[var(--space-4)]">
      {activity.length === 0 ? (
        <p className="text-rs-ink-4">{empty}</p>
      ) : (
        <Table container={{ className: "font-sans" }}>
          <colgroup>
            <col style={{ width: "28.9%" }} />
            <col style={{ width: "22.2%" }} />
            <col style={{ width: "26.7%" }} />
            <col style={{ width: "22.2%" }} />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>{t("liveOperator.taskColumns.process")}</TableHead>
              <TableHead>{t("liveOperator.taskColumns.source")}</TableHead>
              <TableHead>{t("liveOperator.taskColumns.status")}</TableHead>
              <TableHead>{t("liveOperator.taskColumns.next")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activity.map((event) => (
              <React.Fragment key={event.id}>
                <TableRow
                  highlight={ATTENTION_STATUSES.has(event.status.toLowerCase())}
                >
                  <TableCell>{event.title}</TableCell>
                  <TableCell muted>
                    {t("liveOperator.unavailableDash")}
                  </TableCell>
                  <TableCell>
                    <StatusDot
                      tone={
                        ATTENTION_STATUSES.has(event.status.toLowerCase())
                          ? "warning"
                          : "idle"
                      }
                    >
                      {event.status}
                    </StatusDot>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="link"
                      size="2xs"
                      aria-expanded={openId === event.id}
                      onClick={() =>
                        setOpenId(openId === event.id ? null : event.id)
                      }
                    >
                      {t("liveOperator.details")}
                      <Icon name="chevron-right" size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
                {openId === event.id ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="animate-rs-fade-up text-rs-ink-4"
                    >
                      <time dateTime={new Date(event.at).toISOString()}>
                        {new Date(event.at).toLocaleString("de-DE")}
                      </time>
                      <span className="mx-[var(--space-3)]">·</span>
                      {event.detail}
                    </TableCell>
                  </TableRow>
                ) : null}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export function LiveOperatorSurface(props: LiveOperatorSurfaceProps) {
  const { t, locale } = useCopy();
  const [openProvider, setOpenProvider] = React.useState<
    LiveOperatorProvider["id"] | null
  >(null);
  const [attentionOnly, setAttentionOnly] = React.useState(false);
  const [pendingSource, setPendingSource] = React.useState<string | null>(null);
  const { onToggleSource } = props;
  const toggleSource = (sourceId: string, active: boolean) => {
    if (!onToggleSource) return;
    setPendingSource(sourceId);
    void Promise.resolve(onToggleSource(sourceId, active)).finally(() => {
      setPendingSource((current) => (current === sourceId ? null : current));
    });
  };
  const alerts = props.metrics.filter(
    (metric) => metric.attention && metric.value > 0,
  );
  const filteredActivity = attentionOnly
    ? props.activity.filter((event) =>
        ATTENTION_STATUSES.has(event.status.toLowerCase()),
      )
    : props.activity;
  const providers = PROVIDER_IDS.map(
    (id) =>
      props.providers.find((provider) => provider.id === id) ?? {
        id,
        status: null,
      },
  );
  const groups = [
    {
      id: "betrieb",
      label: t("liveOperator.operations"),
      items: SECTIONS.map((id) => ({
        id,
        label: t(SECTION_META[id].label),
        icon: <Icon name={SECTION_META[id].icon} />,
        onSelect: () => props.onSectionChange(id),
      })),
    },
  ];
  const metrics = (
    <div className="grid gap-[var(--space-5)] [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
      {props.metrics.map((metric) => (
        <Card
          key={metric.id}
          size="sm"
          tone={metric.attention ? "warning" : "soft"}
        >
          <div className="text-sm text-rs-ink-4">
            {t(`liveOperator.metrics.${metric.id}`)}
          </div>
          <div className="mt-[var(--space-3)] text-[length:var(--text-price-size)] font-light">
            {metric.value}
          </div>
        </Card>
      ))}
    </div>
  );
  const page = (() => {
    switch (props.section) {
      case "overview":
        return (
          <div className="flex flex-col">
            <PageIntro
              title={t("liveOperator.overviewTitle")}
              lead={t("liveOperator.overviewSubtitle")}
            />
            {alerts.length ? (
              <div className="mt-[var(--space-11)] flex flex-wrap items-center justify-between gap-[var(--space-7)] rounded-card-sm border border-rs-border-amber bg-rs-surface-amber-tint px-[var(--space-8)] py-[var(--space-6)]">
                <div className="flex items-center gap-[var(--space-6)]">
                  <span className="flex size-[var(--space-11)] items-center justify-center rounded-circle bg-rs-amber font-bold text-rs-black">
                    !
                  </span>
                  {t("liveOperator.attention", { count: alerts.length })}
                </div>
                <Button
                  variant="link"
                  size="2xs"
                  onClick={() => props.onSectionChange("tasks")}
                >
                  {t("liveOperator.viewTasks")}
                  <Icon name="chevron-right" size={16} />
                </Button>
              </div>
            ) : (
              <Card size="sm" tone="faint" className="mt-[var(--space-11)]">
                <StatusDot tone="success">
                  {t("liveOperator.noAttention")}
                </StatusDot>
              </Card>
            )}
            <Overline className="mt-[var(--space-12)]">
              {t("liveOperator.integrations")}
            </Overline>
            <div className="mt-[var(--space-5)] grid gap-[var(--space-5)] [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
              {providers.slice(0, 4).map((provider) => (
                <ProviderTile
                  key={provider.id}
                  provider={provider}
                  checking={props.readinessLoading}
                  footer={
                    provider.id === "firecrawl" ? <EnginePicker /> : undefined
                  }
                  onOpen={() => {
                    setOpenProvider(provider.id);
                    props.onSectionChange("integrations");
                  }}
                />
              ))}
            </div>
            <Overline className="mt-[var(--space-12)]">
              {t("liveOperator.tasks")}
            </Overline>
            <ActivityList
              activity={props.activity.slice(0, 5)}
              empty={t("liveOperator.noActivity")}
            />
            <div className="mt-[var(--space-12)] flex justify-between gap-[var(--space-5)]">
              <Overline>{t("liveOperator.liveMetrics")}</Overline>
              <span className="text-[length:var(--text-micro-size)] text-rs-ink-6">
                {t("liveOperator.bounded")}: {props.boundedSample}
              </span>
            </div>
            <div className="mt-[var(--space-5)]">{metrics}</div>
            <div className="mt-[var(--space-12)] grid gap-[var(--space-11)] border-t border-rs-border-divider pt-[var(--space-10)] min-[900px]:grid-cols-2">
              <section>
                <Overline>{t("liveOperator.tasks")}</Overline>
                <p className="mt-[var(--space-4)] text-rs-ink-4">
                  {t("liveOperator.activitySummary", {
                    count: props.activity.length,
                  })}
                </p>
                <Button
                  className="mt-[var(--space-4)]"
                  variant="link"
                  size="2xs"
                  onClick={() => props.onSectionChange("tasks")}
                >
                  {t("liveOperator.viewTasks")}
                </Button>
              </section>
              <section className="min-[900px]:border-l min-[900px]:border-rs-border-divider min-[900px]:pl-[var(--space-14)]">
                <Overline>{t("liveOperator.flags")}</Overline>
                <p className="mt-[var(--space-4)] text-rs-ink-4">
                  {t("liveOperator.flagsUnavailable")}
                </p>
                <Button
                  className="mt-[var(--space-4)]"
                  variant="link"
                  size="2xs"
                  onClick={() => props.onSectionChange("flags")}
                >
                  {t("liveOperator.viewFlags")}
                </Button>
              </section>
            </div>
          </div>
        );
      case "sources":
        return (
          <div>
            <div className="flex flex-wrap items-end justify-between gap-[var(--space-7)]">
              <PageIntro
                title={t("liveOperator.sourcesTitle")}
                lead={t("liveOperator.sourcesSubtitle")}
              />
              <Button
                size="xs"
                variant="secondary"
                disabled={props.sourceCheckRunning ?? !props.onCheckSources}
                onClick={props.onCheckSources}
              >
                {t(
                  props.sourceCheckRunning
                    ? "liveOperator.checkRunning"
                    : "liveOperator.checkNow",
                )}
              </Button>
            </div>
            {props.sources === undefined ? (
              <Card size="sm" tone="faint" className="mt-[var(--space-12)]">
                {t("liveOperator.sourcesLoading")}
              </Card>
            ) : props.sources.length === 0 ? (
              <Card size="sm" tone="faint" className="mt-[var(--space-12)]">
                {t("liveOperator.noSources")}
              </Card>
            ) : (
              <Table container={{ className: "mt-[var(--space-12)]" }}>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t("liveOperator.sourceColumns.source")}
                    </TableHead>
                    <TableHead>
                      {t("liveOperator.sourceColumns.region")}
                    </TableHead>
                    <TableHead>
                      {t("liveOperator.sourceColumns.connection")}
                    </TableHead>
                    <TableHead>
                      {t("liveOperator.sourceColumns.lastCheck")}
                    </TableHead>
                    <TableHead>
                      <span className="sr-only">
                        {t("liveOperator.sourceColumns.toggle")}
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.sources.map((source) => {
                    const connection = sourceConnection(source);
                    return (
                      <TableRow key={source.id}>
                        <TableCell>
                          <span className="flex items-center gap-[var(--space-5)]">
                            <span className="flex size-[var(--space-13)] items-center justify-center rounded-circle border border-rs-border-control bg-rs-surface-subtle">
                              <Icon name="globe" size={16} />
                            </span>
                            {source.name}
                          </span>
                        </TableCell>
                        <TableCell muted>
                          {source.region ?? t("liveOperator.unknown")}
                        </TableCell>
                        <TableCell>
                          <StatusDot tone={connection.tone}>
                            {t(connection.key)}
                          </StatusDot>
                        </TableCell>
                        <TableCell muted>
                          {source.lastCheckedAt
                            ? formatMessageStamp(
                                locale,
                                source.lastCheckedAt,
                                props.now,
                              )
                            : t("liveOperator.unavailableDash")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Switch
                            checked={source.status === "active"}
                            disabled={
                              !onToggleSource || pendingSource === source.id
                            }
                            label={t("liveOperator.sourceToggleLabel", {
                              name: source.name,
                            })}
                            onCheckedChange={(checked) =>
                              toggleSource(source.id, checked)
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            <p className="mt-[var(--space-8)] text-sm text-rs-ink-6">
              {t("liveOperator.demoScopeNote")}
            </p>
            <Button
              className="mt-[var(--space-4)]"
              variant="link"
              size="sm"
              onClick={() => props.onToolOpen("sources")}
            >
              {t("liveOperator.advancedView")}
            </Button>
          </div>
        );
      case "tasks":
        return (
          <div>
            <PageIntro
              title={t("liveOperator.tasksTitle")}
              lead={t("liveOperator.tasksSubtitle")}
            />
            <div className="mt-[var(--space-10)] flex gap-[var(--space-2)]">
              {([false, true] as const).map((value) => (
                <Badge key={String(value)} asChild variant="pill">
                  <button
                    type="button"
                    aria-pressed={attentionOnly === value}
                    className={
                      attentionOnly === value
                        ? "cursor-pointer bg-rs-surface-accent-tint-hover"
                        : "cursor-pointer bg-rs-surface-subtle hover:bg-rs-surface-hover-soft"
                    }
                    onClick={() => setAttentionOnly(value)}
                  >
                    {t(
                      value
                        ? "liveOperator.attentionOnly"
                        : "liveOperator.allTasks",
                    )}
                  </button>
                </Badge>
              ))}
            </div>
            <ActivityList
              activity={filteredActivity}
              empty={t(
                attentionOnly
                  ? "liveOperator.noAttentionTasks"
                  : "liveOperator.noActivity",
              )}
            />
            <div className="mt-[var(--space-8)] flex gap-[var(--space-4)]">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => props.onToolOpen("signals")}
              >
                {t("liveOperator.openSignals")}
              </Button>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => props.onToolOpen("outreach")}
              >
                {t("liveOperator.openOutreach")}
              </Button>
            </div>
          </div>
        );
      case "integrations":
        return (
          <div>
            <PageIntro
              title={t("liveOperator.integrationsTitle")}
              lead={t("liveOperator.integrationsSubtitle")}
            />
            <div className="mt-[var(--space-10)] flex flex-wrap items-center justify-between gap-[var(--space-5)]">
              <p className="text-sm text-rs-ink-6">
                {t("liveOperator.providerCheckOnly")}
              </p>
              <Button
                size="xs"
                variant="secondary"
                disabled={props.readinessLoading}
                onClick={props.onRefreshReadiness}
              >
                {t(
                  props.readinessLoading
                    ? "liveOperator.refreshing"
                    : "liveOperator.refresh",
                )}
              </Button>
            </div>
            {props.readinessError ? (
              <p role="alert" className="mt-[var(--space-5)] text-rs-red-text">
                {props.readinessError}
              </p>
            ) : null}
            {props.providers.length > 0 &&
            !props.readinessLoading &&
            !props.readinessError ? (
              <p role="status" className="sr-only">
                {t("liveOperator.checkComplete")}
              </p>
            ) : null}
            <div className="mt-[var(--space-7)] divide-y divide-rs-border-divider-soft">
              {providers.map((provider) => {
                const open = provider.id === openProvider;
                return (
                  <div key={provider.id}>
                    <div className="flex items-center gap-[var(--space-5)]">
                      <button
                        type="button"
                        data-slot="operator-integration-row"
                        aria-expanded={open}
                        className="grid min-w-0 flex-1 cursor-pointer items-center gap-[var(--space-5)] py-[var(--space-7)] text-left min-[760px]:grid-cols-[1.2fr_1.3fr_1fr_auto]"
                        onClick={() =>
                          setOpenProvider(open ? null : provider.id)
                        }
                      >
                        <span className="flex items-center gap-[var(--space-5)] font-medium">
                          <ProviderMark provider={provider} />
                          {t(`liveOperator.providers.${provider.id}`)}
                        </span>
                        <span className="text-rs-ink-4">
                          {t(`liveOperator.providerRoles.${provider.id}`)}
                        </span>
                        <StatusDot tone={statusTone(provider.status)}>
                          {t(provider.status === null && props.readinessLoading ? "liveOperator.refreshing" : statusKey(provider.status))}
                        </StatusDot>
                        <Icon
                          name="chevron-down"
                          className={open ? "rotate-180" : ""}
                        />
                      </button>
                      {provider.id === "firecrawl" ? <EnginePicker /> : null}
                    </div>
                    {open ? (
                      <div className="animate-rs-fade-up grid gap-[var(--space-4)] pb-[var(--space-7)] pl-[var(--space-16)] text-sm text-rs-ink-4 min-[760px]:grid-cols-2">
                        <div>
                          <span className="text-rs-ink-6">
                            {t("liveOperator.configuration")}{" "}
                          </span>
                          {t(provider.status === null && props.readinessLoading ? "liveOperator.refreshing" : statusKey(provider.status))}
                        </div>
                        <div>
                          <span className="text-rs-ink-6">
                            {t("liveOperator.health")}{" "}
                          </span>
                          {t("liveOperator.healthUnknown")}
                        </div>
                        <p className="min-[760px]:col-span-2">
                          {t("liveOperator.configuredNotHealthy")}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      case "flags":
        return (
          <div>
            <PageIntro
              title={t("liveOperator.flagsTitle")}
              lead={t("liveOperator.flagsSubtitle")}
            />
            <div className="mt-[var(--space-12)] divide-y divide-rs-border-divider-soft">
              {(["voice", "publicSearch"] as const).map((flag) => (
                <div
                  key={flag}
                  className="flex items-center justify-between gap-[var(--space-8)] py-[var(--space-7)]"
                >
                  <div>
                    <div className="text-[length:var(--text-body-lg-size)]">
                      {t(`liveOperator.flagRows.${flag}.label`)}
                    </div>
                    <p className="mt-[var(--space-2)] text-sm text-rs-ink-4">
                      {t(`liveOperator.flagRows.${flag}.effect`)}
                    </p>
                  </div>
                  <div className="flex items-center gap-[var(--space-5)]">
                    <StatusDot tone="idle">
                      {t("liveOperator.unknownState")}
                    </StatusDot>
                    <Switch
                      disabled
                      checked={false}
                      label={t(`liveOperator.flagRows.${flag}.label`)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-[var(--space-6)] text-sm text-rs-ink-6">
              {t("liveOperator.flagsLimitation")}
            </p>
            <Button
              className="mt-[var(--space-8)]"
              variant="secondary"
              size="xs"
              disabled
            >
              {t("liveOperator.saveFlags")}
            </Button>
          </div>
        );
      case "diag":
        return (
          <div>
            <PageIntro
              title={t("liveOperator.diagTitle")}
              lead={t("liveOperator.diagSubtitle")}
            />
            {props.readinessError ? (
              <Card size="sm" tone="warning" className="mt-[var(--space-12)]">
                <p role="alert">{props.readinessError}</p>
              </Card>
            ) : null}
            <Overline className="mt-[var(--space-12)]">
              {t("liveOperator.recentEvents")}
            </Overline>
            <ActivityList
              activity={props.activity}
              empty={t("liveOperator.noDiagnostics")}
            />
            <div className="mt-[var(--space-8)] flex gap-[var(--space-4)]">
              <Button
                variant="secondary"
                size="xs"
                onClick={props.onRefreshReadiness}
                disabled={props.readinessLoading}
              >
                {t(
                  props.readinessLoading
                    ? "liveOperator.refreshing"
                    : "liveOperator.refresh",
                )}
              </Button>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => props.onToolOpen("audit")}
              >
                {t("liveOperator.openAudit")}
              </Button>
            </div>
            <p className="mt-[var(--space-6)] text-sm text-rs-ink-6">
              {t("liveOperator.diagLimitation")}
            </p>
          </div>
        );
    }
  })();
  return (
    <StageBackground position="fixed" contentClassName="h-full">
      <AppHeader
        initials={t("liveOperator.avatarInitials")}
        avatarLabel={t("liveOperator.avatarLabel")}
        right={
          <Badge
            variant="pill"
            className="h-[var(--size-header-button)] gap-[var(--space-4)] border-rs-border-card-strong bg-rs-surface-subtle"
          >
            <StatusDot tone="success">
              {t("liveOperator.environment")}
            </StatusDot>
          </Badge>
        }
      />
      <PanelDialog
        open
        onOpenChange={(open) => {
          if (!open) props.onClose();
        }}
        title={t("liveOperator.title")}
        rootLabel={t("liveOperator.title")}
        navLabel={t("liveOperator.title")}
        closeLabel={t("common.close")}
        groups={groups}
        currentId={props.section}
        back={{ label: t("operator.nav.back"), onSelect: props.onClose }}
        navHeader={
          <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-5)] px-[var(--space-4)]">
            <BrandLockup size="md" />
            <Badge variant="outline">{t("operator.badge.internal")}</Badge>
          </div>
        }
        footer={
          <div className="px-[var(--space-4)] text-[length:var(--text-body-sm-size)] text-rs-ink-4">
            <details>
              <summary className="cursor-pointer text-rs-ink">
                {t("liveOperator.advancedTools")}
              </summary>
              <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-2)]">
                {(Object.keys(TOOLS) as LiveOperatorToolId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="flex cursor-pointer items-center gap-[var(--space-3)] text-left hover:text-rs-orange-light"
                    onClick={() => props.onToolOpen(id)}
                  >
                    <Icon name={TOOLS[id].icon} size={15} />
                    {t(TOOLS[id].label)}
                  </button>
                ))}
              </div>
            </details>
            <p className="mt-[var(--space-4)]">
              {t("operator.nav.footerNote")}
            </p>
          </div>
        }
      >
        {page}
        <p className="mt-[var(--space-13)] text-center text-[13px] text-rs-ink-6">
          {t("liveOperator.footer")}
        </p>
      </PanelDialog>
    </StageBackground>
  );
}
