import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, TablePagination, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { catalogApi } from "@/services/apiClient";
import type { Category, Product, PricingList } from "@/types/api";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/catalog")({ component: CatalogPage });

function CatalogPage() {
  return (
    <>
      <PageHeader title="Catalog (PIM)" description="Products, categories, pricing lists and company assignments." />
      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="pricing">Pricing Lists</TabsTrigger>
          <TabsTrigger value="assignments">Company Assignments</TabsTrigger>
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
    try { await catalogApi.createCategory({ ...form, isActive: true }); toast.success("Created"); setOpen(false); setForm({ name: "", slug: "", sortOrder: 0 }); qc.invalidateQueries({ queryKey: ["categories"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  const cols: Column<Category>[] = [
    { key: "name", header: "Category", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "slug", header: "Slug", cell: (r) => <code className="text-xs">{r.slug}</code> },
    { key: "parent", header: "Parent", cell: (r) => r.parentCategoryId ?? "—" },
    { key: "sort", header: "Order", cell: (r) => r.sortOrder },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
  ];
  return (
    <>
      <div className="mb-3 flex justify-end">
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New category</button>
      </div>
      <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No categories" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create category</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input type="number" placeholder="Sort order" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: +e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create</button></DialogFooter>
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
  const [form, setForm] = useState({ name: "", categoryId: "", basePrice: "0", currency: "USD" });
  const query = useQuery({ queryKey: ["products", page], queryFn: () => catalogApi.listProducts({ page, pageSize: 20 }) });
  async function create() {
    if (!form.name || !form.categoryId) return;
    try { await catalogApi.createProduct({ ...form, isActive: true, visibility: "public" as never }); toast.success("Created"); setOpen(false); qc.invalidateQueries({ queryKey: ["products"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  const cols: Column<Product>[] = [
    { key: "name", header: "Product", cell: (r) => (
      <div><div className="font-semibold">{r.name}</div>{r.sku && <div className="text-xs text-muted-foreground">SKU {r.sku}</div>}</div>
    ) },
    { key: "price", header: "Base price", cell: (r) => `${r.basePrice} ${r.currency}` },
    { key: "visibility", header: "Visibility", cell: (r) => <StatusBadge tone="info">{r.visibility}</StatusBadge> },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
  ];
  return (
    <>
      <div className="mb-3 flex justify-end">
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New product</button>
      </div>
      <DataTable columns={cols} rows={query.data?.items} loading={query.isLoading}
        onRowClick={(r) => navigate({ to: "/dashboard/catalog/products/$id", params: { id: r.id } })}
        emptyTitle="No products yet" />
      {query.data && query.data.totalItems > 0 && (
        <TablePagination page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} onPageChange={setPage} />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create product</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Category ID" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Base price" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PricingTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["pricing-lists"], queryFn: catalogApi.listPricingLists });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", currency: "USD" });
  const [priceOpen, setPriceOpen] = useState(false);
  const [price, setPrice] = useState({ pricingListId: "", productId: "", price: "0" });
  async function create() {
    try { await catalogApi.createPricingList({ ...form, isActive: true }); toast.success("Created"); setOpen(false); qc.invalidateQueries({ queryKey: ["pricing-lists"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function addPrice() {
    try { await catalogApi.createPrice(price); toast.success("Price added"); setPriceOpen(false); }
    catch (e) { toast.error((e as Error).message); }
  }
  const cols: Column<PricingList>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "currency", header: "Currency", cell: (r) => r.currency },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
  ];
  return (
    <>
      <div className="mb-3 flex justify-end gap-2">
        <button onClick={() => setPriceOpen(true)} className="rounded-[10px] border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Add price</button>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New list</button>
      </div>
      <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No pricing lists" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>Create pricing list</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create</button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={priceOpen} onOpenChange={setPriceOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add price</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder="Pricing list ID" value={price.pricingListId} onChange={(e) => setPrice({ ...price, pricingListId: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Product ID" value={price.productId} onChange={(e) => setPrice({ ...price, productId: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Price" value={price.price} onChange={(e) => setPrice({ ...price, price: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <DialogFooter><button onClick={addPrice} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AssignmentsTab() {
  const [form, setForm] = useState({ companyId: "", pricingListId: "", effectiveFrom: "", effectiveTo: "" });
  async function assign() {
    if (!form.companyId || !form.pricingListId) return;
    try { await catalogApi.assignToCompany({ companyId: form.companyId, pricingListId: form.pricingListId, effectiveFrom: form.effectiveFrom || undefined, effectiveTo: form.effectiveTo || undefined }); toast.success("Assigned"); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="card-elevated max-w-2xl space-y-3 p-6">
      <p className="text-sm text-muted-foreground">Assign a pricing list to a company with effective dates.</p>
      <input placeholder="Company ID" value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
      <input placeholder="Pricing list ID" value={form.pricingListId} onChange={(e) => setForm({ ...form, pricingListId: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <input type="datetime-local" placeholder="From" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
        <input type="datetime-local" placeholder="To" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
      </div>
      <button onClick={assign} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Assign</button>
    </div>
  );
}
