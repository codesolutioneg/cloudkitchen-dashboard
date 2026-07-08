import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, TablePagination, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EntitySelect } from "@/components/app/EntitySelect";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { catalogApi, companiesApi } from "@/services/apiClient";
import type { Category, Product, PricingList } from "@/types/api";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { normalizePublicAssetUrl } from "@/lib/assetUrl";

export const Route = createFileRoute("/dashboard/catalog/")({ component: CatalogPage });

function CatalogPage() {
  return (
    <>
      <PageHeader title={t("Catalog (PIM)")} description={t("Products, categories, pricing lists and company assignments.")} />
      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="categories">{t("Categories")}</TabsTrigger>
          <TabsTrigger value="products">{t("Products")}</TabsTrigger>
          <TabsTrigger value="pricing">{t("Pricing Lists")}</TabsTrigger>
          <TabsTrigger value="assignments">{t("Company Assignments")}</TabsTrigger>
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
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", categoryId: "", basePrice: "0", currency: "SAR" });
  const query = useQuery({ queryKey: ["products", page], queryFn: () => catalogApi.listProducts({ page, pageSize: 20 }) });
  const categories = useQuery({ queryKey: ["categories"], queryFn: catalogApi.listCategories });
  const categoryOptions = useMemo(
    () => (categories.data ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.slug })),
    [categories.data],
  );
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
      <div className="mb-3 flex justify-end">
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> {t("New product")}</button>
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
            <input placeholder={t("Currency")} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Create")}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PricingTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["pricing-lists"], queryFn: catalogApi.listPricingLists });
  const products = useQuery({ queryKey: ["products-picker"], queryFn: () => catalogApi.listProducts({ page: 1, pageSize: 100 }) });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", currency: "SAR" });
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
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> {t("Create")}</button>
      </div>
      <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle={t("No pricing lists")} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>{t("Pricing Lists")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder={t("Code")} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder={t("Name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder={t("Currency")} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Create")}</button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={priceOpen} onOpenChange={setPriceOpen}>
        <DialogContent><DialogHeader><DialogTitle>{t("Price")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <EntitySelect value={price.pricingListId} onChange={(pricingListId) => setPrice({ ...price, pricingListId })} options={listOptions} placeholder={t("Select pricing list…")} />
            <EntitySelect value={price.productId} onChange={(productId) => setPrice({ ...price, productId })} options={productOptions} placeholder={t("Select product…")} />
            <input placeholder={t("Price")} value={price.price} onChange={(e) => setPrice({ ...price, price: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <DialogFooter><button onClick={addPrice} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Save")}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AssignmentsTab() {
  const companies = useQuery({ queryKey: ["companies-picker"], queryFn: () => companiesApi.list({ page: 1, pageSize: 100, approvalStatus: "approved" }) });
  const lists = useQuery({ queryKey: ["pricing-lists"], queryFn: catalogApi.listPricingLists });
  const [form, setForm] = useState({ companyId: "", pricingListId: "", effectiveFrom: "", effectiveTo: "" });
  const companyOptions = useMemo(
    () => (companies.data?.items ?? []).map((c) => ({ value: c.id, label: c.legalName, hint: c.tradeName ?? undefined })),
    [companies.data],
  );
  const listOptions = useMemo(
    () => (lists.data ?? []).map((l) => ({ value: l.id, label: l.name, hint: l.currency })),
    [lists.data],
  );
  async function assign() {
    if (!form.companyId || !form.pricingListId) return;
    try {
      await catalogApi.assignToCompany({
        companyId: form.companyId,
        pricingListId: form.pricingListId,
        effectiveFrom: form.effectiveFrom || undefined,
        effectiveTo: form.effectiveTo || undefined,
      });
      toast.success(t("Saved"));
    } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="card-elevated max-w-2xl space-y-3 p-6">
      <div>
        <h3 className="font-semibold">{t("Company Assignments")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("Choose which company can browse this menu.")}</p>
      </div>
      <EntitySelect value={form.companyId} onChange={(companyId) => setForm({ ...form, companyId })} options={companyOptions} placeholder={t("Select company…")} />
      <EntitySelect value={form.pricingListId} onChange={(pricingListId) => setForm({ ...form, pricingListId })} options={listOptions} placeholder={t("Select pricing list…")} />
      <div className="grid grid-cols-2 gap-2">
        <input type="datetime-local" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
        <input type="datetime-local" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
      </div>
      <button onClick={assign} disabled={!form.companyId || !form.pricingListId} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{t("Assign")}</button>
    </div>
  );
}
