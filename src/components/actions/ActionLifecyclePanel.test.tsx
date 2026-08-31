import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

const handlers = {
  onReview: vi.fn(),
  onExecute: vi.fn(),
  onConfirmHumanCompleted: vi.fn(),
};

describe("ActionLifecyclePanel", () => {
  it("never exposes provider execution before exact approval", () => {
    render(<ActionLifecyclePanel actions={[action("awaiting_approval")]} executionResults={{}} {...handlers} />);

    expect(screen.getByRole("button", { name: /review exact action/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /execute approved action/i })).not.toBeInTheDocument();
  });

  it("allows an approved action to be executed through its reviewed provider", () => {
    const onExecute = vi.fn();
    const item = action("approved");
    render(<ActionLifecyclePanel actions={[item]} executionResults={{}} {...handlers} onExecute={onExecute} />);

    fireEvent.click(screen.getByRole("button", { name: /execute approved action/i }));
    expect(onExecute).toHaveBeenCalledWith(item);
  });

  it("keeps Live View ephemeral and requires explicit human completion", () => {
    const onConfirmHumanCompleted = vi.fn();
    const item = action("executing", "browserbase");
    render(
      <ActionLifecyclePanel
        actions={[item]}
        executionResults={{
          [item._id]: {
            state: "human_required",
            liveViewUrl: "https://live.example/session",
          },
        }}
        {...handlers}
        onConfirmHumanCompleted={onConfirmHumanCompleted}
      />,
    );

    expect(screen.getByRole("link", { name: /open ephemeral live view/i })).toHaveAttribute("href", "https://live.example/session");
    fireEvent.click(screen.getByRole("button", { name: /i submitted it/i }));
    expect(onConfirmHumanCompleted).toHaveBeenCalledWith(item._id, true);
  });
});
