import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortalAuthenticationGuide } from "./PortalAuthenticationGuide";

describe("PortalAuthenticationGuide", () => {
  it("keeps credentials in Live View and requires explicit signed-in confirmation", () => {
    const onConfirmed = vi.fn();
    const { rerender } = render(
      <PortalAuthenticationGuide
        liveViewOpen={false}
        mailboxAddress="roomscout-user@agentmail.to"
        onSignedInConfirmedChange={onConfirmed}
        portalName="Example Portal"
        signedInConfirmed={false}
      />,
    );

    expect(screen.getByText(/type passwords, otps and 2fa only there/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeDisabled();

    rerender(
      <PortalAuthenticationGuide
        liveViewOpen
        mailboxAddress="roomscout-user@agentmail.to"
        onSignedInConfirmedChange={onConfirmed}
        portalName="Example Portal"
        signedInConfirmed={false}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onConfirmed).toHaveBeenCalledWith(true);
    expect(screen.getByText(/does not authorize roomscout to send messages/i)).toBeInTheDocument();
  });
});
