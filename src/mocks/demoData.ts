export type SignalSide = "supply" | "demand";
export type VerificationState =
  | "observed"
  | "source_verified"
  | "user_verified";
export type FreshnessState = "fresh" | "current" | "possibly_stale";

export type SignalFact = {
  label: string;
  value: string;
  unknown?: boolean;
};

export type MarketSignal = {
  id: string;
  side: SignalSide;
  verification: VerificationState;
  freshness: FreshnessState;
  freshnessLabel: string;
  title: string;
  location: string;
  arrangement?: string;
  source: string;
  firstSeen: string;
  facts: SignalFact[];
  summary: string;
  fit?: string;
  unknowns?: string[];
};

export type SearchField = {
  label: string;
  value: string;
  source: "you" | "scout";
};

export type SavedSearch = {
  id: string;
  title: string;
  status: "draft" | "active" | "paused";
  fields: SearchField[];
};

export type ScoutMessage = {
  id: string;
  author: "scout" | "user" | "system";
  body: string;
};

export type MailMessage = {
  id: string;
  direction: "inbound" | "outbound";
  sender: string;
  timestamp: string;
  status?: string;
  subject?: string;
  body: string;
};

export type MailThread = {
  id: string;
  correspondent: string;
  preview: string;
  updatedAt: string;
  status: string;
  searchTitle: string;
  signalId: string;
  messages: MailMessage[];
  parsedFacts: SignalFact[];
  interpretation: string;
};

export const demoSignals: MarketSignal[] = [
  {
    id: "stuttgart-west-share",
    side: "supply",
    verification: "observed",
    freshness: "fresh",
    freshnessLabel: "Checked 18 min ago",
    title: "Shared rehearsal room in Stuttgart-West",
    location: "Stuttgart-West",
    arrangement: "Fixed monthly",
    source: "Musikboard Süd",
    firstSeen: "First seen today",
    facts: [
      { label: "Price", value: "€220 / month" },
      { label: "Times", value: "Tuesday + Thursday evenings" },
      { label: "Storage", value: "Mentioned in listing" },
      { label: "Drum kit", value: "Not stated", unknown: true },
    ],
    summary:
      "A band offers two free evenings in its fixed room. Storage is mentioned; the listing does not explain whether drums are workable or how access is handled.",
    fit: "Fits the demo search budget and preferred area. The open question is the drum policy.",
    unknowns: [
      "Drum kit policy is not mentioned.",
      "Room size and floor level are not stated.",
      "The access and key arrangement is unclear.",
    ],
  },
  {
    id: "bad-cannstatt-hourly",
    side: "supply",
    verification: "source_verified",
    freshness: "current",
    freshnessLabel: "Checked 45 min ago",
    title: "Hourly equipped practice room in Bad Cannstatt",
    location: "Bad Cannstatt",
    arrangement: "Hourly",
    source: "Proberaum24",
    firstSeen: "First seen 3 weeks ago",
    facts: [
      { label: "Price", value: "€20 / hour" },
      { label: "Included", value: "Drum kit + PA" },
      { label: "Booking", value: "Flexible" },
    ],
    summary:
      "An equipped hourly room with flexible booking. Useful as a fallback, but not a permanent room.",
  },
  {
    id: "post-punk-demand",
    side: "demand",
    verification: "observed",
    freshness: "current",
    freshnessLabel: "Last seen today",
    title: "Post-punk band looking for a fixed room",
    location: "Stuttgart-West",
    source: "Musikerbörse",
    firstSeen: "Public signal",
    facts: [
      { label: "Budget", value: "Up to €250 / month" },
      { label: "Times", value: "Weeknight use" },
      {
        label: "Status",
        value: "Poster not verified on RoomScout",
        unknown: true,
      },
    ],
    summary:
      "A public room-wanted post. It is an observed market signal, not a RoomScout member profile.",
  },
  {
    id: "feuerbach-basement",
    side: "supply",
    verification: "observed",
    freshness: "possibly_stale",
    freshnessLabel: "Last seen 11 days ago",
    title: "Basement room near Feuerbach",
    location: "Feuerbach",
    arrangement: "Long-term lease suggested",
    source: "Kleinanzeigen BW",
    firstSeen: "First seen 2 months ago",
    facts: [
      { label: "Price", value: "Unknown", unknown: true },
      { label: "Times", value: "Not stated", unknown: true },
      { label: "Note", value: "Source unavailable during latest check" },
    ],
    summary:
      "A potentially useful long-term room, but the source could not be checked recently.",
  },
  {
    id: "jazz-trio-demand",
    side: "demand",
    verification: "user_verified",
    freshness: "current",
    freshnessLabel: "Confirmed 2 days ago",
    title: "Jazz trio seeking daytime rehearsal access",
    location: "Stuttgart-South",
    source: "RoomScout member",
    firstSeen: "Active",
    facts: [
      { label: "Budget", value: "Flexible", unknown: true },
      { label: "Times", value: "Flexible weekdays, daytime" },
      { label: "Status", value: "Verified need on RoomScout" },
    ],
    summary: "A verified saved need for flexible daytime rehearsal access.",
  },
  {
    id: "wangen-warehouse",
    side: "supply",
    verification: "observed",
    freshness: "current",
    freshnessLabel: "Checked 2 h ago",
    title: "Rehearsal space in shared warehouse, Wangen",
    location: "Wangen",
    arrangement: "Fixed monthly",
    source: "Musikboard Süd",
    firstSeen: "First seen 5 days ago",
    facts: [
      { label: "Price", value: "€310 / month" },
      { label: "Times", value: "24/7 access" },
      { label: "Note", value: "Above the demo budget filter" },
    ],
    summary: "A fixed warehouse room with broad access but a higher price.",
  },
];

