import { contentHash } from "./contentHash";
import {
  buildAllowedPortalUrl,
  isAllowedHostname,
} from "./portalSafety";

export type SourceProbeFlow =
  | "discovery"
  | "listing"
  | "contact"
  | "reply"
  | "auth";

export type SourceProbeExecutor = "firecrawl" | "browserbase";

type ReviewedProbeAdapter = {
  executor: SourceProbeExecutor;
  adapterKey: string;
  configKey: string;
  flows: readonly SourceProbeFlow[];
};

/**
 * This is intentionally a code-owned registry. Database bindings select one of
 * these reviewed programs, but cannot inject selectors, JavaScript, or an
 * arbitrary browser workflow.
 */
const REVIEWED_PROBE_ADAPTERS: readonly ReviewedProbeAdapter[] = [
  {
    executor: "firecrawl",
    adapterKey: "generic-list-v1",
    configKey: "generic-list-v1",
    flows: ["discovery", "listing"],
  },
  {
    executor: "firecrawl",
    adapterKey: "bandnet-contact-v1",
    configKey: "bandnet-contact-form-v1",
    flows: ["contact"],
  },
  {
    executor: "browserbase",
    adapterKey: "generic-readonly-recon-v1",
    configKey: "generic-readonly-recon.v1",
    flows: ["discovery", "listing", "contact", "auth"],
  },
  {
    executor: "browserbase",
    adapterKey: "generic-platform-inbox-v1",
    configKey: "generic-platform-inbox.v1",
    flows: ["reply"],
  },
] as const;

export function resolveReviewedProbeAdapter(input: {
  executor: SourceProbeExecutor;
  adapterKey: string;
  configKey: string;
  flow: SourceProbeFlow;
}): ReviewedProbeAdapter | null {
  const adapterKey = input.adapterKey.trim().toLowerCase();
  const configKey = input.configKey.trim().toLowerCase();
  return (
    REVIEWED_PROBE_ADAPTERS.find(
      (adapter) =>
        adapter.executor === input.executor &&
        adapter.adapterKey === adapterKey &&
        adapter.configKey === configKey &&
        adapter.flows.includes(input.flow),
    ) ?? null
  );
}

export function assertReviewedProbeUrl(input: {
  targetUrl: string;
  canonicalDomain: string;
  allowedDomains: readonly string[];
  allowedPaths: readonly string[];
}): string {
  const url = new URL(input.targetUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !isAllowedHostname(url.hostname, [input.canonicalDomain])
  ) {
    throw new Error("PROBE_TARGET_DOMAIN_NOT_ALLOWED");
  }
  return buildAllowedPortalUrl({
    baseUrl: url.origin,
    path: `${url.pathname}${url.search}`,
    allowedDomains: input.allowedDomains,
    allowedPaths: input.allowedPaths,
  });
}

export type RawProbeObservation = {
  finalUrl: string;
  linkCount: number;
  sameDomainLinkCount: number;
  formCount: number;
  passwordFieldCount: number;
  submitControlCount: number;
  captchaPresent: boolean;
  loginSurfacePresent: boolean;
  sourceMaterial: string;
};

export type NormalizedProbeObservation = {
  itemsObserved: number;
  resultCode: string;
  summary: string;
  evidenceHash: string;
  facts: Array<{
    category: "access" | "contact" | "auth" | "flow";
    key: string;
    value:
      | { kind: "text"; value: string }
      | { kind: "number"; value: number }
      | { kind: "boolean"; value: boolean };
    confidence: number;
  }>;
};

function boundedCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10_000, Math.floor(value)));
}

export async function normalizeProbeObservation(input: {
  flow: SourceProbeFlow;
  maxItems: number;
  observation: RawProbeObservation;
}): Promise<NormalizedProbeObservation> {
  const linkCount = boundedCount(input.observation.linkCount);
  const sameDomainLinkCount = boundedCount(
    input.observation.sameDomainLinkCount,
  );
  const formCount = boundedCount(input.observation.formCount);
  const passwordFieldCount = boundedCount(
    input.observation.passwordFieldCount,
  );
  const submitControlCount = boundedCount(
    input.observation.submitControlCount,
  );
  const itemsObserved = Math.min(
    Math.max(1, Math.floor(input.maxItems)),
    input.flow === "contact"
      ? formCount
      : input.flow === "auth"
        ? passwordFieldCount
        : sameDomainLinkCount,
  );
  const facts: NormalizedProbeObservation["facts"] = [
    {
      category: "access",
      key: `probe.${input.flow}.reachable`,
      value: { kind: "boolean", value: true },
      confidence: 0.9,
    },
    {
      category: "flow",
      key: `probe.${input.flow}.same_domain_links`,
      value: { kind: "number", value: sameDomainLinkCount },
      confidence: 0.85,
    },
  ];
  if (input.flow === "contact") {
    facts.push(
      {
        category: "contact",
        key: "probe.contact.form_present",
        value: { kind: "boolean", value: formCount > 0 },
        confidence: 0.9,
      },
      {
        category: "contact",
        key: "probe.contact.submit_control_present",
        value: { kind: "boolean", value: submitControlCount > 0 },
        confidence: 0.8,
      },
      {
        category: "contact",
        key: "probe.contact.captcha_present",
        value: {
          kind: "boolean",
          value: input.observation.captchaPresent,
        },
        confidence: 0.8,
      },
    );
  }
  if (input.flow === "auth" || input.flow === "reply") {
    facts.push({
      category: "auth",
      key: `probe.${input.flow}.login_surface_present`,
      value: {
        kind: "boolean",
        value: input.observation.loginSurfacePresent,
      },
      confidence: 0.8,
    });
  }
  const evidenceHash = await contentHash([
    "roomscout-source-probe-v1",
    input.flow,
    input.observation.finalUrl,
    String(linkCount),
    String(sameDomainLinkCount),
    String(formCount),
    String(passwordFieldCount),
    String(submitControlCount),
    String(input.observation.captchaPresent),
    String(input.observation.loginSurfacePresent),
    input.observation.sourceMaterial,
  ]);
  const summary =
    input.flow === "contact"
      ? `Inspected contact surface: ${formCount} form(s), ${submitControlCount} submit control(s); no form was filled or submitted.`
      : input.flow === "auth"
        ? `Inspected authentication surface: ${passwordFieldCount} password field(s); no credentials were entered.`
        : input.flow === "reply"
          ? `Inspected connected reply surface and observed ${sameDomainLinkCount} same-domain link(s); no message was opened, changed, or sent.`
          : `Inspected listing surface and observed ${sameDomainLinkCount} same-domain link(s), bounded to ${itemsObserved} probe item(s).`;
  return {
    itemsObserved,
    resultCode: "READ_ONLY_PROBE_SUCCEEDED",
    summary,
    evidenceHash,
    facts,
  };
}
