import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsPageHeader } from "./OpsPageHeader";

describe("OpsPageHeader", () => {
  it("labels the protected operator surface without inventing state", () => {
    render(
      <OpsPageHeader
        meta={<span>Live Convex data</span>}
        title="Operations overview"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Operations overview" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Internal operator workspace")).toBeInTheDocument();
    expect(screen.getByText("Live Convex data")).toBeInTheDocument();
  });
});
