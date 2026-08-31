import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortalConnectionsWorkspace, type PortalUiConnection } from "./PortalConnectionsWorkspace";

const portals: PortalUiConnection[] = [
  {
    id: "login",
    name: "Portal Login",
    domain: "login.example.test",
    status: "login_needed",
    policyReady: true,
    canAuthenticate: true,
    canSync: false,
    scopes: ["Inbox sync"],
  },
  {
    id: "active",
    name: "Portal Active",
    domain: "active.example.test",
    status: "connected",
    policyReady: true,
    canAuthenticate: false,
    canSync: true,
    scopes: ["Read-only research"],
  },
  {
    id: "reauth",
    name: "Portal Reauth",
    status: "reauth_required",
    policyReady: true,
    canAuthenticate: true,
    canSync: false,
    scopes: [],
  },
  {
    id: "paused",
    name: "Portal Paused",
    status: "paused",
    policyReady: true,
    canAuthenticate: true,
    canSync: false,
    scopes: [],
  },
  {
    id: "disabled",
    name: "Portal Disabled",
    status: "disabled",
    policyReady: false,
    canAuthenticate: false,
    canSync: false,
    scopes: [],
  },
];

describe("PortalConnectionsWorkspace", () => {
  it("renders independent portal states and wires their scoped actions", () => {
    const onAuthenticate = vi.fn();
    const onPause = vi.fn();
    const onSync = vi.fn();
    const onDisable = vi.fn();

    render(
      <PortalConnectionsWorkspace
        mailbox={{ status: "active", emailAddress: "scout@agentmail.to" }}
        onAuthenticate={onAuthenticate}
        onDisable={onDisable}
        onPause={onPause}
        onSync={onSync}
        portals={portals}
      />,
    );

    expect(screen.getByText("Login / registration needed")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Reauthentication required")).toBeInTheDocument();
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByText(/one isolated browserbase context per portal identity/i)).toBeInTheDocument();
    expect(screen.getByText("scout@agentmail.to")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open secure setup/i }));
    fireEvent.click(screen.getByRole("button", { name: /sync inbox/i }));
    fireEvent.click(screen.getByRole("button", { name: /^pause$/i }));
    fireEvent.click(screen.getByRole("button", { name: /reauthenticate/i }));

    expect(onAuthenticate).toHaveBeenCalledWith("login");
    expect(onAuthenticate).toHaveBeenCalledWith("reauth");
    expect(onSync).toHaveBeenCalledWith("active");
    expect(onPause).toHaveBeenCalledWith("active");

    const disableButtons = screen.getAllByRole("button", { name: /disable & delete context/i });
    expect(disableButtons).toHaveLength(4);
    fireEvent.click(disableButtons[0]!);
    expect(onDisable).toHaveBeenCalledWith("login");
  });

  it("creates the AgentMail registration identity only from an explicit action", () => {
    const onEnsureMailbox = vi.fn();
    render(
      <PortalConnectionsWorkspace
        mailbox={null}
        onEnsureMailbox={onEnsureMailbox}
        portals={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /create address/i }));
    expect(onEnsureMailbox).toHaveBeenCalledOnce();
  });
});
