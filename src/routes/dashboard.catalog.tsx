import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, TablePagination, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { catalogApi } from "@/services/apiClient";
import type { Category, Product, PricingList } from "@/types/api";

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
        <TabsContent value="assignments">
          <div className="card-elevated p-8 text-sm text-muted-foreground">
            Assign pricing lists to companies via <code>POST /api/v1/dashboard/catalog/company-assignment</code>. Interface will populate once assignments exist.
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function CategoriesTab() {
  const { data, isLoading } = useQuery({ queryKey: ["categories"], queryFn: catalogApi.listCategories });
  const cols: Column<Category>[] = [
    { key: "name", header: "Category", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "slug", header: "Slug", cell: (r) => <code className="text-xs">{r.slug}</code> },
    { key: "parent", header: "Parent", cell: (r) => r.parentCategoryId ?? "—" },
    { key: "sort", header: "Order", cell: (r) => r.sortOrder },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
  ];
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No categories" />;
}

function ProductsTab() {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["products", page], queryFn: () => catalogApi.listProducts({ page, pageSize: 20 }) });
  const cols: Column<Product>[] = [
    { key: "name", header: "Product", cell: (r) => (
      <div>
        <div className="font-semibold">{r.name}</div>
        {r.sku && <div className="text-xs text-muted-foreground">SKU {r.sku}</div>}
      </div>
    ) },
    { key: "price", header: "Base price", cell: (r) => `${r.basePrice} ${r.currency}` },
    { key: "visibility", header: "Visibility", cell: (r) => <StatusBadge tone="info">{r.visibility}</StatusBadge> },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
  ];
  return (
    <>
      <DataTable columns={cols} rows={query.data?.items} loading={query.isLoading} emptyTitle="No products yet" />
      {query.data && query.data.totalItems > 0 && (
        <TablePagination page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} onPageChange={setPage} />
      )}
    </>
  );
}

function PricingTab() {
  const { data, isLoading } = useQuery({ queryKey: ["pricing-lists"], queryFn: catalogApi.listPricingLists });
  const cols: Column<PricingList>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "currency", header: "Currency", cell: (r) => r.currency },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
  ];
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No pricing lists" />;
}
