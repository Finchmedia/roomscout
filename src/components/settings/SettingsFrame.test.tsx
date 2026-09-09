import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsFrame } from "./SettingsFrame";

describe("SettingsFrame", () => {
  it("exposes every settings section and reports navigation", () => {
    const onSectionChange = vi.fn();
    render(
      <SettingsFrame onSectionChange={onSectionChange} section="sources">
        <p>Live settings</p>
      </SettingsFrame>,
    );

    expect(
      screen.getByRole("button", { name: "Sources & access" }),
    ).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Privacy" }));
    expect(onSectionChange).toHaveBeenCalledWith("privacy");
    expect(screen.getByText("Live settings")).toBeInTheDocument();
  });
});
