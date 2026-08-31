import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ActionApprovalRequest } from "../../features/agentOperations/types";
import { ActionApprovalSheet } from "./ActionApprovalSheet";

function request(authorization: ActionApprovalRequest["authorization"]): ActionApprovalRequest {
  return {
    id: "action-1",
    kind: "send_email",
    destination: "studio@example.test",
    actingAs: "scout@agentmail.to",
    effect: "Send the displayed inquiry once.",
    fields: [{ label: "Subject", value: "Rehearsal room inquiry" }],
    contentVersion: 2,
    authorization,
  };
}

describe("ActionApprovalSheet authorization state", () => {
  it("shows exact one-time approval when no standing mandate authorizes execution", () => {
    render(<ActionApprovalSheet onOpenChange={vi.fn()} open request={request({ mode: "approve_once" })} />);

    expect(screen.getByRole("heading", { name: "Action requires your approval" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /approve this exact destination/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve once" })).toBeDisabled();
    expect(screen.queryByText("Authorized by standing mandate")).not.toBeInTheDocument();
  });

  it("labels execution authorized by an active standing mandate without asking for duplicate approval", () => {
    render(<ActionApprovalSheet
      onOpenChange={vi.fn()}
      open
      request={request({ mode: "standing_mandate", mandateVersion: 4, mandateLabel: "Stuttgart outreach", executionAllowed: true })}
    />);

    expect(screen.getByRole("heading", { name: "Action authorized by mandate" })).toBeInTheDocument();
    expect(screen.getByText("Authorized by standing mandate")).toBeInTheDocument();
    expect(screen.getByText(/Stuttgart outreach · version 4/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve once" })).not.toBeInTheDocument();
  });
});
