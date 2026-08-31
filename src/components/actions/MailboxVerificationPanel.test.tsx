import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { MailboxVerificationPanel } from "./MailboxVerificationPanel";

describe("MailboxVerificationPanel", () => {
  it("shows verification links as user-opened links and marks the message read", async () => {
    const onStatusChange = vi.fn().mockResolvedValue(undefined);
    render(
      <MailboxVerificationPanel
        messages={[{
          _id: "mailbox-message-1" as Id<"mailboxMessages">,
          from: "portal@example.test",
          subject: "Confirm your account",
          body: "Open https://portal.example.test/verify/token to continue.",
          kind: "portal_verification",
          status: "unread",
          receivedAt: 1_700_000_000_000,
        }]}
        onStatusChange={onStatusChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /confirm your account/i }));
    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith("mailbox-message-1", "read"));
    expect(screen.getByRole("link", { name: /portal\.example\.test\/verify/i })).toHaveAttribute("target", "_blank");
    expect(screen.getByText(/never follows them automatically/i)).toBeInTheDocument();
  });
});
