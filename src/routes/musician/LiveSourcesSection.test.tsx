import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { LiveSourcesSection } from "./LiveSourcesSection";

vi.mock("../../ui/copy", () => ({ useCopy: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
const props = (): ComponentProps<typeof LiveSourcesSection> => ({
  city: "Stuttgart", address: "band@example.test", busy: false,
  portals: [{ _id: "portal", sourceId: "source", label: "Portal", sourceName: "Demo portal", baseUrl: "https://roomscout.dev", status: "active", policyDecision: "allowed", allowReadOnlyRecon: false, allowInboxPolling: true, pollIntervalMinutes: 1, createdAt: 1, updatedAt: 1 }] as ComponentProps<typeof LiveSourcesSection>["portals"],
  sources: [], preference: () => true, onPortalToggle: vi.fn(), onSourceToggle: vi.fn(),
  portalActions: () => <button>sync-inbox</button>, addressAction: null, moreSources: <p>additional-sources</p>,
});
describe("LiveSourcesSection", () => {
  it("uses live rows, reveals management separately, and forwards inclusion", () => {
    const values = props();
    render(<LiveSourcesSection {...values} />);
    expect(screen.getByText("roomscout.dev")).toBeVisible();
    expect(screen.getByText("band@example.test", { selector: ".select-all" })).toBeVisible();
    expect(screen.queryByText("sync-inbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "settings.sources.row.switchAria" }));
    expect(values.onPortalToggle).toHaveBeenCalledWith(values.portals[0], false);
    fireEvent.click(screen.getByRole("button", { name: "settings.sources.detail.manageConnection" }));
    expect(screen.getByText("sync-inbox")).toBeVisible();
  });
  it("copies the actual mailbox address", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<LiveSourcesSection {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "settings.sources.address.copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("band@example.test"));
    expect(await screen.findByRole("button", { name: "settings.sources.address.copied" })).toBeVisible();
  });
});
