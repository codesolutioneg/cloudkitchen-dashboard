#!/usr/bin/env node
/**
 * API cycle test — validates every endpoint behind dashboard UI buttons/properties.
 */
const API = process.env.API_BASE_URL ?? "https://api.cloud-kitchen.code-solution.org";
const EMAIL = process.env.DASHBOARD_EMAIL ?? "admin@cloudkitchen.example";
const PASSWORD = process.env.DASHBOARD_PASSWORD ?? "Admin@12345";

const results = [];

async function req(method, path, { body, token, expectStatus = 200 } = {}) {
  const url = `${API}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* */ }
  const ok = (res.status === expectStatus || (expectStatus === 200 && res.status === 201)) && json?.success !== false;
  results.push({ method, path, status: res.status, ok, code: json?.error?.code });
  if (!ok) throw new Error(`${method} ${path} → ${res.status} ${json?.error?.message ?? ""}`);
  return json?.data;
}

function section(name) {
  console.log(`\n▶ ${name}`);
}

async function main() {
  console.log("Dashboard API cycle test");
  console.log(`API: ${API}`);

  section("Auth");
  const tokens = await req("POST", "/api/v1/auth/dashboard/login", {
    body: { email: EMAIL, password: PASSWORD },
    expectStatus: 200,
  });
  const token = tokens.accessToken;
  await req("GET", "/api/v1/auth/dashboard/me", { token });
  const nav = await req("GET", "/api/v1/me/navigation", { token });
  console.log(`  navigation items: ${nav.length}`);

  section("Home KPIs");
  await req("GET", "/api/v1/dashboard/companies?approvalStatus=approved&pageSize=1", { token });
  await req("GET", "/api/v1/dashboard/orders?pageSize=1", { token });
  await req("GET", "/api/v1/dashboard/orders?statusCode=preparing&pageSize=1", { token });

  section("Companies");
  const companies = await req("GET", "/api/v1/dashboard/companies?page=1&pageSize=5", { token });
  const companyId = companies[0]?.id;
  if (companyId) {
    await req("GET", `/api/v1/dashboard/companies/${companyId}`, { token });
    await req("GET", `/api/v1/dashboard/companies/${companyId}/documents`, { token });
    await req("GET", `/api/v1/dashboard/companies/${companyId}/users`, { token });
    await req("GET", `/api/v1/dashboard/companies/${companyId}/features`, { token });
    await req("GET", `/api/v1/dashboard/companies/${companyId}/modules`, { token });
    await req("GET", `/api/v1/dashboard/settings/company/${companyId}`, { token });
  }

  section("Users & Roles");
  await req("GET", "/api/v1/dashboard/users?page=1&pageSize=20", { token });
  const roles = await req("GET", "/api/v1/dashboard/roles", { token });
  if (roles[0]) await req("GET", `/api/v1/dashboard/roles/${roles[0].id}`, { token });
  await req("GET", "/api/v1/dashboard/permissions", { token });
  await req("GET", "/api/v1/dashboard/dashboard-pages", { token });

  section("Features");
  await req("GET", "/api/v1/dashboard/features", { token });
  await req("GET", "/api/v1/dashboard/modules", { token });
  await req("GET", "/api/v1/dashboard/feature-groups", { token });
  await req("GET", "/api/v1/dashboard/feature-flags", { token });

  section("Catalog");
  await req("GET", "/api/v1/dashboard/catalog/categories", { token });
  const products = await req("GET", "/api/v1/dashboard/catalog/products?page=1&pageSize=5", { token });
  const productId = products[0]?.id;
  if (productId) {
    await req("GET", `/api/v1/dashboard/catalog/products/${productId}`, { token });
    await req("GET", `/api/v1/dashboard/catalog/products/${productId}/variants`, { token });
    await req("GET", `/api/v1/dashboard/catalog/products/${productId}/option-groups`, { token });
    await req("GET", `/api/v1/dashboard/catalog/products/${productId}/availability`, { token });
    await req("GET", `/api/v1/dashboard/catalog/products/${productId}/tags`, { token });
  }
  await req("GET", "/api/v1/dashboard/catalog/pricing-lists", { token });

  section("Menus");
  const menus = await req("GET", "/api/v1/dashboard/menus", { token });
  if (menus[0]) {
    const menuId = menus[0].id;
    await req("GET", `/api/v1/dashboard/menus/${menuId}`, { token });
    await req("GET", `/api/v1/dashboard/menus/${menuId}/sections`, { token });
    await req("GET", `/api/v1/dashboard/menus/${menuId}/assignments`, { token });
  }

  section("Rules & Workflows");
  await req("GET", "/api/v1/dashboard/rules/rule-types", { token });
  await req("GET", "/api/v1/dashboard/rules/business-rules", { token });
  await req("GET", "/api/v1/dashboard/rules/calendars", { token });
  const wfs = await req("GET", "/api/v1/dashboard/workflows?workflowType=order", { token });
  if (wfs[0]) {
    await req("GET", `/api/v1/dashboard/workflows/${wfs[0].id}/steps`, { token });
    await req("GET", `/api/v1/dashboard/workflows/${wfs[0].id}/transitions`, { token });
  }
  await req("GET", "/api/v1/dashboard/workflow-instances", { token });
  await req("GET", "/api/v1/dashboard/approval-workflows", { token });
  await req("GET", "/api/v1/dashboard/approval-requests", { token });

  section("Orders & Kitchen");
  const orders = await req("GET", "/api/v1/dashboard/orders?page=1&pageSize=10", { token });
  const orderId = orders[0]?.id;
  if (orderId) {
    const order = await req("GET", `/api/v1/dashboard/orders/${orderId}`, { token });
    // Write: add note (Post button)
    await req("POST", `/api/v1/dashboard/orders/${orderId}/notes`, {
      token,
      body: { note: `API cycle test ${Date.now()}`, isInternal: true },
      expectStatus: 200,
    });
    console.log(`  order ${order.orderNumber}: note added`);
  }
  await req("GET", "/api/v1/dashboard/orders?statusCode=kitchen_accepted&pageSize=5", { token });
  await req("GET", "/api/v1/dashboard/orders?statusCode=preparing&pageSize=5", { token });
  await req("GET", "/api/v1/dashboard/orders?statusCode=ready&pageSize=5", { token });

  section("Delivery & Ops");
  await req("GET", "/api/v1/dashboard/delivery/users", { token });

  section("Platform");
  await req("GET", "/api/v1/dashboard/audit-logs?page=1&pageSize=10", { token });
  await req("GET", "/api/v1/dashboard/notification-templates", { token });
  await req("GET", "/api/v1/dashboard/jobs?page=1", { token });
  await req("GET", "/api/v1/dashboard/integrations/systems", { token });
  await req("GET", "/api/v1/dashboard/integrations/events", { token });
  await req("GET", "/api/v1/dashboard/languages", { token });
  await req("GET", "/api/v1/dashboard/settings/global", { token });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n✅ ${passed}/${results.length} API checks passed`);
  if (failed.length) {
    console.log("\n❌ Failures:");
    for (const f of failed) console.log(`  ${f.method} ${f.path} → ${f.status} ${f.code ?? ""}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\n❌", e.message);
  const passed = results.filter((r) => r.ok).length;
  console.log(`Partial: ${passed}/${results.length} passed before failure`);
  process.exit(1);
});
