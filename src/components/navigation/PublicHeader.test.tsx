import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { PublicHeader } from "./PublicHeader";

afterEach(cleanup);

describe("public navigation", () => {
  it("keeps the Scout entry points without linking to Explore or Map", () => {
    const { container } = render(<MemoryRouter><PublicHeader /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/#how");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByRole("link", { name: "Start my search" })).toHaveAttribute("href", "/app/scout");
    expect(container.querySelector('a[href="/explore"]')).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/map"]')).not.toBeInTheDocument();
  });
});