export const demoNewSignal: MarketSignal = {
  id: "stuttgart-south-room-share",
  side: "supply",
  verification: "observed",
  freshness: "fresh",
  freshnessLabel: "Detected seconds ago",
  title: "Room share offer, Stuttgart-South — drums explicitly OK",
  location: "Stuttgart-South",
  arrangement: "Fixed monthly · €240/month",
  source: "Musikboard Süd",
  firstSeen: "First seen just now",
  facts: [
    { label: "Price", value: "€240 / month" },
    { label: "Times", value: "Monday, Wednesday + Friday" },
    { label: "Drums", value: "Explicitly allowed" },
    { label: "Storage", value: "Not stated", unknown: true },
  ],
  summary:
    "A new time-sharing offer in Stuttgart-South with drums explicitly permitted.",
  fit: "Matches the demo search on budget, area, weekday evenings, and drums. Storage remains unknown.",
};

export const demoSearch: SavedSearch = {
  id: "permanent-room-four-piece",
  title: "Permanent room for a four-piece band",
  status: "active",
  fields: [
    { label: "Location", value: "Stuttgart W/S · 8 km", source: "you" },
    { label: "Arrangement", value: "Fixed monthly", source: "you" },
    { label: "Budget", value: "≤ €250 / month", source: "you" },
    { label: "Schedule", value: "Weekday evenings", source: "you" },
    { label: "Essential", value: "Drums · secure storage", source: "you" },
    { label: "Band size", value: "4", source: "scout" },
    { label: "Sharing", value: "Open to time-sharing", source: "you" },
  ],
};

export const demoScoutMessages: ScoutMessage[] = [
  {
    id: "intro",
    author: "scout",
    body: "Tell me what kind of room you need — in your own words. I will turn it into a search you can review before anything becomes active.",
  },
];

export const demoThread: MailThread = {
  id: "klangraum-west",
  correspondent: "Klangraum West",
  preview:
    "No fixed room right now, but Tuesday evenings may open next month…",
  updatedAt: "12 min ago",
  status: "Awaiting your action",
  searchTitle: demoSearch.title,
  signalId: demoSignals[0]?.id ?? "stuttgart-west-share",
  messages: [
    {
      id: "out-1",
      direction: "outbound",
      sender: "You → Klangraum West",
      timestamp: "Today 15:02",
      status: "Approved · delivered",
      subject: "Rehearsal-room availability for a four-piece band",
      body: "Hi,\n\nwe're a four-piece band from Stuttgart looking for a permanent rehearsal room. Your shared room in Stuttgart-West caught our eye. Are drums workable, and is secure overnight storage included?\n\nThanks!\nVera · vierteltakt",
    },
    {
      id: "in-1",
      direction: "inbound",
      sender: "Klangraum West → You",
      timestamp: "Today 16:41",
      body: "Hallo Vera,\n\ndanke für eure Nachricht! Aktuell ist leider kein fester Raum frei. Ab nächstem Monat könnte aber der Dienstagabend frei werden. Schlagzeug ist kein Problem und abschließbarer Lagerraum ist vorhanden. Wärt ihr offen, den Raum mit einer anderen Band zu teilen?\n\nViele Grüße\nKlangraum West",
    },
  ],
  parsedFacts: [
    { label: "Fixed room", value: "None available right now" },
    { label: "Opening", value: "Tuesday evenings may open next month" },
    { label: "Drums", value: "Allowed" },
    { label: "Storage", value: "Lockable storage available" },
    { label: "Question", value: "Would you share with another band?" },
    { label: "Price", value: "Still unknown", unknown: true },
  ],
  interpretation:
    "The search is open to time-sharing, so this could work. A reply should confirm interest in Tuesday and ask for the price.",
};

export type ReviewCandidate = {
  id: string;
  title: string;
  subtitle: string;
  side: SignalSide;
  source: string;
  reason: string;
  tone: "new" | "warning" | "neutral";
  age: string;
};

export const demoReviewCandidates: ReviewCandidate[] = [
  {
    id: demoNewSignal.id,
    title: demoNewSignal.title,
    subtitle: "€240/month · drums OK",
    side: "supply",
    source: "Musikboard Süd",
    reason: "New",
    tone: "new",
    age: "40 s",
  },
  {
    id: "price-conflict",
    title: "Proberaum frei in S-Ost, 25 m²",
    subtitle: "Price conflict: €180 vs €210",
    side: "supply",
    source: "Kleinanzeigen BW",
    reason: "Conflicting facts",
    tone: "warning",
    age: "2 h",
  },
  {
    id: "possible-demand-duplicate",
    title: "Suche Proberaum Stuttgart Mitte",
    subtitle: "Similar to existing demand signal",
    side: "demand",
    source: "Musikerbörse",
    reason: "Possible duplicate",
    tone: "warning",
    age: "3 h",
  },
  {
    id: "possibly-stale",
    title: "Basement room near Feuerbach",
    subtitle: "Source unavailable during last check",
    side: "supply",
    source: "Kleinanzeigen BW",
    reason: "Possibly stale",
    tone: "warning",
    age: "11 d",
  },
];

export const demoActivity = [
  { time: "16:58", title: "Check ok", detail: "Musikboard Süd, 2 changed items", kind: "New" },
  { time: "16:55", title: "Published", detail: "Room share offer → visible to matching searches", kind: "Publish" },
  { time: "16:51", title: "Normalized", detail: "Extracted price €240 and drums allowed", kind: "Extract" },
  { time: "16:42", title: "Reply parsed", detail: "Klangraum West → routed to its user", kind: "Mail" },
  { time: "16:30", title: "Check failed", detail: "Kleinanzeigen BW, timeout (2nd)", kind: "Degraded" },
] as const;
