#!/usr/bin/env node
/**
 * Full catalog + menu API cycle (Dishflow-aligned schema).
 *
 * Dishflow mapping:
 *   Category          ≈ Firebase custom_pos_categories / Odoo category
 *   Product           ≈ Odoo product template (name, name_ar, base_price, prep, image)
 *   Option group      ≈ ProductModifier (radio/checkbox, min/max select)
 *   Option            ≈ ModifierOption (price_extra)
 *   Menu              ≈ composed menu (sections group products)
 *   Menu section      ≈ category section on menu
 *   Menu product      ≈ productIds membership in section
 *   Company assignment ≈ branch/restaurant menu scope
 *
 * Run: npm run test:api-catalog-menu
 */
const API = process.env.API_BASE_URL ?? "https://api.cloud-kitchen.code-solution.org";
const ADMIN_EMAIL = process.env.DASHBOARD_EMAIL ?? "admin@cloudkitchen.example";
const ADMIN_PASSWORD = process.env.DASHBOARD_PASSWORD ?? "Admin@12345";
const DELIVERY_EMAIL = process.env.DELIVERY_EMAIL ?? "delivery@cloudkitchen.example";
const DELIVERY_PASSWORD = process.env.DELIVERY_PASSWORD ?? "Delivery@12345";

const results = [];
const ts = Date.now();

