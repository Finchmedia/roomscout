import { expect, test } from "@playwright/test";

test("public search flows from the landing page into the market explorer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Stop searching/ })).toBeVisible();
  await expect(page.getByText("Prototype data").first()).toBeVisible();
  await page.getByLabel("City or region").fill("Stuttgart");
  await page.getByRole("button", { name: "Search rehearsal rooms" }).click();

  await expect(page).toHaveURL(/\/explore\?location=Stuttgart/);
  await expect(page.getByRole("heading", { name: "Market explorer" })).toBeVisible();
  await expect(page.getByText("Shared rehearsal room in Stuttgart-West")).toBeVisible();
});

test("signal-side filtering and provenance detail remain usable", async ({ page }) => {
  await page.goto("/explore");

  await page.getByRole("button", { name: "Supply", exact: true }).click();
  await expect(page.getByText("Post-punk band looking for a fixed room")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Sort signals" }).click();
  await page.getByRole("option", { name: "Newest" }).click();
  await expect(page.getByRole("combobox", { name: "Sort signals" })).toHaveText("Newest");
  await page.getByRole("link", { name: "Shared rehearsal room in Stuttgart-West" }).click();

  await expect(page).toHaveURL(/\/signals\/stuttgart-west-share/);
  await expect(page.getByText("Known facts", { exact: true })).toBeVisible();
  await expect(page.getByText("Provenance", { exact: true })).toBeVisible();
  await expect(page.getByText("Observed is not verified", { exact: false })).toHaveCount(0);
});

test("mobile public navigation opens on demand", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only interaction");
  await page.goto("/");

  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page).toHaveURL(/\/explore/);
});
