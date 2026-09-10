import { expect, it } from "vitest";
import { localBrowser, Stagehand } from "@browserbasehq/stagehand";
import { createStagehandV4Primitives } from "./stagehandV4Runtime";

it.runIf(process.env.STAGEHAND_LOCAL_PROOF === "1")(
  "runs the v4 runtime against a local synthetic form",
  async () => {
  const browser = await localBrowser.launch({ headless: true });
  try {
    const stagehand = await Stagehand.create({
      browser,
      model: { generate: async () => { throw new Error("LLM_MUST_NOT_RUN"); } },
      cache: false,
      logging: { level: "off" },
    });
    try {
      const page = await browser.context.activePage();
      if (!page) throw new Error("LOCAL_PAGE_MISSING");
      await page.evaluate(`document.body.innerHTML = '<form><input id="email" name="emailAddress" type="email" required value="proof@example.test"></form>'`);
      const result = await createStagehandV4Primitives({ stagehand, page }).inspectForm({
        selector: "#email",
        role: "email",
      });
      expect(result).toMatchObject({
        count: 1,
        name: "emailAddress",
        type: "email",
        required: true,
        value: "proof@example.test",
        formValid: true,
      });
    } finally {
      await stagehand.close();
    }
  } finally {
    await browser.close();
  }
  },
  30_000,
);
