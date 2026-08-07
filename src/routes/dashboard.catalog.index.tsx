import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { ProductSearchBar } from "@/components/app/ProductSearchBar";
import { DataTable, TablePagination, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EntitySelect } from "@/components/app/EntitySelect";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { catalogApi, companiesApi, menusApi, menusExtApi } from "@/services/apiClient";
import type { Category, Product, PricingList, CompanyCatalogAssignment } from "@/types/api";
import { Plus, ExternalLink, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { normalizePublicAssetUrl } from "@/lib/assetUrl";
import { CURRENCIES, optionsFrom } from "@/lib/systemOptions";
import { usePlatformDefaults } from "@/hooks/usePlatformDefaults";

export const Route = createFileRoute("/dashboard/catalog/")({ component: CatalogPage });

function CatalogPage() {
  return (
    <>
      <PageHeader
        title={t("Catalog (PIM)")}
        description={t("All food items live here. Menus pick from these products.")}
      />
      <div className="mb-4 rounded-2xl border border-border bg-muted/30 p-5">
        <h3 className="font-bold">{t("What is what?")}</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li><strong className="text-foreground">{t("Products")}</strong> — {t("Individual dishes (name, price, photo).")}</li>
          <li><strong className="text-foreground">{t("Categories")}</strong> — {t("Groups like Burgers, Drinks (optional).")}</li>
          <li><strong className="text-foreground">{t("Menus")}</strong> — {t("What each company sees — go to Menus to assign.")}</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/dashboard/menus"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            {t("Go to Menus")} →
          </Link>
          <Link
            to="/dashboard/catalog/custom-products"
            className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
          >
            {t("Custom product requests")} →
          </Link>
        </div>
      </div>
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="products">{t("Products")}</TabsTrigger>
          <TabsTrigger value="categories">{t("Categories")}</TabsTrigger>
          <TabsTrigger value="pricing">{t("Pricing Lists")}</TabsTrigger>
          <TabsTrigger value="assignments">{t("Company setup")}</TabsTrigger>
        </TabsList>
        <TabsContent value="categories"><CategoriesTab /></TabsContent>
        <TabsContent value="products"><ProductsTab /></TabsContent>
        <TabsContent value="pricing"><PricingTab /></TabsContent>
        <TabsContent value="assignments"><AssignmentsTab /></TabsContent>
      </Tabs>
    </>
  );
}

function CategoriesTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["categories"], queryFn: catalogApi.listCategories });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", sortOrder: 0 });
  async function create() {
    if (!form.name) return;
    try {
      await catalogApi.createCategory({ ...form, isActive: true });
      toast.success(t("Created"));
      setOpen(false);
      setForm({ name: "", slug: "", sortOrder: 0 });
      qc.invalidateQueries({ queryKey: ["categories"] });
    } catch (e) { toast.error((e as Error).message); }
  }
  const cols: Column<Category>[] = [
    { key: "name", header: t("Category"), cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "slug", header: t("Slug"), cell: (r) => <code className="text-xs">{r.slug}</code> },
    { key: "sort", header: t("Sort order"), cell: (r) => r.sortOrder },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? t("Active") : t("Inactive")}</StatusBadge> },
  ];
  return (
    <>
      <div className="mb-3 flex justify-end">
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> {t("New category")}</button>
      </div>
      <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle={t("No categories")} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("Create category")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder={t("Name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder={t("Slug")} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input type="number" placeholder={t("Sort order")} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: +e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Create")}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProductsTab() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { currency: defaultCurrency } = usePlatformDefaults();
  const [form, setForm] = useState({ name: "", categoryId: "", basePrice: "0", currency: "EGP" });
  const query = useQuery({
    queryKey: ["products", page, search],
    queryFn: () => catalogApi.listProducts({ page, pageSize: 20, search: search || undefined }),
  });
  const categories = useQuery({ queryKey: ["categories"], queryFn: catalogApi.listCategories });
  const categoryOptions = useMemo(
    () => (categories.data ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.slug })),
    [categories.data],
  );
  function openCreate() {
    setForm({ name: "", categoryId: "", basePrice: "0", currency: defaultCurrency });
    setOpen(true);
  }
  async function create() {
    if (!form.name || !form.categoryId) return;
    try {
      await catalogApi.createProduct({ ...form, isActive: true, visibility: "public" as never });
      toast.success(t("Created"));
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e) { toast.error((e as Error).message); }
  }
  const cols: Column<Product>[] = [
    { key: "name", header: t("Products"), cell: (r) => (
      <div className="flex items-center gap-3">
        {r.imageUrl ? (
          <img src={normalizePublicAssetUrl(r.imageUrl) ?? undefined} alt="" className="h-10 w-10 rounded-lg border border-border object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted-foreground">—</div>
        )}
        <div>
          <div className="font-semibold">{r.name}</div>
          {r.sku && <div className="text-xs text-muted-foreground">SKU {r.sku}</div>}
        </div>
      </div>
    ) },
    { key: "price", header: t("Base price"), cell: (r) => `${r.basePrice} ${r.currency}` },
    { key: "visibility", header: "Visibility", cell: (r) => <StatusBadge tone="info">{r.visibility}</StatusBadge> },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? t("Active") : t("Inactive")}</StatusBadge> },
  ];
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ProductSearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="w-full max-w-sm" />
        <button onClick={openCreate} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> {t("New product")}</button>
      </div>
      <DataTable columns={cols} rows={query.data?.items} loading={query.isLoading}
        onRowClick={(r) => navigate({ to: "/dashboard/catalog/products/$id", params: { id: r.id } })}
        emptyTitle={t("No products yet")} />
      {query.data && query.data.totalItems > 0 && (
        <TablePagination page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} onPageChange={setPage} />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("Create product")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder={t("Name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <EntitySelect
              value={form.categoryId}
              onChange={(categoryId) => setForm({ ...form, categoryId })}
              options={categoryOptions}
              placeholder={t("Select category…")}
            />
            <input placeholder={t("Base price")} value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <EntitySelect
              value={form.currency}
              onChange={(currency) => setForm({ ...form, currency })}
              options={optionsFrom(CURRENCIES, t)}
              placeholder={t("Currency")}
            />
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Create")}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PricingTab() {
  const qc = useQueryClient();
  const { currency: defaultCurrency } = usePlatformDefaults();
  const { data, isLoading } = useQuery({ queryKey: ["pricing-lists"], queryFn: catalogApi.listPricingLists });
  const [productSearch, setProductSearch] = useState("");
  const products = useQuery({
    queryKey: ["products-picker", productSearch],
    queryFn: () => catalogApi.listProducts({ page: 1, pageSize: 100, search: productSearch || undefined }),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", currency: "EGP" });
  const [priceOpen, setPriceOpen] = useState(false);
  const [price, setPrice] = useState({ pricingListId: "", productId: "", price: "0" });
  const listOptions = useMemo(
    () => (data ?? []).map((l) => ({ value: l.id, label: l.name, hint: l.currency })),
    [data],
  );
  const productOptions = useMemo(
    () => (products.data?.items ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.sku ?? undefined })),
    [products.data],
  );
  function openCreate() {
    setForm({ code: "", name: "", currency: defaultCurrency });
    setOpen(true);
  }
  async function create() {
    try {
      await catalogApi.createPricingList({ name: form.name || form.code, currency: form.currency, isActive: true });
      toast.success(t("Created"));
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["pricing-lists"] });
    } catch (e) { toast.error((e as Error).message); }
  }
  async function addPrice() {
    if (!price.pricingListId || !price.productId) return;
    try {
      await catalogApi.createPrice(price);
      toast.success(t("Saved"));
      setPriceOpen(false);
    } catch (e) { toast.error((e as Error).message); }
  }
  const cols: Column<PricingList>[] = [
    { key: "code", header: t("Code"), cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: t("Name"), cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "currency", header: t("Currency"), cell: (r) => r.currency },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? t("Active") : t("Inactive")}</StatusBadge> },
  ];
  return (
    <>
      <div className="mb-3 flex justify-end gap-2">
        <button onClick={() => setPriceOpen(true)} className="rounded-[10px] border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("Price")}</button>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> {t("Create")}</button>
      </div>
      <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle={t("No pricing lists")} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>{t("Pricing Lists")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder={t("Code")} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder={t("Name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <EntitySelect
              value={form.currency}
              onChange={(currency) => setForm({ ...form, currency })}
              options={optionsFrom(CURRENCIES, t)}
              placeholder={t("Currency")}
            />
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Create")}</button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={priceOpen} onOpenChange={setPriceOpen}>
        <DialogContent><DialogHeader><DialogTitle>{t("Price")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <EntitySelect value={price.pricingListId} onChange={(pricingListId) => setPrice({ ...price, pricingListId })} options={listOptions} placeholder={t("Select pricing list…")} />
            <ProductSearchBar value={productSearch} onChange={setProductSearch} className="w-full" />
            <EntitySelect value={price.productId} onChange={(productId) => setPrice({ ...price, productId })} options={productOptions} placeholder={t("Select product…")} />
            <input placeholder={t("Price")} value={price.price} onChange={(e) => setPrice({ ...price, price: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <DialogFooter><button onClick={addPrice} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Save")}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function localDateTimeToIso(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function AssignmentsTab() {
  const qc = useQueryClient();
  const companies = useQuery({ queryKey: ["companies-picker"], queryFn: () => companiesApi.list({ page: 1, pageSize: 200, approvalStatus: "approved" }) });
  const menus = useQuery({ queryKey: ["menus"], queryFn: menusApi.list });
  const lists = useQuery({ queryKey: ["pricing-lists"], queryFn: catalogApi.listPricingLists });
  const assignments = useQuery({
    queryKey: ["company-catalog-assignments"],
    queryFn: () => catalogApi.listCompanyAssignments({ approvalStatus: "approved" }),
  });
  const [form, setForm] = useState({ companyId: "", menuId: "", pricingListId: "", priority: 10, effectiveFrom: "", effectiveTo: "" });

  const companyOptions = useMemo(
    () => (companies.data?.items ?? []).map((c) => ({ value: c.id, label: c.legalName, hint: c.tradeName ?? undefined })),
    [companies.data],
  );
  const menuOptions = useMemo(
    () => (menus.data ?? []).map((m) => ({ value: m.id, label: m.name, hint: m.menuType })),
    [menus.data],
  );
  const listOptions = useMemo(
    () => (lists.data ?? []).map((l) => ({ value: l.id, label: l.name, hint: l.currency })),
    [lists.data],
  );

  async function assign() {
    if (!form.companyId) {
      toast.error(t("Select company…"));
      return;
    }
    if (!form.menuId && !form.pricingListId) {
      toast.error("Select a menu and/or pricing list");
      return;
    }
    try {
      if (form.menuId) {
        await menusApi.createAssignment(form.menuId, {
          scopeType: "company",
          scopeId: form.companyId,
          priority: form.priority,
        });
      }
      if (form.pricingListId) {
        await catalogApi.assignToCompany({
          companyId: form.companyId,
          pricingListId: form.pricingListId,
          effectiveFrom: localDateTimeToIso(form.effectiveFrom),
          effectiveTo: localDateTimeToIso(form.effectiveTo),
        });
      }
      toast.success(t("Saved"));
      setForm({ companyId: "", menuId: "", pricingListId: "", priority: 10, effectiveFrom: "", effectiveTo: "" });
      qc.invalidateQueries({ queryKey: ["company-catalog-assignments"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  async function removeMenu(row: CompanyCatalogAssignment) {
    if (!row.menu) return;
    if (!confirm(t("Remove menu assignment from this company? The website menu will be empty until reassigned."))) return;
    try {
      await menusExtApi.deleteAssignment(row.menu.menuId, row.menu.assignmentId);
      toast.success(t("Removed"));
      qc.invalidateQueries({ queryKey: ["company-catalog-assignments"] });
      qc.invalidateQueries({ queryKey: ["menu-assignments", row.menu.menuId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function removePricing(row: CompanyCatalogAssignment) {
    if (!row.pricing) return;
    if (!confirm(t("Remove pricing assignment from this company?"))) return;
    try {
      await catalogApi.deletePricingAssignment(row.pricing.assignmentId);
      toast.success(t("Removed"));
      qc.invalidateQueries({ queryKey: ["company-catalog-assignments"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const cols: Column<CompanyCatalogAssignment>[] = [
    {
      key: "company",
      header: t("Companies"),
      cell: (r) => (
        <div>
          <div className="font-semibold">{r.companyName}</div>
          {r.tradeName && <div className="text-xs text-muted-foreground">{r.tradeName}</div>}
        </div>
      ),
    },
    {
      key: "menu",
      header: t("Menus"),
      cell: (r) => r.menu ? (
        <Link to="/dashboard/menus/$id" params={{ id: r.menu.menuId }} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          {r.menu.menuName} <ExternalLink className="h-3 w-3" />
        </Link>
      ) : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "pricing",
      header: t("Pricing Lists"),
      cell: (r) => r.pricing ? (
        <span className="font-medium">{r.pricing.pricingListName} <span className="text-xs text-muted-foreground">({r.pricing.currency})</span></span>
      ) : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge tone={r.menu ? "success" : "muted"}>{r.menu ? t("Menu assigned") : t("No menu")}</StatusBadge>
          <StatusBadge tone={r.pricing ? "info" : "muted"}>{r.pricing ? t("Pricing assigned") : t("No pricing")}</StatusBadge>
        </div>
      ),
    },
    {
      key: "actions",
      header: t("Actions"),
      cell: (r) => (
        <div className="flex flex-wrap gap-2">
          {r.menu && (
            <button
              type="button"
              onClick={() => void removeMenu(r)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-destructive hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("Remove menu")}
            </button>
          )}
          {r.pricing && (
            <button
              type="button"
              onClick={() => void removePricing(r)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-destructive hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("Remove pricing")}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <p className="font-semibold text-primary">{t("Tip: assigning menus")}</p>
        <p className="mt-1 text-muted-foreground">{t("Easiest way: open Menus → pick a menu → Give to companies.")}</p>
        <Link to="/dashboard/menus" className="mt-2 inline-block font-bold text-primary hover:underline">
          {t("Go to Menus")} →
        </Link>
      </div>
      <div className="card-elevated space-y-4 p-6">
        <div>
          <h3 className="font-semibold">{t("Company setup")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("Link a company to a menu and price list.")}</p>
        </div>
        <EntitySelect value={form.companyId} onChange={(companyId) => setForm({ ...form, companyId })} options={companyOptions} placeholder={t("Select company…")} />
        <EntitySelect value={form.menuId} onChange={(menuId) => setForm({ ...form, menuId })} options={menuOptions} placeholder={t("Select menu…")} />
        <EntitySelect value={form.pricingListId} onChange={(pricingListId) => setForm({ ...form, pricingListId })} options={listOptions} placeholder={t("Select pricing list…")} />
        <button onClick={assign} disabled={!form.companyId || (!form.menuId && !form.pricingListId)} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{t("Save setup")}</button>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold">{t("Current company setups")}</h3>
        <DataTable
          columns={cols}
          rows={assignments.data}
          loading={assignments.isLoading}
          emptyTitle={t("No assignments")}
          emptyDescription="Assign a menu and pricing list using the form above."
        />
      </div>
    </div>
  );
}
