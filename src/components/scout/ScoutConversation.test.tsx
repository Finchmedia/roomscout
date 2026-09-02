import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoutConversation } from "./ScoutConversation";

describe("ScoutConversation", () => {
  it("renders the Scout's double-asterisk emphasis without exposing markup", () => {
    render(
      <ScoutConversation
        messages={[
          {
            id: "scout-1",
            author: "scout",
            body: "I included **shared rehearsal rooms** in your search. <script>alert(1)</script>",
          },
        ]}
        onSend={() => undefined}
      />,
    );

    expect(screen.getByText("shared rehearsal rooms").tagName).toBe("STRONG");
    expect(
      screen.getByText(/<script>alert\(1\)<\/script>/),
    ).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  it("keeps user-authored asterisks literal", () => {
    render(
      <ScoutConversation
        messages={[
          { id: "user-1", author: "user", body: "Keep **this** literal" },
        ]}
        onSend={() => undefined}
      />,
    );

    const message = screen.getByText("Keep **this** literal");
    expect(message.querySelector("strong")).toBeNull();
  });
});
