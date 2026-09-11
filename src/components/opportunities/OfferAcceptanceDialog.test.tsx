import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OfferAcceptanceDescriptor } from "./OfferAcceptanceDialog";
import { OfferAcceptanceDialog } from "./OfferAcceptanceDialog";

afterEach(cleanup);

function descriptor(overrides: Partial<OfferAcceptanceDescriptor> = {}): OfferAcceptanceDescriptor {
  return {
    requestId: "request" as never,
    offerId: "offer" as never,
    offerHash: "offer-hash",
    offerRevision: 3,
    contentVersion: 1,
    contentHash: "content-hash",
    reviewContextHash: "context-hash",
    status: "awaiting_approval",
    current: true,
    expiresAt: Date.now() + 60_000,
    destination: "roomscout.dev · Studio Nord",
    actingAs: "RoomScout musician",
    subject: "Acceptance for Studio Nord",
    body: "I accept the offered room for €240 per month.",
    assessment: {
      summary: "Tuesday evening room with storage.",
      monthlyPrice: { totalEur: 240, allRecurringCostsKnown: true },
      terms: [{ key: "storage", label: "Storage", value: "Included" }],
    },
    ...overrides,
  };
}

describe("offer acceptance dialog", () => {
  it("shows exact terms, message, sender and destination and gates approval on acknowledgement", async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const reviewed = descriptor();
    render(<OfferAcceptanceDialog descriptor={reviewed} onApprove={onApprove} onOpenChange={vi.fn()} open />);
    expect(screen.getByText("Storage")).toBeVisible();
    expect(screen.getByText("RoomScout musician")).toBeVisible();
    expect(screen.getByText("roomscout.dev · Studio Nord")).toBeVisible();
    expect(screen.getByText(reviewed.body)).toBeVisible();
    const approve = screen.getByRole("button", { name: "Freigeben und Annahme senden" });
    expect(approve).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /genauen Bedingungen/i }));
    expect(approve).toBeEnabled();
    fireEvent.click(approve);
    await waitFor(() => expect(onApprove).toHaveBeenCalledWith(reviewed));
  });

  it("clears acknowledgement when the reviewed snapshot changes", () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<OfferAcceptanceDialog descriptor={descriptor()} onApprove={onApprove} onOpenChange={vi.fn()} open />);
    const checkbox = screen.getByRole("checkbox", { name: /genauen Bedingungen/i });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    rerender(<OfferAcceptanceDialog descriptor={descriptor({ contentHash: "changed" })} onApprove={onApprove} onOpenChange={vi.fn()} open />);
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Freigeben und Annahme senden" })).toBeDisabled();
  });

  it.each([
    [{ current: false }, /nicht mehr aktuell/i],
    [{ expiresAt: 1 }, /Freigabe ist abgelaufen/i],
    [{ status: "failed" }, /fehlgeschlagen und wurde nicht als gesendet bestätigt/i],
  ])("blocks approval for stale, expired, or failed data", (overrides, message) => {
    render(<OfferAcceptanceDialog descriptor={descriptor(overrides)} onApprove={vi.fn()} onOpenChange={vi.fn()} open />);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Freigeben und Annahme senden" })).toBeDisabled();
  });

  it("shows loading and preparation errors without presenting approval controls", () => {
    const { rerender } = render(<OfferAcceptanceDialog loading onApprove={vi.fn()} onOpenChange={vi.fn()} open />);
    expect(screen.getByRole("status")).toHaveTextContent("genaue Annahme wird vorbereitet");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    rerender(<OfferAcceptanceDialog error="Angebot geändert. Es wurde nichts gesendet." onApprove={vi.fn()} onOpenChange={vi.fn()} open />);
    expect(screen.getByRole("alert")).toHaveTextContent("nichts gesendet");
  });

  it("surfaces send errors and requires a fresh acknowledgement", async () => {
    render(<OfferAcceptanceDialog descriptor={descriptor()} onApprove={vi.fn().mockRejectedValue(new Error("ACCEPTANCE_CONTENT_CHANGED"))} onOpenChange={vi.fn()} open />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Freigeben und Annahme senden" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("geändert"));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Freigeben und Annahme senden" })).toBeDisabled();
  });

  it.each(["approved", "queued", "executing"])("keeps %s delivery non-reviewable and does not claim it was sent", (status) => {
    render(<OfferAcceptanceDialog descriptor={descriptor({ status, current: false })} onApprove={vi.fn()} onOpenChange={vi.fn()} open />);
    expect(screen.getByRole("status")).toHaveTextContent("Zustellung wird noch geprüft");
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Freigeben und Annahme senden" })).toBeDisabled();
    expect(screen.queryByText("Annahme gesendet.")).not.toBeInTheDocument();
  });
});
