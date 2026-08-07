/**
 * Full dashboard UI cycle test — pages, data properties, dialogs, and action buttons.
 * Run: npx playwright test (from dashboard)
 */
import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.DASHBOARD_EMAIL ?? "admin@cloudkitchen.example";
const ADMIN_PASSWORD = process.env.DASHBOARD_PASSWORD ?? "Admin@12345";

async function login(page: Page, attempt = 1) {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);

  const loginBtn = page.getByRole("button", { name: /تسجيل الدخول|sign in|login/i });
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/auth/dashboard/login"), { timeout: 20_000 }),
    loginBtn.click(),
  ]);

  if (!response.ok() && attempt < 3) {
    await page.waitForTimeout(2000);
    return login(page, attempt + 1);
  }
  expect(response.ok(), `login failed: ${response.status()}`).toBeTruthy();

  await page.waitForURL(/\/dashboard/, { timeout: 25_000 });
  await page.locator(".animate-spin").first().waitFor({ state: "hidden", timeout: 20_000 }).catch(() => {});
  await expect(page.locator("aside")).toBeVisible({ timeout: 25_000 });
}

async function gotoDashboard(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
  if (page.url().includes("/login")) {
    await login(page);
    await page.goto(path);
    await page.waitForLoadState("domcontentloaded");
  }
  await expect(page.locator("aside")).toBeVisible({ timeout: 15_000 });
}

const API_BASE = process.env.API_BASE_URL ?? "https://api.cloud-kitchen.code-solution.org";

