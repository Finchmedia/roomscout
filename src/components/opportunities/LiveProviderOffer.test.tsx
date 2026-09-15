import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { liveScoutDe } from "../../ui/copy/de/liveScout";
import { LiveProviderOffer } from "./LiveProviderOffer";

vi.mock("../../ui/copy", () => ({
  useCopy: () => ({
    t: (key: string, vars?: Record<string, string>) => (vars ? `${key}:${Object.values(vars).join(",")}` : key),
    locale: "de",
  }),
}));

vi.mock("./OfferAcceptanceDialog", () => ({
  OfferAcceptanceFlow: ({ expectedOfferHash, offerId }: { expectedOfferHash: string; offerId: string }) => (
    <div data-testid="acceptance-flow">{offerId}:{expectedOfferHash}</div>
  ),
}));

afterEach(cleanup);

const baseOffer = {
  offerId: "offer-current",
  revision: 2,
  current: true,
  ready: true,
  contentHash: "offer-current-hash",
  blockers: [],
  assessment: {
    summary: "Tuesday room",
    availability: { status: "available", evidence: [] },
    monthlyPrice: { totalEur: 240, allRecurringCostsKnown: true, evidence: [] },
    terms: [{ key: "storage", label: "Storage", value: "Included", evidence: [] }],
    constraints: [],
    uncertainties: [],
    contradictions: [],
    nextAction: "present_offer",
    suggestedReply: null,
  },
};

function conversation(overrides: Record<string, unknown> = {}) {
  return ({
    conversationId: "conversation-current",
    savedNeedId: "need-current",
    signalId: "signal-current",
    platformThreadId: "platform-thread",
    state: "offer_ready",
    revision: 2,
    updatedAt: 10,
    offer: baseOffer,
    ...overrides,
  }) as never;
}

/** Every stamp and the „unknown“ window read this moment, never the wall clock. */
const NOW = new Date(2026, 8, 14, 11, 0).getTime();

function renderOffer(value: ReturnType<typeof conversation>, now: number = NOW) {
  return render(<MemoryRouter><LiveProviderOffer conversation={value} now={now} /></MemoryRouter>);
}

describe("LiveProviderOffer acceptance gating", () => {
  it("shows partial offer blockers without exposing acceptance review", () => {
    renderOffer(conversation({
      offer: {
        ...baseOffer,
        ready: false,
        blockers: ["Confirm recurring electricity costs"],
      },
    }));
    expect(screen.getByText("Confirm recurring electricity costs")).toBeVisible();
    expect(screen.queryByRole("button", { name: "liveScout.review" })).not.toBeInTheDocument();
  });

  it("renders a compact interim state while the Scout is still clarifying", () => {
    expect(liveScoutDe.interimLabel).toBe("Zwischenstand");
    expect(liveScoutDe.clarifying).toBe("Ich kläre noch:");
    renderOffer(conversation({
      offer: {
        ...baseOffer,
        ready: false,
        blockers: ["One", "Two", "Three", "Four"],
      },
    }));
    expect(screen.getByText("liveScout.interimLabel")).toBeVisible();
    expect(screen.getByText("liveScout.clarifying")).toBeVisible();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["One", "Two", "Three"]);
    expect(screen.getByRole("link", { name: "liveScout.viewMessages" })).toBeVisible();
    expect(screen.queryByText("liveScout.offerLabel")).not.toBeInTheDocument();
    expect(screen.queryByText("liveScout.terms")).not.toBeInTheDocument();
    expect(screen.queryByText("liveScout.offerNote")).not.toBeInTheDocument();
    expect(screen.queryByText("Tuesday room")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "liveScout.review" })).not.toBeInTheDocument();
  });

  it("renders the full offer card with review once the offer is ready on a platform thread", () => {
    expect(liveScoutDe.offerLabel).toBe("Angebot eingegangen");
    renderOffer(conversation());
    expect(screen.getByText("liveScout.offerLabel")).toBeVisible();
    expect(screen.getByText("liveScout.terms")).toBeVisible();
    expect(screen.getByText("Tuesday room")).toBeVisible();
    expect(screen.getByRole("button", { name: "liveScout.review" })).toBeVisible();
    expect(screen.queryByText("liveScout.interimLabel")).not.toBeInTheDocument();
  });

  it("opens exact acceptance flow only for a current ready platform offer", () => {
    renderOffer(conversation());
    fireEvent.click(screen.getByRole("button", { name: "liveScout.review" }));
    expect(screen.getByTestId("acceptance-flow")).toHaveTextContent("offer-current:offer-current-hash");
  });

  it.each(["approved", "queued"])("blocks a second review while acceptance delivery is %s", (acceptanceStatus) => {
    renderOffer(conversation({ acceptanceStatus }));
    expect(screen.getByRole("status")).toHaveTextContent("liveScout.pendingAcceptance");
    expect(screen.queryByRole("button", { name: "liveScout.review" })).not.toBeInTheDocument();
  });

  it("calls an unknown outcome a delivery still confirming itself for the first three minutes", () => {
    renderOffer(conversation({ acceptanceStatus: "unknown", updatedAt: NOW - 60_000 }));
    expect(screen.getByRole("status")).toHaveTextContent("liveScout.unknownAcceptance");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("liveScout.pendingAcceptance")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "liveScout.review" })).not.toBeInTheDocument();
  });

  it("says plainly that the Versand is unconfirmed once the window has passed", () => {
    renderOffer(conversation({ acceptanceStatus: "unknown", updatedAt: NOW - 4 * 60_000 }));
    expect(screen.getByRole("alert")).toHaveTextContent("liveScout.unconfirmedAcceptance");
    expect(screen.queryByText("liveScout.unknownAcceptance")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "liveScout.review" })).not.toBeInTheDocument();
  });

  it("stamps a Zusage that is confirmed sent", () => {
    renderOffer(conversation({
      acceptanceStatus: "executed",
      acceptedOfferId: "offer-current",
      acceptedAt: new Date(2026, 8, 14, 9, 41).getTime(),
    }));
    expect(screen.getByRole("status")).toHaveTextContent("liveScout.sentAcceptance:Heute, 09:41");
  });

  it("blocks review only when the displayed offer is the executed accepted revision", () => {
    const { rerender } = renderOffer(conversation({
      acceptanceStatus: "executed",
      acceptedOfferId: "offer-current",
      acceptedAt: 20,
    }));
    expect(screen.queryByRole("button", { name: "liveScout.review" })).not.toBeInTheDocument();

    rerender(<MemoryRouter><LiveProviderOffer now={NOW} conversation={conversation({
      acceptanceStatus: "executed",
      acceptedOfferId: "offer-historical",
      acceptedAt: 20,
    })} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "liveScout.review" })).toBeVisible();
    expect(screen.queryByText(/accepted offer/i)).not.toBeInTheDocument();
  });
});
