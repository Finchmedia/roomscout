import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CandidateList, type CandidateListCopy, type CandidateRow } from "./CandidateList";

const copy: CandidateListCopy = {
  title: "Candidates",
  empty: "No candidates yet",
  question: "Question for you",
  offer: "Offer ready",
  reply: "Reply received",
  asked: "Contacted",
  checking: "Checking fit",
  preparing: "Preparing inquiry",
  failed: "Review failed",
  reviewing: "Reviewing reply",
  attention: "Needs attention",
  viewing: "Viewing arranged",
  closed: "Closed",
  fit: "Indexed fit",
  nearBudget: "Above current budget",
  groupActive: "Still in play",
  groupAboveBudget: "Above budget",
  groupNotFit: "No longer a fit",
  unavailable: "Unavailable",
  notFit: "No longer a fit",
  scheduleConflict: "Schedule does not fit",
  requirementsConflict: "Requirements do not fit",
  showAboveBudget: "Show above-budget rooms",
};

const base: CandidateRow = {
  conversationId: "conversation-1",
  title: "Westend room",
  subtitle: "Stuttgart",
  state: "waiting",
  lastActivityAt: 10,
  unread: false,
  hasOpenDecision: false,
};

afterEach(cleanup);

describe("CandidateList", () => {
  it("groups candidates by disposition and keeps excluded rows truthful and clickable", () => {
    const onOpen = vi.fn();
    render(
      <CandidateList
        copy={copy}
        formatStamp={() => "now"}
        onOpen={onOpen}
        candidates={[
          { ...base, conversationId: "waldpuls", title: "Waldpuls", progress: "reply_received", hasProviderReply: true, disposition: "not_fit", exclusionReason: "unavailable" },
          { ...base, conversationId: "active", title: "Westend room" },
          { ...base, conversationId: "stretch", title: "Stretch room", disposition: "above_budget" },
          { ...base, conversationId: "closed", title: "Closed room", state: "closed", progress: "reply_received" },
        ]}
      />,
    );

    expect(screen.getByText("Still in play").parentElement).toHaveTextContent("1");
    expect(screen.getByText("Above budget").parentElement).toHaveTextContent("1");
    expect(screen.getAllByText("No longer a fit")[0]?.parentElement).toHaveTextContent("2");
    expect(screen.getAllByRole("button").map(button => button.textContent)).toEqual([
      expect.stringContaining("Westend room"),
      expect.stringContaining("Stretch room"),
      expect.stringContaining("Waldpuls"),
      expect.stringContaining("Closed room"),
    ]);
    expect(screen.getByRole("button", { name: /Waldpuls/ })).toHaveTextContent("Unavailable");
    expect(screen.getByRole("button", { name: /Waldpuls/ })).not.toHaveTextContent("Reply received");
    expect(screen.getByRole("button", { name: /Closed room/ })).toHaveTextContent("Closed");

    fireEvent.click(screen.getByRole("button", { name: /Waldpuls/ }));
    expect(onOpen).toHaveBeenCalledWith("waldpuls", expect.objectContaining({ exclusionReason: "unavailable" }));
  });

  it("opens indexed and provider candidates through one stable row contract", () => {
    const onOpen = vi.fn();
    render(
      <CandidateList
        copy={copy}
        formatStamp={() => "now"}
        onOpen={onOpen}
        candidates={[
          {
            candidateKey: "need-1:signal-1",
            savedNeedId: "need-1",
            signalId: "signal-1",
            source: "indexed",
            matchKind: "near_budget",
            title: "Near-budget room",
            subtitle: "Stuttgart-West",
            lastActivityAt: 11,
            unread: false,
            hasOpenDecision: false,
          },
          base,
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: /Near-budget room/ })).toHaveTextContent("Above current budget");
    fireEvent.click(screen.getByRole("button", { name: /Near-budget room/ }));
    fireEvent.click(screen.getByRole("button", { name: /Westend room/ }));
    expect(onOpen).toHaveBeenNthCalledWith(1, "need-1:signal-1", expect.objectContaining({ source: "indexed" }));
    expect(onOpen).toHaveBeenNthCalledWith(2, "conversation-1", expect.objectContaining({ conversationId: "conversation-1" }));
  });

  it("shows an optional room photo without reserving an empty thumbnail", () => {
    const { rerender } = render(
      <CandidateList
        copy={copy}
        formatStamp={() => "now"}
        onOpen={vi.fn()}
        candidates={[{ ...base, imageUrl: "https://roomscout.dev/rooms/westend.webp" }]}
      />,
    );
    expect(screen.getByRole("img", { name: "Westend room" })).toHaveAttribute("loading", "lazy");

    rerender(<CandidateList copy={copy} formatStamp={() => "now"} onOpen={vi.fn()} candidates={[base]} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("uses explicit progress and never presents generic attention as a provider reply", () => {
    const { rerender } = render(
      <CandidateList
        copy={copy}
        formatStamp={() => "now"}
        onOpen={vi.fn()}
        candidates={[{ ...base, state: "needs_attention", hasProviderReply: false }]}
      />,
    );
    expect(screen.getByRole("button", { name: /Westend room/ })).toHaveTextContent("Needs attention");
    expect(screen.getByRole("button", { name: /Westend room/ })).not.toHaveTextContent("Reply received");

    rerender(
      <CandidateList
        copy={copy}
        formatStamp={() => "now"}
        onOpen={vi.fn()}
        candidates={[{ ...base, progress: "reply_received", hasProviderReply: true }]}
      />,
    );
    expect(screen.getByRole("button", { name: /Westend room/ })).toHaveTextContent("Reply received");
  });

  it("keeps user decisions and ready offers ahead of background progress", () => {
    const { rerender } = render(
      <CandidateList
        copy={copy}
        formatStamp={() => "now"}
        onOpen={vi.fn()}
        candidates={[{ ...base, hasOpenDecision: true, statusLabel: "Reviewing reply" }]}
      />,
    );
    expect(screen.getByRole("button", { name: /Westend room/ })).toHaveTextContent("Question for you");

    rerender(
      <CandidateList
        copy={copy}
        formatStamp={() => "now"}
        onOpen={vi.fn()}
        candidates={[{ ...base, state: "offer_ready", statusLabel: "Reviewing reply" }]}
      />,
    );
    expect(screen.getByRole("button", { name: /Westend room/ })).toHaveTextContent("Offer ready");
  });

  it("says when the viewing is, ahead of every other in-play state", () => {
    const formatViewing = vi.fn(({ date, time }: { date: string; time: string }) => `Viewing · Fri 25 Sep, ${time} (${date})`);
    const { rerender } = render(
      <CandidateList
        copy={copy}
        formatStamp={() => "now"}
        formatViewing={formatViewing}
        onOpen={vi.fn()}
        candidates={[{
          ...base, progress: "viewing_arranged", viewing: { date: "2026-09-25", time: "17:00" },
          hasProviderReply: true, hasOpenDecision: true, state: "offer_ready",
        }]}
      />,
    );
    const row = screen.getByRole("button", { name: /Westend room/ });
    expect(row).toHaveTextContent("Viewing · Fri 25 Sep, 17:00");
    expect(row).not.toHaveTextContent("Question for you");
    expect(row).not.toHaveTextContent("Offer ready");
    expect(formatViewing).toHaveBeenCalledWith({ date: "2026-09-25", time: "17:00" });

    // Über Budget is still in play: the slot wins on the row exactly as it does
    // on the room card, and the group header keeps saying it is above budget.
    rerender(
      <CandidateList
        copy={copy}
        formatStamp={() => "now"}
        formatViewing={formatViewing}
        onOpen={vi.fn()}
        candidates={[{
          ...base, progress: "viewing_arranged", viewing: { date: "2026-09-25", time: "17:00" },
          disposition: "above_budget",
        }]}
      />,
    );
    expect(screen.getByRole("button", { name: /Westend room/ })).toHaveTextContent("Viewing · Fri 25 Sep, 17:00");
    expect(screen.getByRole("button", { name: /Westend room/ })).not.toHaveTextContent("Above current budget");
    expect(screen.getByText("Above budget").parentElement).toHaveTextContent("1");

    // No slot on the row (or no formatter bound): the plain state, never a
    // fabricated date.
    rerender(
      <CandidateList
        copy={copy}
        formatStamp={() => "now"}
        onOpen={vi.fn()}
        candidates={[{ ...base, progress: "viewing_arranged" }]}
      />,
    );
    expect(screen.getByRole("button", { name: /Westend room/ })).toHaveTextContent("Viewing arranged");

    // A room that is out of the running keeps saying so.
    rerender(
      <CandidateList
        copy={copy}
        formatStamp={() => "now"}
        formatViewing={formatViewing}
        onOpen={vi.fn()}
        candidates={[{
          ...base, progress: "viewing_arranged", viewing: { date: "2026-09-25", time: "17:00" },
          exclusionReason: "unavailable",
        }]}
      />,
    );
    expect(screen.getByRole("button", { name: /Westend room/ })).toHaveTextContent("Unavailable");

    // The row survives the room being closed afterwards; the rail then says so
    // rather than presenting a closed room as an appointment.
    rerender(
      <CandidateList
        copy={copy}
        formatStamp={() => "now"}
        formatViewing={formatViewing}
        onOpen={vi.fn()}
        candidates={[{
          ...base, progress: "closed", state: "closed", viewing: { date: "2026-09-25", time: "17:00" },
        }]}
      />,
    );
    expect(screen.getByRole("button", { name: /Westend room/ })).toHaveTextContent("Closed");
    expect(screen.getByRole("button", { name: /Westend room/ })).not.toHaveTextContent("17:00");
  });

  it("keeps the real-contact boundary visible in the candidate rail", () => {
    render(
      <CandidateList
        copy={copy}
        formatStamp={() => "now"}
        onOpen={vi.fn()}
        candidates={[
          { ...base, conversationId: "real", title: "Real indexed room", disclosure: "Contact disabled in demo" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /Real indexed room/ })).toHaveTextContent("Contact disabled in demo");
  });

  it("hides only uncontacted above-budget matches when the user switches them off", () => {
    const onShowAboveBudgetChange = vi.fn();
    render(
      <CandidateList
        copy={copy}
        formatStamp={() => "now"}
        onOpen={vi.fn()}
        showAboveBudget={false}
        onShowAboveBudgetChange={onShowAboveBudgetChange}
        candidates={[
          {
            candidateKey: "need-1:near-uncontacted",
            source: "indexed",
            matchKind: "near_budget",
            title: "Uncontacted stretch room",
            subtitle: "West",
            lastActivityAt: 12,
            unread: false,
            hasOpenDecision: false,
          },
          {
            ...base,
            conversationId: "contacted-near",
            candidateKey: "need-1:contacted-near",
            matchKind: "near_budget",
            title: "Contacted stretch room",
          },
          {
            candidateKey: "need-1:decision-near",
            source: "indexed",
            matchKind: "near_budget",
            title: "Stretch room with decision",
            subtitle: "East",
            lastActivityAt: 13,
            unread: false,
            hasOpenDecision: true,
          },
          {
            candidateKey: "need-1:fit",
            source: "indexed",
            matchKind: "fit",
            title: "Within-budget room",
            subtitle: "North",
            lastActivityAt: 14,
            unread: false,
            hasOpenDecision: false,
          },
        ]}
      />,
    );

    expect(screen.queryByRole("button", { name: /Uncontacted stretch room/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Contacted stretch room/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Stretch room with decision/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Within-budget room/ })).toBeVisible();

    fireEvent.click(screen.getByRole("switch", { name: "Show above-budget rooms" }));
    expect(onShowAboveBudgetChange).toHaveBeenCalledWith(true);
  });
});
