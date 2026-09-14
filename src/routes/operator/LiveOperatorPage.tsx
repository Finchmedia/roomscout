import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useAction, useMutation, useQuery } from "convex/react";
import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Card } from "../../components/ui/card";
import { showToast } from "../../components/ui/sonner";
import { StageBackground } from "../../ui/chrome/StageBackground";
import { LiveOperatorSurface, type LiveOperatorMetric, type LiveOperatorProvider, type LiveOperatorSection, type LiveOperatorToolId } from "../../ui/operator/live";
import { useCopy } from "../../ui/copy";

const SECTIONS = new Set<LiveOperatorSection>(["overview", "sources", "tasks", "integrations", "flags", "diag"]);
const TOOL_PATHS: Record<LiveOperatorToolId, string> = {
  sources: "/ops/tools/sources", signals: "/ops/tools/signals",
  outreach: "/ops/tools/outreach", inbox: "/ops/tools/inbox", audit: "/ops/tools/audit",
};

/** `demoSourceChecks.status` states that mean a run is still in flight. */
const CHECK_RUNNING = new Set(["queued", "scraping", "processing", "waiting"]);

function isSection(value: string | undefined): value is LiveOperatorSection {
  return value !== undefined && SECTIONS.has(value as LiveOperatorSection);
}

function errorCodeOf(error: unknown): string | undefined {
  if (!(error instanceof ConvexError)) return undefined;
  const data: unknown = error.data;
  if (typeof data === "object" && data !== null && "code" in data) {
    const code = (data as { code: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

export function LiveOperatorPage() {
  const { t } = useCopy();
  const navigate = useNavigate();
  const { section: sectionParam } = useParams();
  const section = sectionParam === "activity" ? "tasks" : isSection(sectionParam) ? sectionParam : "overview";
  const currentUser = useQuery(api.users.current);
  const isOperator = currentUser?.role === "operator";
  const overview = useQuery(api.ops.overview, isOperator ? {} : "skip");
  const onSources = isOperator && section === "sources";
  const sources = useQuery(api.ops.listSources, onSources ? { limit: 40 } : "skip");
  const checkStatus = useQuery(api.demoSourceChecks.status, onSources ? {} : "skip");
  const setSourceActive = useMutation(api.sourceRegistry.setSourceActive);
  const requestCheck = useMutation(api.demoSourceChecks.requestNow);
  const checkReadiness = useAction(api.opsActions.providerReadiness);
  // Captured once so every row formats its stamp against the same clock.
  const [now] = React.useState(() => Date.now());
  const [checkPending, setCheckPending] = React.useState(false);
  const [readiness, setReadiness] = React.useState<FunctionReturnType<typeof api.opsActions.providerReadiness> | null>(null);
  const [readinessLoading, setReadinessLoading] = React.useState(false);
  const [readinessError, setReadinessError] = React.useState<string>();

  const refreshReadiness = React.useCallback(() => {
    if (!isOperator || readinessLoading) return;
    setReadinessLoading(true);
    setReadinessError(undefined);
    void checkReadiness({})
      .then(setReadiness)
      .catch(() => setReadinessError(t("liveOperator.checkFailed")))
      .finally(() => setReadinessLoading(false));
  }, [checkReadiness, isOperator, readinessLoading, t]);

  const toggleSource = React.useCallback(
    async (sourceId: string, active: boolean) => {
      try {
        await setSourceActive({ sourceId: sourceId as Id<"sources">, active });
      } catch (error: unknown) {
        showToast(
          t(
            errorCodeOf(error) === "SOURCE_REVIEW_REQUIRED"
              ? "liveOperator.sourceReviewRequired"
              : "liveOperator.sourceToggleFailed",
          ),
        );
      }
    },
    [setSourceActive, t],
  );

  const checkSources = React.useCallback(() => {
    if (checkPending) return;
    setCheckPending(true);
    void requestCheck({ requestId: `manual:${Date.now()}` })
      .catch(() => { showToast(t("liveOperator.checkStartFailed")); })
      .finally(() => { setCheckPending(false); });
  }, [checkPending, requestCheck, t]);

  if (currentUser === undefined || (isOperator && overview === undefined)) return <OperatorRouteState status>{t("liveOperator.accessChecking")}</OperatorRouteState>;
  if (!isOperator || !overview) return <OperatorRouteState>{t("liveOperator.accessDenied")}</OperatorRouteState>;

  const metrics: LiveOperatorMetric[] = [
    { id: "publishedSignals", value: overview.metrics.publishedSignals },
    { id: "staleSignals", value: overview.metrics.staleSignals, attention: overview.metrics.staleSignals > 0 },
    { id: "detailBacklog", value: overview.metrics.detailBacklog },
    { id: "detailFailures", value: overview.metrics.detailFailures, attention: overview.metrics.detailFailures > 0 },
    { id: "awaitingApproval", value: overview.metrics.awaitingApproval, attention: overview.metrics.awaitingApproval > 0 },
    { id: "repliedThreads", value: overview.metrics.repliedThreads },
    { id: "unhealthySources", value: overview.metrics.unhealthySources, attention: overview.metrics.unhealthySources > 0 },
    { id: "activeVoiceSessions", value: overview.metrics.activeVoiceSessions },
    { id: "activeMailboxes", value: overview.metrics.activeMailboxes },
  ];
  const providers: LiveOperatorProvider[] = readiness ? (["firecrawl", "agentmail", "mapbox", "openaiDirect"] as const).map((id) => ({ id, status: readiness[id].status })) : [];

  return <LiveOperatorSurface
    section={section}
    metrics={metrics}
    activity={overview.activity}
    providers={providers}
    sources={sources?.map((source) => ({
      id: source._id,
      name: source.name,
      region: source.geographicScope,
      status: source.status,
      health: source.health,
      accessMode: source.accessMode,
      baseUrl: source.baseUrl,
      lastCheckedAt: source.lastCheckedAt,
    }))}
    boundedSample={overview.boundedSample}
    readinessLoading={readinessLoading}
    readinessError={readinessError}
    now={now}
    sourceCheckRunning={checkPending || CHECK_RUNNING.has(checkStatus?.status ?? "idle")}
    onRefreshReadiness={refreshReadiness}
    onCheckSources={checkSources}
    onToggleSource={toggleSource}
    onSectionChange={(next) => navigate(next === "overview" ? "/ops" : `/ops/${next}`)}
    onToolOpen={(tool) => navigate(TOOL_PATHS[tool])}
    onClose={() => navigate("/app/scout")}
  />;
}

function OperatorRouteState({ children, status = false }: { children: React.ReactNode; status?: boolean }) {
  return <StageBackground position="fixed"><main className="relative z-2 flex min-h-dvh items-center justify-center px-[var(--space-11)]"><Card size="lg" tone="panel"><h1 role={status ? "status" : undefined} className="text-[length:var(--text-card-title-size)] font-light">{children}</h1></Card></main></StageBackground>;
}
