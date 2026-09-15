import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArrivingFactList, type ArrivingFact } from "./ArrivingFactList";

function view(facts: ArrivingFact[]) {
  return render(<ArrivingFactList facts={facts} title="Euer Suchauftrag" />);
}

const row = (id: string) => document.querySelector(`[data-fact-row="${id}"]`);

/** Full motion: a `matchMedia` that answers „no reduction“, plus a WAAPI stub. */
function allowMotion() {
  const animate = vi.fn(() => ({}) as Animation);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(),
  }));
  Object.defineProperty(Element.prototype, "animate", { value: animate, configurable: true, writable: true });
  return animate;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("arriving fact list", () => {
  it("renders what is already known without animating it", () => {
    view([{ id: "ort", label: "Stuttgart" }]);
    expect(screen.getByText("Stuttgart")).toBeInTheDocument();
    expect(row("ort")).not.toHaveAttribute("data-arriving");
    expect(row("ort")).not.toHaveAttribute("data-changed");
  });

  it("shows a saved fact immediately while its decorative capsule flies", () => {
    vi.useFakeTimers();
    const animate = allowMotion();
    const { rerender } = view([{ id: "ort", label: "Stuttgart" }]);

    rerender(
      <ArrivingFactList
        facts={[{ id: "ort", label: "Stuttgart" }, { id: "budget", label: "Bis 350 € / Monat" }]}
        title="Euer Suchauftrag"
      />,
    );
    expect(row("budget")).not.toHaveAttribute("data-arriving");
    expect(row("budget")).toHaveAttribute("data-changed", "true");

    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.getByText("Bis 350 € / Monat", { selector: "[data-slot='capsule']" })).toBeInTheDocument();
    expect(animate).toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(400); });
    expect(row("budget")).not.toHaveAttribute("data-arriving");
    expect(row("budget")).toHaveAttribute("data-changed", "true");

    act(() => { vi.advanceTimersByTime(1600); });
    expect(row("budget")).not.toHaveAttribute("data-changed");
    expect(document.querySelector("[data-capsule]")).toBeNull();
  });

  it("highlights a corrected value without flying anything", () => {
    vi.useFakeTimers();
    const animate = allowMotion();
    const { rerender } = view([{ id: "budget", label: "Bis 400 € / Monat" }]);

    rerender(<ArrivingFactList facts={[{ id: "budget", label: "Bis 350 € / Monat" }]} title="Euer Suchauftrag" />);
    expect(row("budget")).toHaveAttribute("data-changed", "true");
    expect(row("budget")).not.toHaveAttribute("data-arriving");
    act(() => { vi.advanceTimersByTime(1); });
    expect(animate).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1000); });
    expect(row("budget")).not.toHaveAttribute("data-changed");
  });

  it("only highlights under reduced motion — no flight, no collapsed row", () => {
    vi.useFakeTimers();
    // jsdom ships no `matchMedia`, which this component reads as „reduce“.
    const { rerender } = view([{ id: "ort", label: "Stuttgart" }]);
    rerender(
      <ArrivingFactList
        facts={[{ id: "ort", label: "Stuttgart" }, { id: "budget", label: "Bis 350 € / Monat" }]}
        title="Euer Suchauftrag"
      />,
    );
    expect(row("budget")).not.toHaveAttribute("data-arriving");
    expect(row("budget")).toHaveAttribute("data-changed", "true");
    expect(document.querySelector("[data-capsule]")).toBeNull();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(row("budget")).not.toHaveAttribute("data-changed");
  });
  it("cancels stale capsules when a saved correction arrives", () => {
    vi.useFakeTimers();
    allowMotion();
    const { rerender } = view([]);
    rerender(<ArrivingFactList facts={[{ id: "ort", label: "Berlin" }, { id: "zeit", label: "Tuesday" }]} title="Brief" />);
    act(() => { vi.advanceTimersByTime(1); });
    rerender(<ArrivingFactList facts={[{ id: "ort", label: "Berlin" }, { id: "zeit", label: "Wednesday" }]} title="Brief" />);
    act(() => { vi.advanceTimersByTime(1500); });
    expect(screen.queryByText("Tuesday")).not.toBeInTheDocument();
    expect(row("zeit")).toHaveTextContent("Wednesday");
    expect(document.querySelector("[data-slot='capsule']")).toBeNull();
  });

  it("does not animate translated or reloaded facts", () => {
    vi.useFakeTimers();
    const animate = allowMotion();
    const { rerender } = render(<ArrivingFactList animationKey="one:en" facts={[{ id: "zeit", label: "Wednesday" }]} title="Brief" />);
    rerender(<ArrivingFactList animationKey="one:de" facts={[{ id: "zeit", label: "Mittwoch" }]} title="Brief" />);
    act(() => { vi.runAllTimers(); });
    expect(row("zeit")).not.toHaveAttribute("data-changed");
    expect(animate).not.toHaveBeenCalled();
  });

});
