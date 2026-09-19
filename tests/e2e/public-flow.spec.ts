import { expect, test } from "./public-fixture";

test("the landing page takes musicians into the Scout sign-up flow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('a[href="/explore"], a[href="/map"]')).toHaveCount(0);
  await page.getByRole("link", { name: "Start searching", exact: true }).click();

  await expect(page).toHaveURL(/\/sign-up\?returnTo=%2Fapp%2Fscout$/);
  await expect(page.getByRole("button", { name: "Create account", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "RoomScout home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("an old map link leads to sign-in for the Scout", async ({ page }) => {
  await page.goto("/map");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fapp%2Fscout$/);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("a room's evidence stays available and leads back to the Scout", async ({ page }) => {
  await page.goto("/signals/newer-supply");
  await expect(page.getByRole("heading", { level: 1, name: "Newly listed rehearsal room" })).toBeVisible();
  await expect(page.getByText("Known facts", { exact: true })).toBeVisible();
  await expect(page.getByText("€230 / month", { exact: true })).toBeVisible();
  await expect(page.getByText("Provenance", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open source" })).toHaveAttribute("href", "https://example.com/rehearsal-room");
  await page.getByRole("link", { name: "Go to Scout", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fapp%2Fscout$/);
});

test("mobile public navigation opens on demand", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only interaction");
  await page.goto("/signals/newer-supply");

  await expect(page.getByRole("navigation", { name: "Public navigation" })).toBeHidden();
  await page.getByRole("button", { name: "Open navigation" }).click();
  const navigation = page.getByRole("navigation", { name: "Public navigation" });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: /explore|map/i })).toHaveCount(0);
  await navigation.getByRole("link", { name: "How it works", exact: true }).click();
  await expect(page).toHaveURL(/\/#how$/);
});