async function req(method, path, { body, token, expectStatus = 200, allowFail = false } = {}) {
  const url = `${API}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* */
  }
  const ok =
    res.status === expectStatus ||
    (expectStatus === 200 && (res.status === 200 || res.status === 201)) ||
    (allowFail && res.status === expectStatus);
  results.push({ method, path, status: res.status, ok, expectStatus, code: json?.error?.code });
  if (!ok) {
    throw new Error(
      `${method} ${path} → expected ${expectStatus}, got ${res.status} ${json?.error?.message ?? ""}`,
    );
  }
  return json?.data;
}

async function loginDashboard(email, password) {
  const tokens = await req("POST", "/api/v1/auth/dashboard/login", {
    body: { email, password },
  });
  return tokens.accessToken;
}

function section(name) {
  console.log(`\n▶ ${name}`);
}

async function main() {
  console.log("Catalog + Menu full API cycle (Dishflow-aligned)");
  console.log(`API: ${API}`);

  section("Auth — Super Admin");
  const adminToken = await loginDashboard(ADMIN_EMAIL, ADMIN_PASSWORD);
  await req("GET", "/api/v1/auth/dashboard/me", { token: adminToken });

  section("1. Category (≈ Dishflow menu section / Odoo category)");
  const category = await req("POST", "/api/v1/dashboard/catalog/categories", {
    token: adminToken,
    body: {
      name: `Breakfast ${ts}`,
      slug: `breakfast-${ts}`,
      sortOrder: 1,
      isActive: true,
    },
    expectStatus: 201,
  });
  console.log(`  category: ${category.name} (${category.id})`);

  await req("GET", "/api/v1/dashboard/catalog/categories", { token: adminToken });
  await req("PATCH", `/api/v1/dashboard/catalog/categories/${category.id}`, {
    token: adminToken,
    body: { sortOrder: 2 },
  });

  section("2. Product (≈ Dishflow product template)");
  const product = await req("POST", "/api/v1/dashboard/catalog/products", {
    token: adminToken,
    body: {
      categoryId: category.id,
      name: `Shakshuka ${ts}`,
      description: "Eggs in tomato sauce — seeded by API cycle",
      sku: `SKU-${ts}`,
      barcode: `628${String(ts).slice(-10)}`,
      basePrice: "85.00",
      currency: "SAR",
      visibility: "public",
      isActive: true,
      sortOrder: 1,
      attributes: { prepTimeMins: 25 },
    },
    expectStatus: 201,
  });
  console.log(`  product: ${product.name} (${product.id})`);

  await req("GET", `/api/v1/dashboard/catalog/products/${product.id}`, { token: adminToken });
  await req("GET", `/api/v1/dashboard/catalog/products?categoryId=${category.id}&page=1&pageSize=10`, {
    token: adminToken,
  });
  await req("PATCH", `/api/v1/dashboard/catalog/products/${product.id}`, {
    token: adminToken,
    body: { description: "Updated description" },
  });

  section("3. Translation — name_ar (≈ Dishflow nameAr)");
  await req("PUT", `/api/v1/dashboard/catalog/products/${product.id}/translations/ar`, {
    token: adminToken,
    body: { name: "شكشوكة", description: "بيض في صلصة طماطم" },
  });
  const localized = await req(
    "GET",
    `/api/v1/dashboard/catalog/products/${product.id}?lang=ar`,
    { token: adminToken },
  );
  if (!localized.name?.includes("شكشوكة")) {
    throw new Error(`Arabic translation not applied: got name="${localized.name}"`);
  }
  console.log(`  ar name: ${localized.name}`);

  section("4. Option group + options (≈ Dishflow modifiers)");
  const optionGroup = await req("POST", `/api/v1/dashboard/catalog/products/${product.id}/option-groups`, {
    token: adminToken,
    body: {
      name: "Bread Type",
      selectionType: "single",
      minSelect: 1,
      maxSelect: 1,
      isRequired: true,
      options: [
        { name: "Sourdough", priceAdjustment: "15.00", isActive: true, sortOrder: 1 },
        { name: "White", priceAdjustment: "0.00", isActive: true, sortOrder: 2 },
      ],
    },
    expectStatus: 201,
  });
  console.log(`  option group: ${optionGroup.name} (${optionGroup.options?.length ?? 0} options)`);

  const groups = await req("GET", `/api/v1/dashboard/catalog/products/${product.id}/option-groups`, {
    token: adminToken,
  });
  if (!groups[0]?.options?.length) throw new Error("Option group options missing on GET");

  section("5. Variant (optional SKU — CloudKitchen extension)");
  const variant = await req("POST", `/api/v1/dashboard/catalog/products/${product.id}/variants`, {
    token: adminToken,
    body: {
      variantName: "Large portion",
      sku: `VAR-${ts}`,
      priceAdjustment: "10.00",
      isDefault: false,
      isActive: true,
    },
    expectStatus: 201,
  });
  console.log(`  variant: ${variant.variantName ?? variant.name}`);

  await req("GET", `/api/v1/dashboard/catalog/products/${product.id}/variants`, { token: adminToken });
  await req("PATCH", `/api/v1/dashboard/catalog/products/${product.id}/variants/${variant.id}`, {
    token: adminToken,
    body: { priceAdjustment: "12.00" },
  });

  section("6. Tags + availability");
  const tag = await req("POST", `/api/v1/dashboard/catalog/products/${product.id}/tags`, {
    token: adminToken,
    body: { tagName: "featured" },
    expectStatus: 201,
  });
  await req("GET", `/api/v1/dashboard/catalog/products/${product.id}/tags`, { token: adminToken });

  const availability = await req(
    "POST",
    `/api/v1/dashboard/catalog/products/${product.id}/availability`,
    {
      token: adminToken,
      body: { dayOfWeek: 1, startTime: "08:00", endTime: "14:00" },
      expectStatus: 201,
    },
  );
  await req("GET", `/api/v1/dashboard/catalog/products/${product.id}/availability`, {
    token: adminToken,
  });
  await req(
    "PATCH",
    `/api/v1/dashboard/catalog/products/${product.id}/availability/${availability.id}`,
    { token: adminToken, body: { endTime: "15:00" } },
  );

  section("7. Pricing list + product price (≈ Dishflow branch price)");
  const pricingList = await req("POST", "/api/v1/dashboard/catalog/pricing-lists", {
    token: adminToken,
    body: { name: `Cycle List ${ts}`, currency: "SAR", isDefault: false },
    expectStatus: 201,
  });
  await req("POST", "/api/v1/dashboard/catalog/prices", {
    token: adminToken,
    body: {
      pricingListId: pricingList.id,
      productId: product.id,
      price: "90.00",
      effectiveFrom: new Date().toISOString(),
    },
    expectStatus: 201,
  });
  await req("GET", "/api/v1/dashboard/catalog/pricing-lists", { token: adminToken });

  section("8. Menu → section → product (≈ Dishflow menu composition)");
  const menu = await req("POST", "/api/v1/dashboard/menus", {
    token: adminToken,
    body: {
      name: `Company Menu ${ts}`,
      menuType: "general",
      description: "API cycle menu",
      isActive: true,
    },
    expectStatus: 201,
  });
  console.log(`  menu: ${menu.name} (${menu.id})`);

  const menuSection = await req("POST", `/api/v1/dashboard/menus/${menu.id}/sections`, {
    token: adminToken,
    body: { name: "Main", sortOrder: 1 },
    expectStatus: 201,
  });
  console.log(`  section: ${menuSection.name}`);

  await req("POST", `/api/v1/dashboard/menus/${menu.id}/sections/${menuSection.id}/products`, {
    token: adminToken,
    body: { productId: product.id, sortOrder: 1, isFeatured: true },
    expectStatus: 201,
  });

  await req("GET", `/api/v1/dashboard/menus/${menu.id}`, { token: adminToken });
  await req("GET", `/api/v1/dashboard/menus/${menu.id}/sections`, { token: adminToken });
  const sectionProducts = await req(
    "GET",
    `/api/v1/dashboard/menus/${menu.id}/sections/${menuSection.id}/products`,
    { token: adminToken },
  );
  if (!sectionProducts.some((sp) => sp.productId === product.id)) {
    throw new Error("Product not linked to menu section");
  }
  console.log(`  menu section products: ${sectionProducts.length}`);

  section("9. Company onboarding + menu assignment + company browse");
  const reg = await req("POST", "/api/v1/company/onboarding/register", {
    body: {
      legalName: `Cycle Kitchen ${ts}`,
      countryCode: "SA",
      primaryContactName: "Owner",
      primaryEmail: `owner-${ts}@example.com`,
      primaryPhone: "+966500000099",
      userFullName: "Menu Tester",
      userEmail: `menu-user-${ts}@example.com`,
      password: "SecurePass123!",
    },
    expectStatus: 201,
  });
  const companyId = reg.companyId;
  console.log(`  company registered: ${companyId}`);

  await req("POST", `/api/v1/dashboard/companies/${companyId}/approve`, {
    token: adminToken,
    body: { reason: "API cycle approval" },
  });

  const assignment = await req("POST", `/api/v1/dashboard/menus/${menu.id}/assignments`, {
    token: adminToken,
    body: { scopeType: "company", scopeId: companyId, priority: 10, isActive: true },
    expectStatus: 201,
  });
  await req("GET", `/api/v1/dashboard/menus/${menu.id}/assignments`, { token: adminToken });

  await req("POST", "/api/v1/dashboard/catalog/company-assignment", {
    token: adminToken,
    body: {
      companyId,
      pricingListId: pricingList.id,
      effectiveFrom: new Date().toISOString(),
    },
    expectStatus: 201,
  });

  const companyTokens = await req("POST", "/api/v1/auth/company/login", {
    body: { email: `menu-user-${ts}@example.com`, password: "SecurePass123!" },
  });
  const companyToken = companyTokens.accessToken;

  const browse = await req("GET", "/api/v1/company/catalog/menu", { token: companyToken });
  const found = browse.sections?.some((s) =>
    s.products?.some((p) => p.name?.includes("Shakshuka") || p.id === product.id),
  );
  if (!found) {
    throw new Error("Company menu browse did not return the assigned product");
  }
  console.log(`  company menu sections: ${browse.sections?.length ?? 0}`);

  section("10. RBAC — role flows");
  const deliveryToken = await loginDashboard(DELIVERY_EMAIL, DELIVERY_PASSWORD);
  await req("GET", "/api/v1/dashboard/delivery/orders", { token: deliveryToken });
  await req("GET", "/api/v1/dashboard/catalog/categories", {
    token: deliveryToken,
    expectStatus: 403,
    allowFail: true,
  });
  await req("GET", "/api/v1/dashboard/menus", {
    token: deliveryToken,
    expectStatus: 403,
    allowFail: true,
  });
  console.log("  Delivery role: own delivery orders OK, catalog+menus denied (403) ✓");

  await req("DELETE", `/api/v1/dashboard/menus/${menu.id}/assignments/${assignment.id}`, {
    token: adminToken,
    expectStatus: 204,
  });
  await req("DELETE", `/api/v1/dashboard/catalog/products/${product.id}/tags/${tag.id}`, {
    token: adminToken,
    expectStatus: 204,
  });
  await req(
    "DELETE",
    `/api/v1/dashboard/catalog/products/${product.id}/availability/${availability.id}`,
    { token: adminToken, expectStatus: 204 },
  );
  await req(
    "DELETE",
    `/api/v1/dashboard/menus/${menu.id}/sections/${menuSection.id}/products/${product.id}`,
    { token: adminToken, expectStatus: 204 },
  );
  await req("DELETE", `/api/v1/dashboard/menus/${menu.id}/sections/${menuSection.id}`, {
    token: adminToken,
    expectStatus: 204,
  });
  await req("DELETE", `/api/v1/dashboard/menus/${menu.id}`, { token: adminToken, expectStatus: 204 });

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n✅ ${passed}/${results.length} catalog+menu API checks passed`);
}

main().catch((e) => {
  console.error("\n❌", e.message);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed) {
      console.log(`  ${f.method} ${f.path} → ${f.status} (expected ${f.expectStatus})`);
    }
  }
  const passed = results.filter((r) => r.ok).length;
  console.log(`Partial: ${passed}/${results.length} passed before failure`);
  process.exit(1);
});
