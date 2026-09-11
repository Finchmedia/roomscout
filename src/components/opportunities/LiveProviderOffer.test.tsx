import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveProviderOffer } from "./LiveProviderOffer";

vi.mock("../../ui/copy", () => ({
  useCopy: () => ({ t: (key: string) => key }),
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

function renderOffer(value: ReturnType<typeof conversation>) {
  return render(<MemoryRouter><LiveProviderOffer conversation={value} /></MemoryRouter>);
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

  it("distinguishes an unknown provider outcome from an in-flight delivery", () => {
    renderOffer(conversation({ acceptanceStatus: "unknown" }));
    expect(screen.getByRole("alert")).toHaveTextContent("liveScout.unknownAcceptance");
    expect(screen.queryByText("liveScout.pendingAcceptance")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "liveScout.review" })).not.toBeInTheDocument();
  });

  it("blocks review only when the displayed offer is the executed accepted revision", () => {
    const { rerender } = renderOffer(conversation({
      acceptanceStatus: "executed",
      acceptedOfferId: "offer-current",
      acceptedAt: 20,
    }));
    expect(screen.queryByRole("button", { name: "liveScout.review" })).not.toBeInTheDocument();

    rerender(<MemoryRouter><LiveProviderOffer conversation={conversation({
      acceptanceStatus: "executed",
      acceptedOfferId: "offer-historical",
      acceptedAt: 20,
    })} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "liveScout.review" })).toBeVisible();
    expect(screen.queryByText(/accepted offer/i)).not.toBeInTheDocument();
  });
});
