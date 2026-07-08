import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { rolesApi } from "@/services/apiClient";
import type { Role } from "@/types/api";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/roles/")({ component: RolesPage });

function RolesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });

  async function create() {
    if (!name.trim()) return;
    try {
      await rolesApi.create({ name, description: description || undefined });
      toast.success("Role created");
      setOpen(false); setName(""); setDescription("");
      qc.invalidateQueries({ queryKey: ["roles"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  const columns: Column<Role>[] = [
    { key: "name", header: "Role", cell: (r) => (
      <div><div className="font-semibold">{r.name}</div>{r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}</div>
    ) },
    { key: "scope", header: "Scope", cell: (r) => <StatusBadge tone="info">{r.scope}</StatusBadge> },
    { key: "system", header: "Type", cell: (r) => (r.isSystemRole ? <StatusBadge tone="warning">System</StatusBadge> : <StatusBadge tone="muted">Custom</StatusBadge>) },
  ];

  return (
    <>
      <PageHeader
        title={t("Roles & Permissions")} description={t("Define what dashboard users can access.")}
        actions={<button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-[oklch(0.52_0.19_285)]">
          <Plus className="h-4 w-4" /> {t("New role")}
        </button>}
      />
      <DataTable columns={columns} rows={data} loading={isLoading}
        onRowClick={(r) => navigate({ to: "/dashboard/roles/$id", params: { id: r.id } })}
        emptyTitle={t("No roles defined")} emptyDescription={t("Create your first role to control dashboard access.")} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("Create role")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="mb-1 block text-sm font-semibold">Name</label><input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm" placeholder={t("e.g. Kitchen Manager")} /></div>
            <div><label className="mb-1 block text-sm font-semibold">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[80px] w-full rounded-[10px] border border-border bg-card px-3 py-2 text-sm" /></div>
          </div>
          <DialogFooter>
            <button onClick={() => setOpen(false)} className="rounded-[10px] border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("Cancel")}</button>
            <button onClick={create} className="rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-[oklch(0.52_0.19_285)]">{t("Create")}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
