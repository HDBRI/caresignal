import { defineConfig, devices } from "@playwright/test";

/**
 * UI tests run against a dedicated LOCAL dev server (port 3100, local PGlite database in data/e2e-pgdata),
 * never against the hosted Supabase database or the public site.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: "http://localhost:3100/api/health",
    timeout: 180_000,
    reuseExistingServer: true,
  },
});
