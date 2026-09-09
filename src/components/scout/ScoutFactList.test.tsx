import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ScoutFactList } from "./ScoutFactList";

it("corrects an existing fact in place instead of creating a second budget", () => {
  const { rerender } = render(
    <ScoutFactList
      facts={[{ key: "budget", label: "Budget", value: "400 €" }]}
    />,
  );
  const row = screen.getByText("400 €").parentElement;
  rerender(
    <ScoutFactList
      expanded
      facts={[{ key: "budget", label: "Budget", value: "350 €" }]}
    />,
  );
  expect(screen.getByText("350 €").parentElement).toBe(row);
  expect(screen.queryByText("400 €")).not.toBeInTheDocument();
  expect(screen.getAllByText("Budget")).toHaveLength(1);
});

it("does not invent facts before the backend extracts any", () => {
  render(<ScoutFactList facts={[]} />);
  expect(screen.getByText(/während wir sprechen/)).toBeInTheDocument();
  expect(screen.queryByText(/Stuttgart/)).not.toBeInTheDocument();
});
