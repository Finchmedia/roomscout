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
import type * as aiModelSmoke from "../aiModelSmoke.js";
import type * as auth from "../auth.js";
import type * as autonomy from "../autonomy.js";
import type * as autonomyGate from "../autonomyGate.js";
import type * as browserbasePortal from "../browserbasePortal.js";
import type * as browserbaseSessionProof from "../browserbaseSessionProof.js";
import type * as communications from "../communications.js";
import type * as controlledPersonalInboxProof from "../controlledPersonalInboxProof.js";
import type * as controlledSourceProof from "../controlledSourceProof.js";
import type * as controlledSourceProofActions from "../controlledSourceProofActions.js";
import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as decisions from "../decisions.js";
import type * as demoReset from "../demoReset.js";
import type * as demoSourceBootstrap from "../demoSourceBootstrap.js";
import type * as demoSourceBootstrapActions from "../demoSourceBootstrapActions.js";
import type * as demoSourceCheckActions from "../demoSourceCheckActions.js";
import type * as demoSourceChecks from "../demoSourceChecks.js";
import type * as devUserReset from "../devUserReset.js";
import type * as devUserResetActions from "../devUserResetActions.js";
import type * as evaluation_contracts from "../evaluation/contracts.js";
import type * as evaluation_prompts from "../evaluation/prompts.js";
import type * as evaluation_scenarios from "../evaluation/scenarios.js";
import type * as evaluationGateway from "../evaluationGateway.js";
import type * as externalActions from "../externalActions.js";
import type * as firecrawl from "../firecrawl.js";
import type * as firecrawlDetails from "../firecrawlDetails.js";
import type * as firecrawlInteract from "../firecrawlInteract.js";
import type * as firecrawlMonitor from "../firecrawlMonitor.js";
import type * as firecrawlPortal from "../firecrawlPortal.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as inbox from "../inbox.js";
import type * as ingestion from "../ingestion.js";
import type * as integrations_agentmailPayload from "../integrations/agentmailPayload.js";
import type * as integrations_agentmailWebhookBootstrap from "../integrations/agentmailWebhookBootstrap.js";
import type * as integrations_auth from "../integrations/auth.js";
import type * as integrations_authz from "../integrations/authz.js";
import type * as integrations_contentHash from "../integrations/contentHash.js";
import type * as integrations_controlledPortalPolicy from "../integrations/controlledPortalPolicy.js";
import type * as integrations_controlledSourceProofConfig from "../integrations/controlledSourceProofConfig.js";
import type * as integrations_env from "../integrations/env.js";
import type * as integrations_fingerprints from "../integrations/fingerprints.js";
import type * as integrations_firecrawlInteractClient from "../integrations/firecrawlInteractClient.js";
import type * as integrations_firecrawlPortalEngine from "../integrations/firecrawlPortalEngine.js";
import type * as integrations_firecrawlPortalRuntime from "../integrations/firecrawlPortalRuntime.js";
import type * as integrations_firecrawlProgram from "../integrations/firecrawlProgram.js";
import type * as integrations_monitorReconciliation from "../integrations/monitorReconciliation.js";
import type * as integrations_piiRedaction from "../integrations/piiRedaction.js";
import type * as integrations_portalBrowserEngine from "../integrations/portalBrowserEngine.js";
import type * as integrations_portalDomEvidence from "../integrations/portalDomEvidence.js";
import type * as integrations_portalFormInspection from "../integrations/portalFormInspection.js";
import type * as integrations_portalSafety from "../integrations/portalSafety.js";
import type * as integrations_portalVerification from "../integrations/portalVerification.js";
import type * as integrations_portalWriteAdapters from "../integrations/portalWriteAdapters.js";
import type * as integrations_providerReadiness from "../integrations/providerReadiness.js";
import type * as integrations_publicImageUrl from "../integrations/publicImageUrl.js";
import type * as integrations_reviewedPortalUrl from "../integrations/reviewedPortalUrl.js";
import type * as integrations_secureCompare from "../integrations/secureCompare.js";
import type * as integrations_sourceEntryExtraction from "../integrations/sourceEntryExtraction.js";
import type * as integrations_sourceProbeAdapters from "../integrations/sourceProbeAdapters.js";
import type * as integrations_stagehandPortalDriver from "../integrations/stagehandPortalDriver.js";
import type * as integrations_stagehandV4Runtime from "../integrations/stagehandV4Runtime.js";
import type * as integrations_structuredConvexGateway from "../integrations/structuredConvexGateway.js";
import type * as integrations_urlCanonicalization from "../integrations/urlCanonicalization.js";
import type * as lib_actionPayload from "../lib/actionPayload.js";
import type * as lib_autonomy from "../lib/autonomy.js";
import type * as lib_autonomyGate from "../lib/autonomyGate.js";
import type * as lib_candidateDisposition from "../lib/candidateDisposition.js";
import type * as lib_conversationProgress from "../lib/conversationProgress.js";
import type * as lib_corroboration from "../lib/corroboration.js";
import type * as lib_currentSearchTruth from "../lib/currentSearchTruth.js";
import type * as lib_decisions from "../lib/decisions.js";
import type * as lib_demoProvenance from "../lib/demoProvenance.js";
import type * as lib_demoReset from "../lib/demoReset.js";
import type * as lib_liveDiscoveryContext from "../lib/liveDiscoveryContext.js";
import type * as lib_matchAssessment from "../lib/matchAssessment.js";
import type * as lib_matchValidity from "../lib/matchValidity.js";
import type * as lib_messageSafety from "../lib/messageSafety.js";
import type * as lib_musicianIdentity from "../lib/musicianIdentity.js";
import type * as lib_needLifecycle from "../lib/needLifecycle.js";
import type * as lib_offerAcceptance from "../lib/offerAcceptance.js";
import type * as lib_privacy from "../lib/privacy.js";
import type * as lib_providerAssessment from "../lib/providerAssessment.js";
import type * as lib_providerPortal from "../lib/providerPortal.js";
import type * as lib_savedNeedLocation from "../lib/savedNeedLocation.js";
import type * as lib_sourceCandidate from "../lib/sourceCandidate.js";
import type * as lib_sourceDiscoveryQueries from "../lib/sourceDiscoveryQueries.js";
import type * as lib_voiceClaim from "../lib/voiceClaim.js";
import type * as lib_voiceEndIntent from "../lib/voiceEndIntent.js";
import type * as mailboxes from "../mailboxes.js";
import type * as map from "../map.js";
import type * as matchAssessmentProof from "../matchAssessmentProof.js";
import type * as matchAssessments from "../matchAssessments.js";
import type * as matches from "../matches.js";
import type * as matchingCore from "../matchingCore.js";
import type * as memory from "../memory.js";
import type * as messageSafety from "../messageSafety.js";
import type * as migrations from "../migrations.js";
import type * as musicianProfile from "../musicianProfile.js";
import type * as offerAcceptance from "../offerAcceptance.js";
import type * as openaiEmbeddings from "../openaiEmbeddings.js";
import type * as opportunities from "../opportunities.js";
import type * as ops from "../ops.js";
import type * as opsActions from "../opsActions.js";
import type * as outreach from "../outreach.js";
import type * as platformInbox from "../platformInbox.js";
import type * as portalBrowserCleanup from "../portalBrowserCleanup.js";
import type * as portalBrowserMaintenance from "../portalBrowserMaintenance.js";
import type * as portalConnections from "../portalConnections.js";
import type * as portalInboxSync from "../portalInboxSync.js";
import type * as portalNotifications from "../portalNotifications.js";
import type * as portalWriteQueue from "../portalWriteQueue.js";
import type * as prompts_roomScoutLive from "../prompts/roomScoutLive.js";
import type * as prompts_roomScoutPersonality from "../prompts/roomScoutPersonality.js";
import type * as providerActions from "../providerActions.js";
import type * as providerConversations from "../providerConversations.js";
import type * as resetMarketIndex from "../resetMarketIndex.js";
import type * as savedNeeds from "../savedNeeds.js";
import type * as scout from "../scout.js";
import type * as scoutCandidates from "../scoutCandidates.js";
import type * as scoutCaseCards from "../scoutCaseCards.js";
import type * as scoutOrchestrator from "../scoutOrchestrator.js";
import type * as scoutRuntime from "../scoutRuntime.js";
import type * as searchSources from "../searchSources.js";
import type * as settings from "../settings.js";
import type * as signals from "../signals.js";
import type * as sourceAdapters from "../sourceAdapters.js";
import type * as sourceDiscovery from "../sourceDiscovery.js";
import type * as sourceDiscoveryActions from "../sourceDiscoveryActions.js";
import type * as sourceIntelligence from "../sourceIntelligence.js";
import type * as sourcePolicies from "../sourcePolicies.js";
import type * as sourceProbeWorker from "../sourceProbeWorker.js";
import type * as sourceProbes from "../sourceProbes.js";
import type * as sourceRegistry from "../sourceRegistry.js";
import type * as stagehandFormSmoke from "../stagehandFormSmoke.js";
import type * as stagehandSmoke from "../stagehandSmoke.js";
import type * as users from "../users.js";
import type * as voice from "../voice.js";
import type * as voiceLive from "../voiceLive.js";
import type * as workpools from "../workpools.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentmail: typeof agentmail;
  agentmailComponent: typeof agentmailComponent;
  ai: typeof ai;
  aiModelSmoke: typeof aiModelSmoke;
  auth: typeof auth;
  autonomy: typeof autonomy;
  autonomyGate: typeof autonomyGate;
  browserbasePortal: typeof browserbasePortal;
  browserbaseSessionProof: typeof browserbaseSessionProof;
  communications: typeof communications;
  controlledPersonalInboxProof: typeof controlledPersonalInboxProof;
  controlledSourceProof: typeof controlledSourceProof;
  controlledSourceProofActions: typeof controlledSourceProofActions;
  conversations: typeof conversations;
  crons: typeof crons;
  decisions: typeof decisions;
  demoReset: typeof demoReset;
  demoSourceBootstrap: typeof demoSourceBootstrap;
  demoSourceBootstrapActions: typeof demoSourceBootstrapActions;
  demoSourceCheckActions: typeof demoSourceCheckActions;
  demoSourceChecks: typeof demoSourceChecks;
  devUserReset: typeof devUserReset;
  devUserResetActions: typeof devUserResetActions;
  "evaluation/contracts": typeof evaluation_contracts;
  "evaluation/prompts": typeof evaluation_prompts;
  "evaluation/scenarios": typeof evaluation_scenarios;
  evaluationGateway: typeof evaluationGateway;
  externalActions: typeof externalActions;
  firecrawl: typeof firecrawl;
  firecrawlDetails: typeof firecrawlDetails;
  firecrawlInteract: typeof firecrawlInteract;
  firecrawlMonitor: typeof firecrawlMonitor;
  firecrawlPortal: typeof firecrawlPortal;
  health: typeof health;
  http: typeof http;
  inbox: typeof inbox;
  ingestion: typeof ingestion;
  "integrations/agentmailPayload": typeof integrations_agentmailPayload;
  "integrations/agentmailWebhookBootstrap": typeof integrations_agentmailWebhookBootstrap;
  "integrations/auth": typeof integrations_auth;
  "integrations/authz": typeof integrations_authz;
  "integrations/contentHash": typeof integrations_contentHash;
  "integrations/controlledPortalPolicy": typeof integrations_controlledPortalPolicy;
  "integrations/controlledSourceProofConfig": typeof integrations_controlledSourceProofConfig;
  "integrations/env": typeof integrations_env;
  "integrations/fingerprints": typeof integrations_fingerprints;
  "integrations/firecrawlInteractClient": typeof integrations_firecrawlInteractClient;
  "integrations/firecrawlPortalEngine": typeof integrations_firecrawlPortalEngine;
  "integrations/firecrawlPortalRuntime": typeof integrations_firecrawlPortalRuntime;
  "integrations/firecrawlProgram": typeof integrations_firecrawlProgram;
  "integrations/monitorReconciliation": typeof integrations_monitorReconciliation;
  "integrations/piiRedaction": typeof integrations_piiRedaction;
  "integrations/portalBrowserEngine": typeof integrations_portalBrowserEngine;
  "integrations/portalDomEvidence": typeof integrations_portalDomEvidence;
  "integrations/portalFormInspection": typeof integrations_portalFormInspection;
  "integrations/portalSafety": typeof integrations_portalSafety;
  "integrations/portalVerification": typeof integrations_portalVerification;
  "integrations/portalWriteAdapters": typeof integrations_portalWriteAdapters;
  "integrations/providerReadiness": typeof integrations_providerReadiness;
  "integrations/publicImageUrl": typeof integrations_publicImageUrl;
  "integrations/reviewedPortalUrl": typeof integrations_reviewedPortalUrl;
  "integrations/secureCompare": typeof integrations_secureCompare;
  "integrations/sourceEntryExtraction": typeof integrations_sourceEntryExtraction;
  "integrations/sourceProbeAdapters": typeof integrations_sourceProbeAdapters;
  "integrations/stagehandPortalDriver": typeof integrations_stagehandPortalDriver;
  "integrations/stagehandV4Runtime": typeof integrations_stagehandV4Runtime;
  "integrations/structuredConvexGateway": typeof integrations_structuredConvexGateway;
  "integrations/urlCanonicalization": typeof integrations_urlCanonicalization;
  "lib/actionPayload": typeof lib_actionPayload;
  "lib/autonomy": typeof lib_autonomy;
  "lib/autonomyGate": typeof lib_autonomyGate;
  "lib/candidateDisposition": typeof lib_candidateDisposition;
  "lib/conversationProgress": typeof lib_conversationProgress;
  "lib/corroboration": typeof lib_corroboration;
  "lib/currentSearchTruth": typeof lib_currentSearchTruth;
  "lib/decisions": typeof lib_decisions;
  "lib/demoProvenance": typeof lib_demoProvenance;
  "lib/demoReset": typeof lib_demoReset;
  "lib/liveDiscoveryContext": typeof lib_liveDiscoveryContext;
  "lib/matchAssessment": typeof lib_matchAssessment;
  "lib/matchValidity": typeof lib_matchValidity;
  "lib/messageSafety": typeof lib_messageSafety;
  "lib/musicianIdentity": typeof lib_musicianIdentity;
  "lib/needLifecycle": typeof lib_needLifecycle;
  "lib/offerAcceptance": typeof lib_offerAcceptance;
  "lib/privacy": typeof lib_privacy;
  "lib/providerAssessment": typeof lib_providerAssessment;
  "lib/providerPortal": typeof lib_providerPortal;
  "lib/savedNeedLocation": typeof lib_savedNeedLocation;
  "lib/sourceCandidate": typeof lib_sourceCandidate;
  "lib/sourceDiscoveryQueries": typeof lib_sourceDiscoveryQueries;
  "lib/voiceClaim": typeof lib_voiceClaim;
  "lib/voiceEndIntent": typeof lib_voiceEndIntent;
  mailboxes: typeof mailboxes;
  map: typeof map;
  matchAssessmentProof: typeof matchAssessmentProof;
  matchAssessments: typeof matchAssessments;
  matches: typeof matches;
  matchingCore: typeof matchingCore;
  memory: typeof memory;
  messageSafety: typeof messageSafety;
  migrations: typeof migrations;
  musicianProfile: typeof musicianProfile;
  offerAcceptance: typeof offerAcceptance;
  openaiEmbeddings: typeof openaiEmbeddings;
  opportunities: typeof opportunities;
  ops: typeof ops;
  opsActions: typeof opsActions;
  outreach: typeof outreach;
  platformInbox: typeof platformInbox;
  portalBrowserCleanup: typeof portalBrowserCleanup;
  portalBrowserMaintenance: typeof portalBrowserMaintenance;
  portalConnections: typeof portalConnections;
  portalInboxSync: typeof portalInboxSync;
  portalNotifications: typeof portalNotifications;
  portalWriteQueue: typeof portalWriteQueue;
  "prompts/roomScoutLive": typeof prompts_roomScoutLive;
  "prompts/roomScoutPersonality": typeof prompts_roomScoutPersonality;
  providerActions: typeof providerActions;
  providerConversations: typeof providerConversations;
  resetMarketIndex: typeof resetMarketIndex;
  savedNeeds: typeof savedNeeds;
  scout: typeof scout;
  scoutCandidates: typeof scoutCandidates;
  scoutCaseCards: typeof scoutCaseCards;
  scoutOrchestrator: typeof scoutOrchestrator;
  scoutRuntime: typeof scoutRuntime;
  searchSources: typeof searchSources;
  settings: typeof settings;
  signals: typeof signals;
  sourceAdapters: typeof sourceAdapters;
  sourceDiscovery: typeof sourceDiscovery;
  sourceDiscoveryActions: typeof sourceDiscoveryActions;
  sourceIntelligence: typeof sourceIntelligence;
  sourcePolicies: typeof sourcePolicies;
  sourceProbeWorker: typeof sourceProbeWorker;
  sourceProbes: typeof sourceProbes;
  sourceRegistry: typeof sourceRegistry;
  stagehandFormSmoke: typeof stagehandFormSmoke;
  stagehandSmoke: typeof stagehandSmoke;
  users: typeof users;
  voice: typeof voice;
  voiceLive: typeof voiceLive;
  workpools: typeof workpools;
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
  scoutWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"scoutWorkpool">;
  browserWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"browserWorkpool">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
  agentmail: import("@agentmail/convex/_generated/component.js").ComponentApi<"agentmail">;
  stagehandRoomScout: import("../components/stagehandRoomScout/_generated/component.js").ComponentApi<"stagehandRoomScout">;
  firecrawlRoomScout: import("../components/firecrawlRoomScout/_generated/component.js").ComponentApi<"firecrawlRoomScout">;
};
