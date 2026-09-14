import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { ActionLifecyclePanel, type ActionLifecycleItem } from "./ActionLifecyclePanel";

function action(status: ActionLifecycleItem["status"], executor: ActionLifecycleItem["executor"] = "firecrawl"): ActionLifecycleItem {
  return {
    _id: "action-1" as Id<"actionRequests">,
    requestedActionType: "submit_webform",
    payload: {
      kind: "contact_form",
      targetUrl: "https://rooms.example/contact",
      fields: [{ name: "message", value: "Hello", sensitivity: "normal" }],
    },
    status,
    executor,
    updatedAt: 1_700_000_000_000,
  };
}

describe("ActionLifecyclePanel", () => {
  it("shows the ledger as read-only history without approval or execution controls", () => {
    render(<ActionLifecyclePanel actions={[action("awaiting_approval"), { ...action("approved"), _id: "action-2" as Id<"actionRequests"> }]} />);

    expect(screen.getByText("Approval needed")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getAllByText("https://rooms.example/contact")).toHaveLength(2);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("surfaces provider state and errors from the persisted execution", () => {
    const item = { ...action("executing", "browserbase"), execution: { id: "exec-1" as Id<"actionExecutions">, status: "unknown" as const, error: "Outcome not confirmed", updatedAt: 1 } };
    render(<ActionLifecyclePanel actions={[item]} />);

    expect(screen.getByText("Outcome unknown")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Outcome not confirmed");
  });

  it("renders loading and empty states", () => {
    const { rerender } = render(<ActionLifecyclePanel actions={undefined} />);
    expect(screen.getByText(/loading action ledger/i)).toBeInTheDocument();
    rerender(<ActionLifecyclePanel actions={[]} />);
    expect(screen.getByText(/no persisted external actions yet/i)).toBeInTheDocument();
  });
});
