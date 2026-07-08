import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { menusApi } from "@/services/apiClient";
import type { Menu } from "@/types/api";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/menus/")({ component: MenusPage });

function MenusPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["menus"], queryFn: menusApi.list });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", menuType: "standard" });
  async function create() {
    if (!form.name) return;
    try { await menusApi.create({ ...form, isActive: true }); toast.success("Menu created"); setOpen(false); qc.invalidateQueries({ queryKey: ["menus"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  const cols: Column<Menu>[] = [
    { key: "name", header: "Menu", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "type", header: "Type", cell: (r) => <StatusBadge tone="info">{r.menuType}</StatusBadge> },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
  ];
  return (
    <>
      <PageHeader title={t("Menus")} description={t("Group products into menus and assign to companies.")}
        actions={<button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New menu</button>} />
      <DataTable columns={cols} rows={data} loading={isLoading}
        onRowClick={(r) => navigate({ to: "/dashboard/menus/$id", params: { id: r.id } })}
        emptyTitle={t("No menus yet")} emptyDescription={t("Create a menu to bundle products for corporate clients.")} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("Create menu")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder={t("Name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <select value={form.menuType} onChange={(e) => setForm({ ...form, menuType: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm">
              <option value="standard">standard</option><option value="corporate">corporate</option><option value="event">event</option>
            </select>
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Create")}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
