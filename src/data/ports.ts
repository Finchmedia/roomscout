export type SignalSide = "supply" | "demand";
export type VerificationState = "observed" | "verified" | "conflicting";
export type FreshnessState = "fresh" | "aging" | "stale";

export type SignalSummary = {
  id: string;
  side: SignalSide;
  title: string;
  city: string;
  district?: string;
  arrangement: "permanent" | "shared" | "hourly" | "unknown";
  priceLabel: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  firstSeenLabel: string;
  lastSeenLabel: string;
  freshness: FreshnessState;
  verification: VerificationState;
  requirements: string[];
  unknowns: string[];
  fitExplanation?: string;
};

export type SearchNeed = {
  id: string;
  title: string;
  city: string;
  districts: string[];
  maxBudgetEur?: number;
  arrangements: Array<"permanent" | "shared" | "hourly">;
  schedule: string[];
  requirements: string[];
  openToSharing?: boolean;
  status: "draft" | "active" | "paused" | "archived";
};

export type ScoutMessage = {
  id: string;
  role: "user" | "assistant";
  body: string;
  createdAtLabel: string;
};

export type OutreachDraft = {
  id: string;
  signalId: string;
  searchId: string;
  recipientName: string;
  recipientEmail: string;
  recipientSource: string;
  subject: string;
  body: string;
  contentVersion: number;
  status:
    | "drafted"
    | "awaiting_approval"
    | "approved"
    | "sending"
    | "sent"
    | "replied"
    | "failed";
};

export type MailMessage = {
  id: string;
  direction: "inbound" | "outbound";
  sender: string;
  recipients: string[];
  body: string;
  timestampLabel: string;
  deliveryLabel?: string;
};

export type MailThread = {
  id: string;
  participant: string;
  subject: string;
  status: "sent" | "awaiting_reply" | "replied" | "closed" | "failed";
  lastMessageLabel: string;
  signalId: string;
  searchId: string;
  messages: MailMessage[];
  parsedSummary?: string;
  parsedFacts?: string[];
};

export type SignalFilters = {
  city?: string;
  side?: SignalSide | "all";
  arrangement?: SignalSummary["arrangement"] | "all";
};

export interface SignalsPort {
  list(filters: SignalFilters): Promise<SignalSummary[]>;
  get(signalId: string): Promise<SignalSummary | null>;
}

export interface SearchPort {
  getActive(): Promise<SearchNeed | null>;
  save(search: SearchNeed): Promise<SearchNeed>;
}

export interface ScoutPort {
  listMessages(): Promise<ScoutMessage[]>;
  sendMessage(message: string): Promise<ScoutMessage>;
}

export interface OutreachPort {
  getDraft(): Promise<OutreachDraft | null>;
  revise(draft: OutreachDraft): Promise<OutreachDraft>;
  approve(draftId: string, contentVersion: number): Promise<OutreachDraft>;
}

export interface InboxPort {
  listThreads(): Promise<MailThread[]>;
  getThread(threadId: string): Promise<MailThread | null>;
}
