import { describe, expect, it } from "vitest";
import {
  buildTriagePrompt,
  TRIAGE_INSTRUCTIONS,
  triageBatches,
} from "./sourceTriagePrompt";

const domain = {
  domain: "mukken.com",
  name: "Proberäume finden",
  snippet: "Proberaum-Angebote in vielen Städten",
  exampleUrl: "https://mukken.com/proberaum/berlin",
  examples: [
    { url: "https://mukken.com/proberaum/berlin", title: "Proberaum Berlin" },
    { url: "https://mukken.com/proberaum/koeln", title: "Proberaum Köln" },
  ],
  urlCount: 56,
  side: "both" as const,
};

describe("source triage prompt", () => {
  it("gives the model the evidence a domain decision needs", () => {
    const prompt = buildTriagePrompt([domain]);
    expect(prompt).toContain("mukken.com");
    expect(prompt).toContain("https://mukken.com/proberaum/berlin");
    expect(prompt).toContain("seen on 56 page(s)");
    expect(prompt).toContain("https://mukken.com/proberaum/koeln");
  });

  it("names every verdict and kind the mutation accepts", () => {
    for (const token of [
      "promote",
      "skip",
      "unsure",
      "classifieds",
      "community",
      "marketplace",
      "directory",
      "studio_network",
    ]) {
      expect(TRIAGE_INSTRUCTIONS).toContain(token);
    }
  });

  it("bounds long fields so one batch cannot blow the prompt up", () => {
    const prompt = buildTriagePrompt([
      { ...domain, snippet: "x".repeat(5_000), name: "y".repeat(5_000), examples: [] },
    ]);
    expect(prompt.length).toBeLessThan(1_200);
  });

  it("splits into batches and keeps every item exactly once", () => {
    const items = Array.from({ length: 45 }, (_, index) => index);
    const batches = triageBatches(items, 20);
    expect(batches.map((batch) => batch.length)).toEqual([20, 20, 5]);
    expect(batches.flat()).toEqual(items);
    expect(triageBatches(items, 0)[0]).toHaveLength(1);
    expect(triageBatches(items, 999)).toHaveLength(2);
  });
})
