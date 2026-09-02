/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentmail from "../agentmail.js";
import type * as agentmailComponent from "../agentmailComponent.js";
import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as browserbasePortal from "../browserbasePortal.js";
import type * as communications from "../communications.js";
import type * as controlledSourceProof from "../controlledSourceProof.js";
import type * as controlledSourceProofActions from "../controlledSourceProofActions.js";
import type * as crons from "../crons.js";
import type * as externalActions from "../externalActions.js";
import type * as firecrawl from "../firecrawl.js";
import type * as firecrawlDetails from "../firecrawlDetails.js";
import type * as firecrawlInteract from "../firecrawlInteract.js";
import type * as firecrawlMonitor from "../firecrawlMonitor.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as inbox from "../inbox.js";
import type * as ingestion from "../ingestion.js";
import type * as integrations_agentmailPayload from "../integrations/agentmailPayload.js";
import type * as integrations_agentmailWebhookBootstrap from "../integrations/agentmailWebhookBootstrap.js";
import type * as integrations_auth from "../integrations/auth.js";
import type * as integrations_authz from "../integrations/authz.js";
import type * as integrations_contentHash from "../integrations/contentHash.js";
import type * as integrations_controlledSourceProofConfig from "../integrations/controlledSourceProofConfig.js";
import type * as integrations_env from "../integrations/env.js";
import type * as integrations_fingerprints from "../integrations/fingerprints.js";
import type * as integrations_firecrawlInteractClient from "../integrations/firecrawlInteractClient.js";
import type * as integrations_monitorReconciliation from "../integrations/monitorReconciliation.js";
import type * as integrations_piiRedaction from "../integrations/piiRedaction.js";
import type * as integrations_portalSafety from "../integrations/portalSafety.js";
import type * as integrations_portalVerification from "../integrations/portalVerification.js";
import type * as integrations_portalWriteAdapters from "../integrations/portalWriteAdapters.js";
import type * as integrations_providerReadiness from "../integrations/providerReadiness.js";
import type * as integrations_secureCompare from "../integrations/secureCompare.js";
import type * as integrations_sourceEntryExtraction from "../integrations/sourceEntryExtraction.js";
import type * as integrations_sourceProbeAdapters from "../integrations/sourceProbeAdapters.js";
import type * as integrations_structuredConvexGateway from "../integrations/structuredConvexGateway.js";
import type * as integrations_urlCanonicalization from "../integrations/urlCanonicalization.js";
import type * as lib_actionPayload from "../lib/actionPayload.js";
import type * as lib_corroboration from "../lib/corroboration.js";
import type * as lib_mandateAuthorization from "../lib/mandateAuthorization.js";
import type * as lib_privacy from "../lib/privacy.js";
import type * as lib_sourceCandidate from "../lib/sourceCandidate.js";
import type * as lib_sourceDiscoveryQueries from "../lib/sourceDiscoveryQueries.js";
import type * as mailboxes from "../mailboxes.js";
import type * as mandateOrchestrator from "../mandateOrchestrator.js";
import type * as mandates from "../mandates.js";
import type * as map from "../map.js";
import type * as matches from "../matches.js";
import type * as matchingCore from "../matchingCore.js";
import type * as memory from "../memory.js";
import type * as migrations from "../migrations.js";
import type * as openaiEmbeddings from "../openaiEmbeddings.js";
import type * as opportunities from "../opportunities.js";
import type * as ops from "../ops.js";
import type * as opsActions from "../opsActions.js";
import type * as outreach from "../outreach.js";
import type * as platformInbox from "../platformInbox.js";
import type * as portalConnections from "../portalConnections.js";
import type * as rateLimits from "../rateLimits.js";
import type * as savedNeeds from "../savedNeeds.js";
import type * as scout from "../scout.js";
import type * as scoutCaseCards from "../scoutCaseCards.js";
import type * as searchSources from "../searchSources.js";
import type * as signals from "../signals.js";
import type * as sourceAdapters from "../sourceAdapters.js";
import type * as sourceDiscovery from "../sourceDiscovery.js";
import type * as sourceDiscoveryActions from "../sourceDiscoveryActions.js";
import type * as sourceIntelligence from "../sourceIntelligence.js";
import type * as sourcePolicies from "../sourcePolicies.js";
import type * as sourceProbeWorker from "../sourceProbeWorker.js";
import type * as sourceProbes from "../sourceProbes.js";
import type * as sourceRegistry from "../sourceRegistry.js";
import type * as users from "../users.js";
import type * as voice from "../voice.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentmail: typeof agentmail;
  agentmailComponent: typeof agentmailComponent;
  ai: typeof ai;
  auth: typeof auth;
  browserbasePortal: typeof browserbasePortal;
  communications: typeof communications;
  controlledSourceProof: typeof controlledSourceProof;
  controlledSourceProofActions: typeof controlledSourceProofActions;
  crons: typeof crons;
  externalActions: typeof externalActions;
  firecrawl: typeof firecrawl;
  firecrawlDetails: typeof firecrawlDetails;
  firecrawlInteract: typeof firecrawlInteract;
  firecrawlMonitor: typeof firecrawlMonitor;
  health: typeof health;
  http: typeof http;
  inbox: typeof inbox;
  ingestion: typeof ingestion;
  "integrations/agentmailPayload": typeof integrations_agentmailPayload;
  "integrations/agentmailWebhookBootstrap": typeof integrations_agentmailWebhookBootstrap;
  "integrations/auth": typeof integrations_auth;
  "integrations/authz": typeof integrations_authz;
  "integrations/contentHash": typeof integrations_contentHash;
  "integrations/controlledSourceProofConfig": typeof integrations_controlledSourceProofConfig;
  "integrations/env": typeof integrations_env;
  "integrations/fingerprints": typeof integrations_fingerprints;
  "integrations/firecrawlInteractClient": typeof integrations_firecrawlInteractClient;
  "integrations/monitorReconciliation": typeof integrations_monitorReconciliation;
  "integrations/piiRedaction": typeof integrations_piiRedaction;
  "integrations/portalSafety": typeof integrations_portalSafety;
  "integrations/portalVerification": typeof integrations_portalVerification;
  "integrations/portalWriteAdapters": typeof integrations_portalWriteAdapters;
  "integrations/providerReadiness": typeof integrations_providerReadiness;
  "integrations/secureCompare": typeof integrations_secureCompare;
  "integrations/sourceEntryExtraction": typeof integrations_sourceEntryExtraction;
  "integrations/sourceProbeAdapters": typeof integrations_sourceProbeAdapters;
  "integrations/structuredConvexGateway": typeof integrations_structuredConvexGateway;
  "integrations/urlCanonicalization": typeof integrations_urlCanonicalization;
  "lib/actionPayload": typeof lib_actionPayload;
  "lib/corroboration": typeof lib_corroboration;
  "lib/mandateAuthorization": typeof lib_mandateAuthorization;
  "lib/privacy": typeof lib_privacy;
  "lib/sourceCandidate": typeof lib_sourceCandidate;
  "lib/sourceDiscoveryQueries": typeof lib_sourceDiscoveryQueries;
  mailboxes: typeof mailboxes;
  mandateOrchestrator: typeof mandateOrchestrator;
  mandates: typeof mandates;
  map: typeof map;
  matches: typeof matches;
  matchingCore: typeof matchingCore;
  memory: typeof memory;
  migrations: typeof migrations;
  openaiEmbeddings: typeof openaiEmbeddings;
  opportunities: typeof opportunities;
  ops: typeof ops;
  opsActions: typeof opsActions;
  outreach: typeof outreach;
  platformInbox: typeof platformInbox;
  portalConnections: typeof portalConnections;
  rateLimits: typeof rateLimits;
  savedNeeds: typeof savedNeeds;
  scout: typeof scout;
  scoutCaseCards: typeof scoutCaseCards;
  searchSources: typeof searchSources;
  signals: typeof signals;
  sourceAdapters: typeof sourceAdapters;
  sourceDiscovery: typeof sourceDiscovery;
  sourceDiscoveryActions: typeof sourceDiscoveryActions;
  sourceIntelligence: typeof sourceIntelligence;
  sourcePolicies: typeof sourcePolicies;
  sourceProbeWorker: typeof sourceProbeWorker;
  sourceProbes: typeof sourceProbes;
  sourceRegistry: typeof sourceRegistry;
  users: typeof users;
  voice: typeof voice;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/core/_generated/component.js").ComponentApi<"auth">;
  authUsername: import("@convex-dev/auth/username/_generated/component.js").ComponentApi<"authUsername">;
  authPasswordProvider: import("@convex-dev/auth/providers/password/_generated/component.js").ComponentApi<"authPasswordProvider">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
  agentmail: import("@agentmail/convex/_generated/component.js").ComponentApi<"agentmail">;
  firecrawlRoomScout: import("../components/firecrawlRoomScout/_generated/component.js").ComponentApi<"firecrawlRoomScout">;
};
