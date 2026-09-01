import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import { LedgerCard } from "../ui/LedgerCard";

type Readiness = FunctionReturnType<typeof api.opsActions.providerReadiness>;

type ProviderReadinessPanelProps = {
  readiness: Readiness | null;
  loading: boolean;
  error: string | null;
  frontendMapboxConfigured: boolean;
  onRefresh: () => void;
};

function mark(configured: boolean, label: string) {
  return (
    <span className={`pill ${configured ? "new" : "warn"}`} key={label}>
      {label}: {configured ? "set" : "missing"}
    </span>
  );
}

function statusTone(status: string) {
  return status === "configured" ? "new" : status === "client_only" ? "" : "warn";
}

export function ProviderReadinessPanel({
  readiness,
  loading,
  error,
  frontendMapboxConfigured,
  onRefresh,
}: ProviderReadinessPanelProps) {
  const providers = readiness
    ? [
        {
          name: "Firecrawl",
          status: readiness.firecrawl.status,
          checks: [
            mark(readiness.firecrawl.apiKeyConfigured, "Key"),
            mark(readiness.firecrawl.webhookSecretConfigured, "Crawl HMAC"),
            mark(
              readiness.firecrawl.monitorWebhookBearerConfigured,
              "Monitor bearer",
            ),
            mark(
              readiness.firecrawl.webhookUrlConfigured &&
                readiness.firecrawl.webhookUrlValid,
              "Webhook URL",
            ),
            mark(readiness.firecrawl.monitorsEnabled, "Monitors"),
          ],
          reasons: readiness.firecrawl.reasons,
        },
        {
          name: "AgentMail",
          status: readiness.agentmail.status,
          checks: [
            mark(readiness.agentmail.apiKeyConfigured, "Key"),
            mark(readiness.agentmail.webhookSecretConfigured, "Webhook secret"),
            mark(readiness.agentmail.addressSaltConfigured, "Address salt"),
            mark(readiness.agentmail.customDomainConfigured, "Custom domain"),
          ],
          reasons: readiness.agentmail.reasons,
        },
        {
          name: "Browserbase",
          status: readiness.browserbase.status,
          checks: [mark(readiness.browserbase.apiKeyConfigured, "Key presence")],
          reasons: readiness.browserbase.reasons,
        },
        {
          name: "Mapbox server",
          status: readiness.mapbox.status,
          checks: [mark(readiness.mapbox.serverTokenConfigured, "Geocoding token")],
          reasons: readiness.mapbox.reasons,
        },
        {
          name: "OpenAI direct",
          status: readiness.openaiDirect.status,
          checks: [
            mark(readiness.openaiDirect.apiKeyConfigured, "Key"),
            mark(
              readiness.openaiDirect.realtimeOriginsConfigured &&
                readiness.openaiDirect.realtimeOriginsValid &&
                readiness.openaiDirect.productionOriginConfigured,
              "Realtime origins",
            ),
          ],
          reasons: readiness.openaiDirect.reasons,
        },
        {
          name: "Mapbox browser",
          status: frontendMapboxConfigured ? "configured" : "incomplete",
          checks: [mark(frontendMapboxConfigured, "Build-time token")],
          reasons: [
            ...readiness.frontendMapbox.reasons,
            frontendMapboxConfigured
              ? "This frontend build contains a public browser token; domain restriction and provider acceptance still need a live proof."
              : "This frontend build does not contain the browser token, so the globe and map cannot render.",
          ],
        },
      ]
    : [];

  return (
    <LedgerCard
      className="rs-provider-readiness"
      header={
        <>
          <span className="type">Provider readiness</span>
          <span className="mono">Presence and shape checks only</span>
        </>
      }
    >
      <div className="rs-provider-readiness__summary">
        <p>
          Secrets never leave Convex. A configured badge proves configuration
          presence and basic shape—not provider acceptance or a successful live run.
        </p>
        <button className="btn btn-s btn-sm" disabled={loading} onClick={onRefresh} type="button">
          {loading ? "Checking…" : "Refresh"}
        </button>
      </div>
      {error ? <p className="err" role="alert">{error}</p> : null}
      {!readiness && loading ? (
        <p className="hint">Reading deployment configuration through the operator-only backend check…</p>
      ) : null}
      {readiness ? (
        <>
          <div className="fitline">
            {readiness.configuredProviders} of {readiness.serverProviderCount} server providers configured.
            The browser Mapbox token is evaluated separately in this deployed frontend.
          </div>
          <div className="rs-provider-readiness__list">
            {providers.map((provider) => (
              <section className="rs-provider-readiness__item" key={provider.name}>
                <div className="rs-provider-readiness__heading">
                  <h3>{provider.name}</h3>
                  <span className={`pill ${statusTone(provider.status)}`}>{provider.status.replaceAll("_", " ")}</span>
                </div>
                <div className="rs-provider-readiness__checks">{provider.checks}</div>
                {provider.reasons.map((reason) => <p className="hint" key={reason}>{reason}</p>)}
              </section>
            ))}
          </div>
        </>
      ) : null}
    </LedgerCard>
  );
}
