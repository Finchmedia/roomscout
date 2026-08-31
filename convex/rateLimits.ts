import {
  DAY,
  HOUR,
  MINUTE,
  RateLimiter,
} from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const roomScoutRateLimiter = new RateLimiter(components.rateLimiter, {
  scoutMessage: { kind: "fixed window", rate: 10, period: MINUTE },
  contextImport: { kind: "fixed window", rate: 3, period: HOUR },
  voiceSession: { kind: "fixed window", rate: 3, period: HOUR },
  voiceTool: { kind: "fixed window", rate: 30, period: MINUTE },
  agentMailUser: { kind: "fixed window", rate: 10, period: DAY },
  agentMailGlobal: { kind: "fixed window", rate: 50, period: DAY },
  portalReconUser: { kind: "fixed window", rate: 3, period: HOUR },
  portalReconSource: { kind: "fixed window", rate: 5, period: DAY },
  portalAuthSource: { kind: "fixed window", rate: 3, period: DAY },
  portalInboxSource: { kind: "fixed window", rate: 2, period: HOUR },
  portalWriteUser: { kind: "fixed window", rate: 10, period: DAY },
  portalWriteSource: { kind: "fixed window", rate: 20, period: DAY },
  portalSessionGlobal: { kind: "fixed window", rate: 20, period: DAY },
  sourceDiscoveryOperator: { kind: "fixed window", rate: 10, period: DAY },
  firecrawlInteractUser: { kind: "fixed window", rate: 10, period: DAY },
});
