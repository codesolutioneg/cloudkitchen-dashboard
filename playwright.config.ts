import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const authFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "tests/e2e/.auth/admin.json");

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "tests/output/ui-cycle-report.json" }]],
  use: {
    baseURL: process.env.DASHBOARD_URL ?? "https://dashboard.cloud-kitchen.code-solution.org",
    storageState: authFile,
    headless: true,
    locale: "ar",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
