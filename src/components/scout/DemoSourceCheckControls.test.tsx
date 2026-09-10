import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DemoSourceCheckControls } from "./DemoSourceCheckControls";

const fixtures = vi.hoisted(() => ({
  status: {
    status: "idle",
    mode: null,
    checksCompleted: 0,
    maxChecks: 10,
    detailPagesUsed: 0,
    maxDetailPages: 50,
  } as Record<string, unknown> | undefined,
  mutations: new Map<string, ReturnType<typeof vi.fn>>(),
}));

function mutation(name: string) {
  const handler = fixtures.mutations.get(name) ?? vi.fn().mockResolvedValue({ accepted: true, status: "queued" });
  fixtures.mutations.set(name, handler);
  return handler;
}

vi.mock("convex/react", () => ({
  useQuery: () => fixtures.status,
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => mutation(getFunctionName(ref)),
}));

afterEach(cleanup);

beforeEach(() => {
  fixtures.status = {
    status: "idle",
    mode: null,
    checksCompleted: 0,
    maxChecks: 10,
    detailPagesUsed: 0,
    maxDetailPages: 50,
  };
  fixtures.mutations.clear();
});

it("offers musicians only the bounded roomscout.dev check", async () => {
  render(<DemoSourceCheckControls variant="musician" />);

  expect(screen.getByText("Live-Check · nur roomscout.dev")).toBeInTheDocument();
  expect(screen.getByText("Checks 0/10")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "10-Minuten-Demo starten" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Jetzt Quellen prüfen" }));
  await waitFor(() => expect(mutation("demoSourceChecks:requestNow")).toHaveBeenCalledTimes(1));
  expect(mutation("demoSourceChecks:requestNow").mock.calls[0]?.[0].requestId).toMatch(/^manual:/);
});

it("keeps the same request id when confirmation is ambiguous", async () => {
  const request = mutation("demoSourceChecks:requestNow");
  request.mockRejectedValueOnce(new Error("network unavailable"));
  render(<DemoSourceCheckControls variant="musician" />);

  fireEvent.click(screen.getByRole("button", { name: "Jetzt Quellen prüfen" }));
  await screen.findByRole("alert");
  const firstId = request.mock.calls[0]?.[0].requestId;
  request.mockResolvedValueOnce({ accepted: true, status: "queued" });
  fireEvent.click(screen.getByRole("button", { name: "Jetzt Quellen prüfen" }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  expect(request.mock.calls[1]?.[0].requestId).toBe(firstId);
});

it("lets operators start the ten-minute mode", async () => {
  render(<DemoSourceCheckControls variant="operator" />);
  fireEvent.click(screen.getByRole("button", { name: "10-Minuten-Demo starten" }));
  await waitFor(() => expect(mutation("demoSourceChecks:startDemo")).toHaveBeenCalledTimes(1));
});

it("shows compact live progress and allows an operator to stop a demo", async () => {
  fixtures.status = {
    status: "waiting",
    mode: "demo",
    checksCompleted: 3,
    maxChecks: 10,
    detailPagesUsed: 11,
    maxDetailPages: 50,
  };
  render(<DemoSourceCheckControls variant="operator" />);

  expect(screen.getByText("Checks 3/10")).toBeInTheDocument();
  expect(screen.getByText("Detailseiten 11/50")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Jetzt Quellen prüfen" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Demo stoppen" }));
  await waitFor(() => expect(mutation("demoSourceChecks:stopDemo")).toHaveBeenCalledWith({}));
});
