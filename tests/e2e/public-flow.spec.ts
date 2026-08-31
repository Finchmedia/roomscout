import { expect, test } from "@playwright/test";

test("public search flows from the landing page into the market explorer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Stop searching/ })).toBeVisible();
  await expect(page.getByText(/recent public signals/)).toBeVisible();
  await page.getByLabel("City or region").fill("Stuttgart");
  await page.getByRole("button", { name: "Search rehearsal rooms" }).click();

  await expect(page).toHaveURL(/\/explore\?city=Stuttgart/);
  await expect(page.getByRole("heading", { name: "Market explorer" })).toBeVisible();
  await expect(page.getByText(/signals in Stuttgart/)).toBeVisible();
});

test("signal-side filtering and provenance detail remain usable", async ({ page }) => {
  await page.goto("/explore");

  await page.getByRole("button", { name: "Supply", exact: true }).click();
  await expect(page.getByText("Post-punk band looking for a fixed room")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Sort signals" }).click();
  await page.getByRole("option", { name: "Newest" }).click();
  await expect(page.getByRole("combobox", { name: "Sort signals" })).toHaveText("Newest");
  const signalLinks = page.locator(".rs-signal-card__link");
  if (await signalLinks.count()) {
    await signalLinks.first().click();
    await expect(page.getByText("Known facts", { exact: true })).toBeVisible();
    await expect(page.getByText("Provenance", { exact: true })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "No matching signals yet" })).toBeVisible();
  }
});

test("mobile public navigation opens on demand", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only interaction");
  await page.goto("/");

  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page).toHaveURL(/\/explore/);
});
