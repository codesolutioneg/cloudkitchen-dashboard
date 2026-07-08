/**
 * One-time API login → saves browser storage state for all UI tests.
 */
import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API = process.env.API_BASE_URL ?? "https://api.cloud-kitchen.code-solution.org";
const DASHBOARD = process.env.DASHBOARD_URL ?? "https://dashboard.cloud-kitchen.code-solution.org";
const EMAIL = process.env.DASHBOARD_EMAIL ?? "admin@cloudkitchen.example";
const PASSWORD = process.env.DASHBOARD_PASSWORD ?? "Admin@12345";
const AUTH_FILE = path.join(__dirname, ".auth/admin.json");

export default async function globalSetup(_config: FullConfig) {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  const res = await fetch(`${API}/api/v1/auth/dashboard/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Global setup login failed: ${res.status}`);
  const { data } = await res.json();

  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: "ar" });
  const page = await context.newPage();
  await page.goto(`${DASHBOARD}/login`);
  await page.evaluate(
    ({ access, refresh }) => {
      localStorage.setItem("ck.accessToken", access);
      localStorage.setItem("ck.refreshToken", refresh);
    },
    { access: data.accessToken, refresh: data.refreshToken },
  );
  await page.goto(`${DASHBOARD}/dashboard`);
  await page.locator("aside").waitFor({ timeout: 30_000 });
  await context.storageState({ path: AUTH_FILE });
  await browser.close();
}