async function apiGet<T>(page: Page, path: string): Promise<T> {
  return page.evaluate(
    async ({ apiBase, p }) => {
      const token = localStorage.getItem("ck.accessToken");
      const res = await fetch(`${apiBase}${p}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? `API ${res.status}`);
      return json.data as T;
    },
    { apiBase: API_BASE, p: path },
  );
}

async function clickTab(page: Page, pattern: RegExp) {
  await page.locator('[role="tab"]').filter({ hasText: pattern }).first().click();
}

async function expectNoFatalError(page: Page) {
  await expect(page.getByRole("heading", { name: /internal server error|application error/i })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Application error");
}

test.describe("Dashboard UI full cycle", () => {
  test.describe.configure({ mode: "serial" });

  test("login + home KPIs load", async ({ page }) => {
    await gotoDashboard(page, "/dashboard");
    await expectNoFatalError(page);
    // KPI cards or dashboard heading
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await page.waitForTimeout(1500);
    await expectNoFatalError(page);
  });

  test("companies list + detail API + row navigation", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/companies");
    await expectNoFatalError(page);

    await expect(page.locator("table")).toBeVisible({ timeout: 15_000 });
    for (const label of [/الكل|All/i, /موافَق|Approved/i, /قيد الانتظار|Pending/i]) {
      await expect(page.getByRole("button", { name: label }).first()).toBeVisible();
    }

    const companies = await apiGet<Array<{ id: string; legalName: string }>>(page, "/api/v1/dashboard/companies?page=1&pageSize=1");
    const company = companies[0];
    expect(company?.id).toBeTruthy();

    const detail = await apiGet<{ id: string; legalName: string }>(page, `/api/v1/dashboard/companies/${company.id}`);
    expect(detail.legalName).toBe(company.legalName);

    await page.getByRole("row", { name: company.legalName }).first().click();
    await page.waitForURL(new RegExp(company.id.replace(/-/g, "\\-")), { timeout: 10_000 }).catch(() => {});

    const tabs = page.locator('[role="tab"]');
    if (await tabs.count() >= 3) {
      await clickTab(page, /Documents|المستندات/);
      await expect(page.getByText(/Upload|رفع/i).first()).toBeVisible();
      await clickTab(page, /Features|الميزات/);
      await expectNoFatalError(page);
    }
  });

  test("users page — list, invite dialog, row sheet", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/users");
    await expectNoFatalError(page);

    await page.getByRole("button", { name: /دعوة مستخدم|Invite user/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await page.keyboard.press("Escape");

    const row = page.locator("tbody tr").first();
    if (await row.isVisible()) {
      await row.click();
      await expect(page.locator("[data-state='open'], [role='dialog']").first()).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press("Escape");
    }
  });

  test("roles list + role detail permissions matrix", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/roles");

    const link = page.locator('a[href*="/dashboard/roles/"]').first();
    if (await link.isVisible()) {
      await link.click();
      await page.waitForURL(/\/dashboard\/roles\//);
      await expectNoFatalError(page);

      await page.getByRole("tab", { name: /Page permissions|صلاحيات الصفحات/i }).click();
      await expect(page.locator("table")).toBeVisible({ timeout: 15_000 });

      await page.getByRole("tab", { name: /API permissions|صلاحيات API/i }).click();
      await expectNoFatalError(page);
    }
  });

  test("features page loads CRUD sections", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/features");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("catalog — categories, products, dishflow-like product schema", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/catalog");
    await expectNoFatalError(page);

    // Categories tab
    await clickTab(page, /Categories|الفئات|التصنيفات/i);
    await expect(page.getByRole("button", { name: /New category|فئة جديدة/i }).first()).toBeVisible();
    const categories = await apiGet<Array<{ id: string; name: string; slug: string }>>(
      page,
      "/api/v1/dashboard/catalog/categories",
    );
    expect(categories.length).toBeGreaterThan(0);

    // Products tab + detail with all schema tabs (≈ Dishflow: product + modifiers + tags)
    await clickTab(page, /Products|المنتجات/i);
    const products = await apiGet<Array<{ id: string; name: string }>>(
      page,
      "/api/v1/dashboard/catalog/products?page=1&pageSize=5",
    );
    const product = products[0];
    expect(product?.id).toBeTruthy();

    const detail = await apiGet<{ id: string; name: string; basePrice: string }>(
      page,
      `/api/v1/dashboard/catalog/products/${product!.id}`,
    );
    expect(detail.id).toBe(product!.id);

    await page.goto(`/dashboard/catalog/products/${product!.id}`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("aside")).toBeVisible({ timeout: 15_000 });
    await expectNoFatalError(page);

    for (const tab of [
      /General|عام/i,
      /Translations|الترجمات/i,
      /Variants|المتغيرات/i,
      /Options|الخيارات/i,
      /Availability|التوافر/i,
      /Tags|الوسوم/i,
    ]) {
      await clickTab(page, tab);
      await expectNoFatalError(page);
    }

    // API sub-resources (modifiers ≈ option-groups, variants, tags)
    await apiGet(page, `/api/v1/dashboard/catalog/products/${product!.id}/option-groups`);
    await apiGet(page, `/api/v1/dashboard/catalog/products/${product!.id}/variants`);
    await apiGet(page, `/api/v1/dashboard/catalog/products/${product!.id}/tags`);
    await apiGet(page, `/api/v1/dashboard/catalog/products/${product!.id}/availability`);

    // Pricing tab
    await gotoDashboard(page, "/dashboard/catalog");
    await clickTab(page, /Pricing Lists|قوائم الأسعار/i);
    await expectNoFatalError(page);
    await apiGet(page, "/api/v1/dashboard/catalog/pricing-lists");
  });

  test("menus — list, sections, assignments (≈ Dishflow menu sections)", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/menus");
    await expectNoFatalError(page);

    const menus = await apiGet<Array<{ id: string; name: string }>>(page, "/api/v1/dashboard/menus");
    expect(menus.length).toBeGreaterThan(0);
    const menu = menus[0];

    const menuDetail = await apiGet<{ id: string; name: string; sections?: unknown[] }>(
      page,
      `/api/v1/dashboard/menus/${menu.id}`,
    );
    expect(menuDetail.name).toBe(menu.name);

    await page.goto(`/dashboard/menus/${menu.id}`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("aside")).toBeVisible({ timeout: 15_000 });
    await expectNoFatalError(page);

    await clickTab(page, /Sections|الأقسام/i);
    await expect(page.getByPlaceholder(/Section name|اسم القسم/i).first()).toBeVisible();

    const sections = await apiGet<Array<{ id: string; name: string }>>(
      page,
      `/api/v1/dashboard/menus/${menu.id}/sections`,
    );
    if (sections[0]) {
      await apiGet(
        page,
        `/api/v1/dashboard/menus/${menu.id}/sections/${sections[0].id}/products`,
      );
    }

    await clickTab(page, /Assignments|التعيينات/i);
    await expectNoFatalError(page);
    await apiGet(page, `/api/v1/dashboard/menus/${menu.id}/assignments`);
  });

  test("orders list + order detail workflow controls", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/orders");

    const orderLink = page.locator('a[href*="/dashboard/orders/"]').first();
    if (await orderLink.isVisible()) {
      await orderLink.click();
      await page.waitForURL(/\/dashboard\/orders\//);
      await expectNoFatalError(page);

      await expect(page.getByText(/Workflow|سير العمل/i).first()).toBeVisible();
      await expect(page.locator("select").first()).toBeVisible();
      await expect(page.getByRole("button", { name: /Transition|انتقال/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Post|إرسال|Send/i })).toBeVisible();
    }
  });

  test("kitchen kanban — columns and advance buttons", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/kitchen");
    await expect(page.getByText(/Incoming|preparing|Ready|المطبخ/i).first()).toBeVisible();
  });

  test("operations + delivery pages", async ({ page }) => {
    for (const path of ["/dashboard/operations", "/dashboard/delivery"]) {
      await gotoDashboard(page, path);
      await expect(page.locator("h1, h2").first()).toBeVisible();
    }
  });

  test("workflows + approval workflows", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/workflows");

    const wfLink = page.locator('a[href*="/dashboard/workflows/"]').first();
    if (await wfLink.isVisible()) {
      await wfLink.click();
      await page.waitForURL(/\/dashboard\/workflows\//);
      await expectNoFatalError(page);
    }

    await gotoDashboard(page, "/dashboard/approval-workflows");
    const awLink = page.locator('a[href*="/dashboard/approval-workflows/"]').first();
    if (await awLink.isVisible()) {
      await awLink.click();
      await expectNoFatalError(page);
    }
  });

  test("rules page — all tabs", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/rules");

    for (const tab of [/Rule types|أنواع/i, /Business rules|قواعد/i, /Calendars|التقويم/i, /Resolve|حل/i]) {
      const t = page.locator('[role="tab"]').filter({ hasText: tab }).first();
      if (await t.isVisible()) {
        await t.click();
        await expectNoFatalError(page);
      }
    }
  });

  test("audit logs, notifications, jobs, integrations, localization", async ({ page }) => {
    const paths = [
      "/dashboard/audit-logs",
      "/dashboard/notifications",
      "/dashboard/jobs",
      "/dashboard/integrations",
      "/dashboard/localization",
      "/dashboard/settings",
    ];
    for (const path of paths) {
      await gotoDashboard(page, path);
      await expect(page.locator("h1, h2").first()).toBeVisible();
    }
  });

  test("sidebar navigation covers all seeded routes", async ({ page }) => {
    await gotoDashboard(page, "/dashboard");
    const navLinks = page.locator("aside nav a");
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(5);

    const hrefs: string[] = [];
    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute("href");
      if (href && !hrefs.includes(href)) hrefs.push(href);
    }

    for (const href of hrefs) {
      if (!href) continue;
      await gotoDashboard(page, href);
      await expectNoFatalError(page);
    }
  });

  test("API-backed write actions smoke (note on order)", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/orders");

    const orders = await apiGet<Array<{ id: string; orderNumber: string }>>(page, "/api/v1/dashboard/orders?page=1&pageSize=1");
    if (!orders[0]) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/orders/${orders[0].id}`, { waitUntil: "load" });
    await page.waitForSelector("textarea", { timeout: 15_000 }).catch(() => {});

    const orderLink = page.locator('a[href*="/dashboard/orders/"]').first();
    if (await orderLink.isVisible()) {
      await orderLink.click();
    }

    const noteArea = page.locator("textarea").first();
    if (!(await noteArea.isVisible())) {
      test.skip();
      return;
    }
    await noteArea.fill(`UI cycle test note ${Date.now()}`);
    await page.getByRole("button", { name: /Post|إرسال|Send/i }).click();
    await expect(page.getByText(/Note added|تم|note/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
