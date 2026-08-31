import { chromium } from "playwright";
import process from "node:process";

const targetUrl =
  process.env.ROOMSCOUT_BANDNET_FORM_URL ??
  "https://bandnet.hamburg/anzeige/74565/kontaktieren";

const expectedControls = [
  { label: "Dein Name", id: "contact-name" },
  { label: "Deine E-Mail-Adresse", id: "contact-email" },
  { label: "Betreff", id: "contact-subject" },
  { label: "Nachricht", id: "contact-message" },
];

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  let response;
  let navigationError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      navigationError = undefined;
    } catch (error) {
      navigationError = error;
    }
    if (response?.ok()) break;
    if (attempt < 3) await page.waitForTimeout(attempt * 1_000);
  }
  if (navigationError && !response?.ok()) throw navigationError;
  if (!response?.ok()) {
    throw new Error(`Bandnet form returned HTTP ${response?.status() ?? "unknown"}`);
  }

  for (const control of expectedControls) {
    const label = page.getByLabel(control.label, { exact: true });
    if ((await label.count()) !== 1) {
      throw new Error(`Expected exactly one control labelled ${control.label}`);
    }
    if ((await label.getAttribute("id")) !== control.id) {
      throw new Error(`Unexpected id for ${control.label}`);
    }
  }

  const submit = page.getByRole("button", { name: "E-Mail senden", exact: true });
  if ((await submit.count()) !== 1) {
    throw new Error("Expected exactly one E-Mail senden submit control");
  }
  const formAction = await submit.evaluate((element) =>
    element.closest("form")?.getAttribute("action"),
  );
  if (!formAction?.endsWith("/kontaktieren")) {
    throw new Error("Bandnet contact form action changed unexpectedly");
  }

  // This verifier is deliberately read-only: it never fills or clicks.
  process.stdout.write(`${JSON.stringify({
    ok: true,
    targetUrl: page.url(),
    controls: expectedControls.map((control) => control.label),
    submitLabel: "E-Mail senden",
    formAction,
    interaction: "none",
  })}\n`);
} finally {
  await browser.close();
}
