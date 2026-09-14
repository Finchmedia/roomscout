export type SearchSourceStatus =
  | "watching"
  | "partial"
  | "connection_required"
  | "under_review"
  | "unavailable";

export type SearchSourceCoverage = {
  id: string;
  name: string;
  domain: string;
  side: "supply" | "demand" | "both";
  status: SearchSourceStatus;
  access: "public" | "portal" | "partner";
  included: boolean;
  lastCheckedLabel?: string;
  signalCount?: number;
  note?: string;
};

export type PortalConnectionStatus =
  | "connected"
  | "needs_attention"
  | "paused"
  | "not_connected";

export type PortalConnection = {
  id: string;
  sourceId?: string;
  name: string;
  domain?: string;
  status: PortalConnectionStatus;
  canAuthenticate?: boolean;
  canSync?: boolean;
  identityLabel?: string;
  scopes: string[];
  lastVerifiedLabel?: string;
  note?: string;
};

export type ConnectablePortalSource = {
  id: string;
  name: string;
  domain: string;
  url: string;
  platformName?: string;
};

export type BrowserRunState =
  | "queued"
  | "agent_running"
  | "human_required"
  | "human_controlling"
  | "ready_to_resume"
  | "approval_required"
  | "completed"
  | "stopped"
  | "failed";

export type BrowserRunStep = {
  id: string;
  label: string;
  state: "done" | "active" | "pending" | "blocked";
};

export type BrowserRun = {
  id: string;
  sourceName: string;
  sourceDomain?: string;
  searchTitle: string;
  policyLabel: string;
  state: BrowserRunState;
  liveViewUrl?: string;
  humanPrompt?: string;
  steps: BrowserRunStep[];
};

export type CommunicationChannel = "email" | "webform" | "platform_dm";

export type ActionApprovalKind =
  | "send_email"
  | "submit_webform"
  | "send_platform_dm"
  | "create_portal_account"
  | "publish_listing"
  | "share_contact_details"
  | "propose_visit_time";

export type ActionApprovalRequest = {
  id: string;
  kind: ActionApprovalKind;
  destination: string;
  actingAs: string;
  effect: string;
  fields: Array<{ label: string; value: string; editable?: boolean }>;
  contentVersion: number;
  authorization:
    | { mode: "approve_once" }
    | {
        mode: "autopilot";
        autonomyVersion: number;
        autonomyLabel: string;
        executionAllowed: boolean;
      };
};

export type Opportunity = {
  id: string;
  title: string;
  counterparty: string;
  confirmed: string[];
  unresolved: string[];
  recommendedNextStep: string;
  status: "qualified" | "visit_proposed" | "visit_confirmed" | "agreement_received" | "handed_off";
  sourceLinks?: Array<{ label: string; url: string }>;
};
