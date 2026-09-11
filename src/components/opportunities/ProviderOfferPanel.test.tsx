import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ComponentProps } from "react";
import { ProviderOfferPanel } from "./ProviderOfferPanel";
afterEach(cleanup);

function conversation(): ComponentProps<typeof ProviderOfferPanel>["conversation"] {
  return {
    conversationId: "conversation" as never, savedNeedId: "need" as never, signalId: "signal" as never,
    state: "needs_attention", revision: 1, updatedAt: 1,
    assessmentFromProviderReply: true,
    mailThreadId: undefined, platformThreadId: undefined, errorCode: undefined, replyStatus: undefined,
    acceptanceStatus: undefined, acceptanceRequestId: undefined, acceptedOfferId: undefined, acceptedAt: undefined,
    offer: {
      offerId: "offer" as never, revision: 1, current: true, ready: false, contentHash: "hash",
      blockers: ["Please confirm the drum policy"],
      assessment: {
        summary: "A room is available but the drum policy is unresolved.",
        availability: { status: "available", evidence: [] },
        monthlyPrice: { totalEur: 220, allRecurringCostsKnown: true, evidence: [] },
        terms: [{ key: "storage", label: "Storage", value: "Allowed", evidence: [] }],
        constraints: [], uncertainties: ["Drum policy"], contradictions: [], nextAction: "ask_provider",
        suggestedReply: { subject: "Drum policy", body: "May we keep and play a drum kit in the room?" },
      },
    },
  };
}

describe("provider assessment panel", () => {
  it("shows the actual terms, unresolved questions and unsent proposal", () => {
    render(<ProviderOfferPanel conversation={conversation()} />);
    expect(screen.getByText("Storage")).toBeVisible();
    expect(screen.getByText("Please confirm the drum policy")).toBeVisible();
    expect(screen.getByText("Suggested reply · not sent")).toBeVisible();
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
  });
  it("makes a stale offer unmistakable instead of keeping a ready badge", () => {
    const input = conversation(); input.offer!.current = false; input.offer!.ready = false;
    render(<ProviderOfferPanel conversation={input} />);
    expect(screen.getByRole("status")).toHaveTextContent("out of date");
    expect(screen.getByText(/Needs reassessment/)).toBeVisible();
  });
  it("offers acceptance review only for a current ready offer in a platform thread", () => {
    const input = conversation();
    input.platformThreadId = "thread" as never;
    input.offer!.ready = true;
    render(<ProviderOfferPanel conversation={input} />);
    expect(screen.getByRole("button", { name: "Review acceptance" })).toBeVisible();
  });
  it.each([
    [false, true],
    [true, false],
  ])("does not offer acceptance when current=%s and ready=%s", (current, ready) => {
    const input = conversation();
    input.platformThreadId = "thread" as never;
    input.offer!.current = current;
    input.offer!.ready = ready;
    render(<ProviderOfferPanel conversation={input} />);
    expect(screen.queryByRole("button", { name: "Review acceptance" })).not.toBeInTheDocument();
  });
  it("distinguishes approved delivery from a confirmed sent acceptance", () => {
    const input = conversation();
    input.offer!.ready = true;
    input.acceptanceStatus = "approved";
    render(<ProviderOfferPanel conversation={input} />);
    expect(screen.getByRole("status")).toHaveTextContent("not yet confirmed sent");
    expect(screen.queryByText(/Acceptance sent ·/)).not.toBeInTheDocument();
  });
  it("preserves the authoritative sent outcome after the search is paused", () => {
    const input = conversation();
    input.offer!.current = false;
    input.acceptanceStatus = "executed";
    input.acceptedOfferId = input.offer!.offerId;
    input.acceptedAt = 100;
    render(<ProviderOfferPanel conversation={input} />);
    expect(screen.getByText(/Acceptance sent · search paused/)).toBeVisible();
    expect(screen.getByText(/Accepted offer/)).toBeVisible();
    expect(screen.queryByText(/assessment is out of date/)).not.toBeInTheDocument();
  });
  it.each([
    ["queued", "Reply · checking final text"],
    ["approved", "Reply · authorized, awaiting delivery"],
    ["executing", "Reply · delivery being checked"],
    ["executed", "Reply · sent"],
  ] as const)("shows the persisted %s delivery state", (status, label) => {
    const input = conversation(); input.replyStatus = status;
    render(<ProviderOfferPanel conversation={input} />);
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.queryByText("Suggested reply · not sent")).not.toBeInTheDocument();
  });
  it("distinguishes failure from an offer", () => {
    const input = conversation(); input.offer = null; input.errorCode = "SCOUT_ASSESSMENT_FAILED";
    render(<ProviderOfferPanel conversation={input} />);
    expect(screen.getByRole("status")).toHaveTextContent("could not be assessed yet");
    expect(screen.getByRole("status")).toHaveTextContent("No reply has been sent");
  });
});
