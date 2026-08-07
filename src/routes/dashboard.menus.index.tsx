import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { menusApi } from "@/services/apiClient";
import type { Menu } from "@/types/api";
import { Plus, Star, Users, UtensilsCrossed } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EntitySelect } from "@/components/app/EntitySelect";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { MENU_TYPES, optionsFrom } from "@/lib/systemOptions";

export const Route = createFileRoute("/dashboard/menus/")({ component: MenusPage });

function MenusPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["menus"], queryFn: menusApi.list });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", menuType: "general" });

  const generalMenu = data?.find((m) => m.menuType === "general");

  async function create() {
    if (!form.name) return;
    try {
      await menusApi.create({ ...form, isActive: true });
      toast.success(t("Menu created"));
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["menus"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function setGeneral(menu: Menu) {
    try {
      await menusApi.setGeneral(menu.id);
      toast.success(t("This is now the general menu"));
      qc.invalidateQueries({ queryKey: ["menus"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title={t("Menus")}
        description={t("Simple: pick one general menu, then give it to each company.")}
        actions={
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> {t("New menu")}
          </button>
        }
      />

      <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <h3 className="font-bold text-primary">{t("How menus work")}</h3>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li><strong className="text-foreground">1.</strong> {t("Catalog holds all products (items).")}</li>
          <li><strong className="text-foreground">2.</strong> {t("A menu groups products into sections for companies.")}</li>
          <li><strong className="text-foreground">3.</strong> {t("Set one menu as General — the main company menu.")}</li>
          <li><strong className="text-foreground">4.</strong> {t("Assign that menu to each company so they can order.")}</li>
        </ol>
      </div>

      {generalMenu && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm">
          <Star className="h-4 w-4 text-success" />
          <span>
            {t("Current general menu")}: <strong>{generalMenu.name}</strong>
          </span>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">{t("Loading…")}</p>
      ) : !data || data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {t("No menus yet")}. {t("Create a menu to bundle products for corporate clients.")}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((menu) => (
            <div key={menu.id} className="card-elevated flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">{menu.name}</h3>
                </div>
                {menu.menuType === "general" ? (
                  <StatusBadge tone="success">{t("General menu")}</StatusBadge>
                ) : (
                  <StatusBadge tone="info">{menu.menuType}</StatusBadge>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {menu.isActive ? t("Active") : t("Inactive")}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {menu.menuType !== "general" && (
                  <button
                    type="button"
                    onClick={() => void setGeneral(menu)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-primary bg-primary/5 px-3 py-2.5 text-sm font-bold text-primary hover:bg-primary/10"
                  >
                    <Star className="h-4 w-4" />
                    {t("Set as general menu")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate({ to: "/dashboard/menus/$id", params: { id: menu.id }, search: { tab: "assignments" } })}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground"
                >
                  <Users className="h-4 w-4" />
                  {t("Give to companies")}
                </button>
                <Link
                  to="/dashboard/menus/$id"
                  params={{ id: menu.id }}
                  search={{ tab: "sections" }}
                  className="text-center text-sm font-semibold text-muted-foreground hover:text-primary hover:underline"
                >
                  {t("Edit sections & products")} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Create menu")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <input
              placeholder={t("Name")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
            />
            <EntitySelect
              value={form.menuType}
              onChange={(menuType) => setForm({ ...form, menuType })}
              options={optionsFrom(MENU_TYPES, t)}
              placeholder={t("Menu type")}
            />
          </div>
          <DialogFooter>
            <button onClick={() => void create()} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              {t("Create")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
