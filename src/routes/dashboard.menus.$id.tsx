import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EntitySelect } from "@/components/app/EntitySelect";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { menusApi, menusExtApi, companiesApi, catalogApi } from "@/services/apiClient";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/menus/$id")({ component: MenuBuilder });

function MenuBuilder() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const menu = useQuery({ queryKey: ["menu", id], queryFn: () => menusApi.get(id) });
  async function del() {
    if (!confirm(t("Delete"))) return;
    try {
      await menusExtApi.remove(id);
      toast.success(t("Deleted"));
      qc.invalidateQueries({ queryKey: ["menus"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  if (menu.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!menu.data) return <div className="py-24 text-center">{t("Page not found")}</div>;

  return (
    <>
      <PageHeader
        title={menu.data.name}
        description={`${menu.data.menuType} menu`}
        breadcrumbs={[
          { label: t("Dashboard"), to: "/dashboard" },
          { label: t("Menus"), to: "/dashboard/menus" },
          { label: menu.data.name },
        ]}
        actions={
          <div className="flex gap-2">
            <button
              onClick={del}
              className="flex items-center gap-2 rounded-[10px] border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> {t("Delete")}
            </button>
            <Link
              to="/dashboard/menus"
              className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" /> {t("Back")}
            </Link>
          </div>
        }
      />
      <Tabs defaultValue="sections">
        <TabsList className="mb-4">
          <TabsTrigger value="sections">{t("Sections")}</TabsTrigger>
          <TabsTrigger value="assignments">{t("Assignments")}</TabsTrigger>
        </TabsList>
        <TabsContent value="sections">
          <SectionsTab menuId={id} />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentsTab menuId={id} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function SectionsTab({ menuId }: { menuId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["menu-sections", menuId],
    queryFn: () => menusApi.listSections(menuId).catch(() => [] as never[]),
  });
  const [name, setName] = useState("");
  async function add() {
    if (!name.trim()) return;
    try {
      await menusApi.createSection(menuId, { name, sortOrder: (data?.length ?? 0) + 1 });
      toast.success(t("Section added"));
      setName("");
      qc.invalidateQueries({ queryKey: ["menu-sections", menuId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function del(sectionId: string) {
    if (!confirm(t("Delete"))) return;
    try {
      await menusExtApi.deleteSection(menuId, sectionId);
      toast.success(t("Deleted"));
      qc.invalidateQueries({ queryKey: ["menu-sections", menuId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="space-y-3">
      <div className="card-elevated flex flex-wrap gap-2 p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("Section name (e.g. Starters)")}
          className="h-10 min-w-[220px] flex-1 rounded-[10px] border border-border bg-card px-3 text-sm"
        />
        <button
          onClick={add}
          className="flex items-center gap-1 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> {t("Add")}
        </button>
      </div>
      {isLoading ? (
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t("No sections yet")} description={t("Add a section to group products.")} />
      ) : (
        <div className="space-y-3">
          {data.map((s) => (
            <SectionCard key={s.id} menuId={menuId} sectionId={s.id} name={s.name} onDelete={() => del(s.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionCard({
  menuId,
  sectionId,
  name,
  onDelete,
}: {
  menuId: string;
  sectionId: string;
  name: string;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const products = useQuery({
    queryKey: ["section-products", menuId, sectionId],
    queryFn: () => menusExtApi.listSectionProducts(menuId, sectionId).catch(() => [] as never[]),
  });
  const catalog = useQuery({
    queryKey: ["products-picker"],
    queryFn: () => catalogApi.listProducts({ page: 1, pageSize: 100 }),
  });
  const [productId, setProductId] = useState("");

  const options = useMemo(
    () =>
      (catalog.data?.items ?? []).map((p) => ({
        value: p.id,
        label: p.name,
        hint: p.sku ?? undefined,
      })),
    [catalog.data],
  );

  async function add() {
    if (!productId) return;
    try {
      await menusApi.addSectionProduct(menuId, sectionId, {
        productId,
        sortOrder: (products.data?.length ?? 0) + 1,
      });
      toast.success(t("Product added"));
      setProductId("");
      qc.invalidateQueries({ queryKey: ["section-products", menuId, sectionId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function rm(pid: string) {
    try {
      await menusExtApi.removeSectionProduct(menuId, sectionId, pid);
      toast.success(t("Removed"));
      qc.invalidateQueries({ queryKey: ["section-products", menuId, sectionId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="card-elevated p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="font-semibold">{name}</h4>
        <button onClick={onDelete} className="text-destructive hover:underline" aria-label={t("Delete")}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="min-w-[240px] flex-1">
          <EntitySelect
            value={productId}
            onChange={setProductId}
            options={options}
            placeholder={t("Select product…")}
            disabled={catalog.isLoading}
          />
        </div>
        <button
          onClick={add}
          disabled={!productId}
          className="rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {t("Add product")}
        </button>
      </div>
      {!products.data || products.data.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("No products yet")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {products.data.map((sp) => (
            <li key={`${sp.productId}-${sp.sortOrder}`} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {(sp as { product?: { name?: string } }).product?.name ?? sp.productId}
                </div>
                {(sp as { product?: { sku?: string | null } }).product?.sku && (
                  <div className="text-xs text-muted-foreground">
                    SKU {(sp as { product?: { sku?: string | null } }).product?.sku}
                  </div>
                )}
              </div>
              <button onClick={() => rm(sp.productId)} className="shrink-0 text-xs text-destructive hover:underline">
                {t("Remove")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AssignmentsTab({ menuId }: { menuId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["menu-assignments", menuId],
    queryFn: () => menusExtApi.listAssignments(menuId).catch(() => [] as never[]),
  });
  const companies = useQuery({
    queryKey: ["companies-picker"],
    queryFn: () => companiesApi.list({ page: 1, pageSize: 100, approvalStatus: "approved" }),
  });
  const [companyId, setCompanyId] = useState("");
  const [priority, setPriority] = useState(10);

  const companyOptions = useMemo(
    () =>
      (companies.data?.items ?? []).map((c) => ({
        value: c.id,
        label: c.legalName,
        hint: c.tradeName ?? undefined,
      })),
    [companies.data],
  );

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of companies.data?.items ?? []) map.set(c.id, c.legalName);
    return map;
  }, [companies.data]);

  async function add() {
    if (!companyId) {
      toast.error(t("Select company…"));
      return;
    }
    try {
      await menusApi.createAssignment(menuId, {
        scopeType: "company",
        scopeId: companyId,
        priority,
      });
      toast.success(t("Menu assigned"));
      setCompanyId("");
      qc.invalidateQueries({ queryKey: ["menu-assignments", menuId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function del(assignmentId: string) {
    try {
      await menusExtApi.deleteAssignment(menuId, assignmentId);
      toast.success(t("Removed"));
      qc.invalidateQueries({ queryKey: ["menu-assignments", menuId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="card-elevated space-y-3 p-5">
        <div>
          <h3 className="text-base font-semibold">{t("Assign menu to company")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Choose which company can browse this menu.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="min-w-[260px] flex-1">
            <EntitySelect
              value={companyId}
              onChange={setCompanyId}
              options={companyOptions}
              placeholder={t("Select company…")}
              disabled={companies.isLoading}
            />
          </div>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(+e.target.value)}
            title={t("Priority")}
            className="h-10 w-24 rounded-[10px] border border-border bg-card px-3 text-sm"
          />
          <button
            onClick={add}
            disabled={!companyId}
            className="rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t("Assign")}
          </button>
        </div>
      </div>

      {isLoading ? (
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t("No assignments")} description={t("Choose which company can browse this menu.")} />
      ) : (
        <div className="card-elevated divide-y divide-border">
          {data.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="info">{a.scopeType}</StatusBadge>
                  <span className="font-semibold">
                    {a.scopeId ? companyNameById.get(a.scopeId) ?? a.scopeId : "*"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t("Priority")} {a.priority}
                </div>
              </div>
              <button onClick={() => del(a.id)} className="text-destructive hover:underline" aria-label={t("Remove")}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
