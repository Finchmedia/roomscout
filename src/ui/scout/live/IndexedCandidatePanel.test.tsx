import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IndexedCandidatePanel, type IndexedCandidatePanelCopy } from "./IndexedCandidatePanel";

const copy: IndexedCandidatePanelCopy = {
  room: "Room details",
  fit: "Fit",
  nearBudget: "Above current budget",
  reasons: "Why it may fit",
  uncertainties: "Still to check",
  adjustBudget: "Adjust search budget",
  contact: "Ask this provider",
  openConversation: "Open conversation",
  retry: "Retry review",
  actionQueued: "Checking this room …",
  actionUnavailable: "This room cannot be contacted yet.",
};

afterEach(cleanup);

describe("IndexedCandidatePanel", () => {
  it("uses the candidate room photo and leaves no broken fallback image", () => {
    const { rerender } = render(
      <IndexedCandidatePanel
        candidate={{ kind: "fit", title: "Westend room", imageUrl: "https://roomscout.dev/rooms/westend.webp", reasons: [], uncertainties: [] }}
        copy={copy}
      />,
    );
    expect(screen.getByRole("img", { name: "Westend room" })).toHaveAttribute("loading", "lazy");

    rerender(<IndexedCandidatePanel candidate={{ kind: "fit", title: "Westend room", reasons: [], uncertainties: [] }} copy={copy} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("routes a near-budget room to the global budget editor without offering a room exception", () => {
    const onAdjustBudget = vi.fn();
    const onContact = vi.fn();
    render(
      <IndexedCandidatePanel
        candidate={{
          kind: "near_budget",
          title: "Westend room",
          subtitle: "Stuttgart-West",
          summary: "A shared rehearsal room.",
          priceLabel: "€320 / month",
          budgetGapLabel: "€45 above your current maximum",
          reasons: ["Close to your preferred area"],
          uncertainties: ["Storage permission is not stated"],
        }}
        copy={copy}
        onAdjustBudget={onAdjustBudget}
        onContact={onContact}
      />,
    );

    expect(screen.getByText("€45 above your current maximum")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Ask this provider" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Adjust search budget" }));
    expect(onAdjustBudget).toHaveBeenCalledOnce();
    expect(onContact).not.toHaveBeenCalled();
  });

  it("exposes contact and retry only as explicit panel actions", () => {
    const onContact = vi.fn();
    const onRetry = vi.fn();
    render(
      <IndexedCandidatePanel
        candidate={{ kind: "fit", title: "Fit room", reasons: [], uncertainties: [] }}
        copy={copy}
        canRetry
        onContact={onContact}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask this provider" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry review" }));
    expect(onContact).toHaveBeenCalledOnce();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("opens an existing conversation explicitly instead of offering another contact action", () => {
    const onOpenConversation = vi.fn();
    const onContact = vi.fn();
    render(
      <IndexedCandidatePanel
        candidate={{ kind: "room", title: "Contacted room", reasons: [], uncertainties: [] }}
        copy={copy}
        onContact={onContact}
        onOpenConversation={onOpenConversation}
      />,
    );

    expect(screen.getByText("Room details")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Ask this provider" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open conversation" }));
    expect(onOpenConversation).toHaveBeenCalledOnce();
    expect(onContact).not.toHaveBeenCalled();
  });

  it("labels controlled AI simulation without exposing a contact action for a real indexed room", () => {
    const { rerender } = render(
      <IndexedCandidatePanel
        candidate={{ kind: "fit", title: "Real indexed room", reasons: [], uncertainties: [], disclosure: "Contact disabled in demo" }}
        copy={copy}
        onContact={vi.fn()}
      />,
    );
    expect(screen.getByText("Contact disabled in demo")).toBeVisible();

    rerender(
      <IndexedCandidatePanel
        candidate={{ kind: "fit", title: "Indexed room", reasons: [], uncertainties: [], disclosure: "Contact disabled in demo" }}
        copy={copy}
      />,
    );
    expect(screen.getByText("Contact disabled in demo")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Ask this provider" })).not.toBeInTheDocument();
  });
});
