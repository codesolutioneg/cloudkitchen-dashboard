import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  costingApi,
  type Ingredient,
  type ProductCostRow,
  type Recipe,
} from "@/services/apiClient";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/costing")({ component: CostingPage });

const COST_STATUS_TONE: Record<string, "success" | "warning" | "muted" | "info"> = {
  ok: "success",
  manual_override: "info",
  no_recipe: "muted",
  missing_ingredient: "warning",
  depth_exceeded: "warning",
  currency_conflict: "warning",
};

function CostingPage() {
  return (
    <>
      <PageHeader
        title={t("Costing")}
        description={t("Ingredient prices, recipes, and the margin on every dish.")}
      />
      <Tabs defaultValue="margin">
        <TabsList className="mb-4">
          <TabsTrigger value="margin">{t("Margin")}</TabsTrigger>
          <TabsTrigger value="ingredients">{t("Ingredients")}</TabsTrigger>
          <TabsTrigger value="recipes">{t("Recipes")}</TabsTrigger>
        </TabsList>
        <TabsContent value="margin">
          <MarginTab />
        </TabsContent>
        <TabsContent value="ingredients">
          <IngredientsTab />
        </TabsContent>
        <TabsContent value="recipes">
          <RecipesTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

function MarginTab() {
  const qc = useQueryClient();
  const summary = useQuery({ queryKey: ["costing-summary"], queryFn: costingApi.summary });
  const costs = useQuery({
    queryKey: ["product-costs"],
    queryFn: () => costingApi.listProductCosts({ page: 1, pageSize: 200 }),
  });

  const recost = useMutation({
    mutationFn: costingApi.recostAll,
    onSuccess: (r) => {
      toast.success(`${t("Recosted")} ${r.updated}`);
      qc.invalidateQueries({ queryKey: ["product-costs"] });
      qc.invalidateQueries({ queryKey: ["costing-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cols: Column<ProductCostRow>[] = [
    {
      key: "product",
      header: t("Product"),
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-semibold">{r.productName}</div>
          {r.variantName && <div className="text-xs text-muted-foreground">{r.variantName}</div>}
        </div>
      ),
    },
    { key: "cost", header: t("Food cost"), cell: (r) => `${r.foodCost} ${r.currency}` },
    { key: "total", header: t("Total cost"), cell: (r) => <b>{r.totalCost}</b> },
    { key: "price", header: t("Selling price"), cell: (r) => r.sellingPrice ?? "-" },
    {
      key: "margin",
      header: t("Margin"),
      cell: (r) =>
        !r.isCosted || r.marginPercent === null ? (
          <span className="text-xs text-muted-foreground">{t("Unknown")}</span>
        ) : (
          <span
            className={
              Number(r.marginPercent) < 20
                ? "font-bold text-destructive"
                : "font-bold text-foreground"
            }
          >
            {Number(r.marginPercent).toFixed(1)}%
          </span>
        ),
    },
    {
      key: "status",
      header: t("Status"),
      cell: (r) => (
        <StatusBadge tone={COST_STATUS_TONE[r.costStatus] ?? "muted"}>
          {t(r.costStatus)}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {summary.data && (
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              <span className="text-muted-foreground">{t("Costed")}: </span>
              <b>
                {summary.data.costedProducts} / {summary.data.sellableProducts}
              </b>
            </span>
            <span>
              <span className="text-muted-foreground">{t("Coverage")}: </span>
              <b className={Number(summary.data.coveragePercent) < 50 ? "text-destructive" : ""}>
                {summary.data.coveragePercent}%
              </b>
            </span>
          </div>
        )}
        <button
          onClick={() => recost.mutate()}
          disabled={recost.isPending}
          className="inline-flex items-center gap-2 rounded-[10px] border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          {recost.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {t("Recost all")}
        </button>
      </div>

      {summary.data && Number(summary.data.coveragePercent) < 100 && (
        <p className="rounded-[10px] border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          {t(
            "Products without a costed recipe show no margin. That is deliberate: a zero cost would read as pure profit.",
          )}
        </p>
      )}

      <DataTable
        columns={cols}
        rows={costs.data?.items.map((r) => ({ ...r, id: `${r.productId}:${r.variantName ?? ""}` }))}
        loading={costs.isLoading}
        emptyTitle={t("No costed products yet")}
        emptyDescription={t("Add ingredients and a recipe, then activate the recipe.")}
      />
    </div>
  );
}

const DIMENSION_UNITS: Record<string, string[]> = {
  mass: ["g", "kg", "mg"],
  volume: ["ml", "l", "cl"],
  count: ["pc", "dozen"],
};

function IngredientsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    dimension: "mass",
    purchasePrice: "",
    purchaseQty: "",
    purchaseUom: "kg",
    currency: "EGP",
    yieldPercent: "100",
  });

  const q = useQuery({
    queryKey: ["ingredients", search],
    queryFn: () =>
      costingApi.listIngredients({ search: search || undefined, page: 1, pageSize: 200 }),
  });

  const create = useMutation({
    mutationFn: () => costingApi.createIngredient(form),
    onSuccess: () => {
      toast.success(t("Ingredient added"));
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["ingredients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cols: Column<Ingredient>[] = [
    {
      key: "name",
      header: t("Ingredient"),
      cell: (r) => <span className="font-semibold">{r.name}</span>,
    },
    {
      key: "pack",
      header: t("Purchase"),
      cell: (r) => `${r.purchasePrice} ${r.currency} / ${r.purchaseQty} ${r.purchaseUom}`,
    },
    { key: "yield", header: t("Yield"), cell: (r) => `${Number(r.yieldPercent).toFixed(0)}%` },
    {
      key: "rate",
      header: t("Cost per unit"),
      cell: (r) => (
        <span className="font-mono text-xs">
          {Number(r.costPerBaseUnit).toFixed(5)} / {r.baseUom}
        </span>
      ),
    },
    { key: "supplier", header: t("Supplier"), cell: (r) => r.supplierName ?? "-" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Search ingredients…")}
          className="h-10 min-w-[220px] flex-1 rounded-[10px] border border-border bg-card px-3 text-sm"
        />
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> {t("New ingredient")}
        </button>
      </div>

      <DataTable
        columns={cols}
        rows={q.data?.items}
        loading={q.isLoading}
        emptyTitle={t("No ingredients yet")}
        emptyDescription={t("Add the raw materials the kitchen buys.")}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("New ingredient")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              placeholder={t("Name")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={form.dimension}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dimension: e.target.value,
                    purchaseUom: DIMENSION_UNITS[e.target.value]![0]!,
                  })
                }
                className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm"
              >
                {Object.keys(DIMENSION_UNITS).map((d) => (
                  <option key={d} value={d}>
                    {t(d)}
                  </option>
                ))}
              </select>
              <select
                value={form.purchaseUom}
                onChange={(e) => setForm({ ...form, purchaseUom: e.target.value })}
                className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm"
              >
                {(DIMENSION_UNITS[form.dimension] ?? []).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder={t("Purchase price")}
                value={form.purchasePrice}
                onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm"
              />
              <input
                placeholder={t("Pack size")}
                value={form.purchaseQty}
                onChange={(e) => setForm({ ...form, purchaseQty: e.target.value })}
                className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm"
              />
            </div>
            <label className="block text-xs text-muted-foreground">
              {t("Usable percent after trim")}
              <input
                value={form.yieldPercent}
                onChange={(e) => setForm({ ...form, yieldPercent: e.target.value })}
                className="mt-1 h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
              />
            </label>
          </div>
          <DialogFooter>
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending || !form.name || !form.purchasePrice || !form.purchaseQty}
              className="rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {t("Create")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecipesTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["recipes"], queryFn: () => costingApi.listRecipes({}) });

  const activate = useMutation({
    mutationFn: (id: string) => costingApi.setRecipeStatus(id, "active"),
    onSuccess: () => {
      toast.success(t("Recipe activated"));
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["product-costs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cols: Column<Recipe>[] = [
    {
      key: "name",
      header: t("Recipe"),
      cell: (r) => <span className="font-semibold">{r.name}</span>,
    },
    {
      key: "type",
      header: t("Type"),
      cell: (r) => <StatusBadge tone="info">{t(r.recipeType)}</StatusBadge>,
    },
    { key: "product", header: t("Product"), cell: (r) => r.productName ?? "-" },
    { key: "yield", header: t("Yield"), cell: (r) => `${r.yieldQty} ${r.yieldUom}` },
    { key: "lines", header: t("Lines"), cell: (r) => r.lines.length },
    {
      key: "cost",
      header: t("Recipe cost"),
      cell: (r) => {
        const total = r.lines.reduce((sum, l) => sum + Number(l.lineCost ?? 0), 0);
        return <b>{total.toFixed(2)}</b>;
      },
    },
    {
      key: "status",
      header: t("Status"),
      cell: (r) => (
        <div className="flex items-center gap-2">
          <StatusBadge tone={r.status === "active" ? "success" : "muted"}>
            {t(r.status)}
          </StatusBadge>
          {r.status !== "active" && (
            <button
              onClick={() => activate.mutate(r.id)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {t("Activate")}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={cols}
      rows={q.data}
      loading={q.isLoading}
      emptyTitle={t("No recipes yet")}
      emptyDescription={t("A recipe turns ingredients into a costed menu item.")}
    />
  );
}
