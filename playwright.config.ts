import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    contextOptions: { reducedMotion: "reduce" },
  },
  webServer: {
    command: "npm exec vite build -- --outDir node_modules/.cache/roomscout-e2e-dist && npm exec vite preview -- --host 127.0.0.1 --outDir node_modules/.cache/roomscout-e2e-dist",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    env: {
      VITE_CONVEX_URL: "https://roomscout-e2e.convex.cloud",
      VITE_CONVEX_SITE_URL: "https://roomscout-e2e.convex.site",
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
