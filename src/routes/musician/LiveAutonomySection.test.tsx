import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveAutonomySection, mandateToRules } from "./LiveAutonomySection";

const createDraft = vi.fn();
const activate = vi.fn();
const revoke = vi.fn();
let mutationIndex = 0;
vi.mock("convex/react", () => ({ useMutation: () => [createDraft, activate, revoke][mutationIndex++ % 3] }));
vi.mock("../../ui/copy", () => ({ useCopy: () => ({ t: (key: string) => key }) }));

const mandate = {
  _id: "mandate", savedNeedId: "need", version: 3, mode: "negotiation_autopilot", status: "active",
  platformIds: ["platform"],
  allowedActionTypes: ["send_email", "create_portal_account", "publish_listing"],
  allowedPersonalData: ["band_name", "phone"], maxContactsPerDay: 7, maxBrowserMinutesPerDay: 44,
  maxMonthlyPriceEur: 900, expiresAt: Date.now() + 86400000, stopOnComplaint: false,
  stopWhenSuitableRoomConfirmed: true, commitmentBoundary: "non_binding_outreach_only", contentHash: "hash",
  activatedAt: 1, createdAt: 1, updatedAt: 1, usesDefaultUnlimitedUsage: false,
} as NonNullable<ComponentProps<typeof LiveAutonomySection>["mandate"]>;

function props(overrides: Partial<ComponentProps<typeof LiveAutonomySection>> = {}): ComponentProps<typeof LiveAutonomySection> {
  return { needId: "need" as never, mandate, platformIds: ["platform" as never], draft: null, onDraftChange: vi.fn(), back: vi.fn(), ...overrides };
}

afterEach(cleanup);
beforeEach(() => { mutationIndex = 0; createDraft.mockReset(); activate.mockReset(); revoke.mockReset(); });

describe("LiveAutonomySection", () => {
  it("maps the actual active mandate into every visible control", () => {
    const rules = mandateToRules(mandate);
    expect(rules).toEqual({ mode: "autopilot", contact: true, viewings: false, publishAd: true, shareProfile: true, sharePrivate: true, perDay: 7 });
    render(<LiveAutonomySection {...props()} />);
    expect(screen.getByRole("radio", { name: /settings.autonomy.mode.autopilot.title/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("spinbutton", { name: "settings.autonomy.limits.perDay" })).toHaveValue("7");
  });

  it("keeps edits local until Save and preserves unmapped mandate permissions", async () => {
    const draft = { ...mandateToRules(mandate), contact: false, viewings: true, perDay: 8 };
    createDraft.mockResolvedValue({ mandateId: "next", contentHash: "next-hash" });
    const values = props({ draft });
    render(<LiveAutonomySection {...values} />);
    expect(createDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "settings.autonomy.save" }));
    await waitFor(() => expect(activate).toHaveBeenCalledWith({ mandateId: "next", expectedContentHash: "next-hash" }));
    const input = createDraft.mock.calls[0]![0];
    expect(input).toEqual(expect.objectContaining({ platformIds: ["platform"], maxBrowserMinutesPerDay: 44, maxMonthlyPriceEur: 900, stopOnComplaint: false }));
    expect(new Set(input.allowedActionTypes)).toEqual(new Set(["create_portal_account", "publish_listing", "propose_visit_time"]));
    expect(input.allowedPersonalData).toEqual(["band_name", "phone"]);
    expect(values.onDraftChange).toHaveBeenLastCalledWith(null);
  });

  it("revokes an active mandate when review mode is explicitly saved", async () => {
    const values = props({ draft: { ...mandateToRules(mandate), mode: "review" } });
    render(<LiveAutonomySection {...values} />);
    fireEvent.click(screen.getByRole("button", { name: "settings.autonomy.save" }));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith({ mandateId: "mandate" }));
    expect(createDraft).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });

  it("does not invent platform scope for a first Autopilot mandate", () => {
    render(<LiveAutonomySection {...props({ mandate: null, platformIds: [], draft: { ...mandateToRules(null), mode: "autopilot" } })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("liveSettings.autonomyMissingScope");
    expect(screen.getByRole("button", { name: "settings.autonomy.save" })).toBeDisabled();
  });
});
