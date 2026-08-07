import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, TablePagination, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { EntitySelect } from "@/components/app/EntitySelect";
import { dashboardUsersApi, rolesApi, companiesApi } from "@/services/apiClient";
import type { DashboardUser } from "@/types/api";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { DEPARTMENTS, optionsFrom } from "@/lib/systemOptions";

export const Route = createFileRoute("/dashboard/users")({ component: UsersPage });

function UsersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DashboardUser | null>(null);
  const [form, setForm] = useState({
    fullName: "", email: "", department: "", temporaryPassword: "", roleId: "",
  });
  const roles = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list, enabled: open });

  const query = useQuery({
    queryKey: ["dashboard-users", page],
    queryFn: () => dashboardUsersApi.list({ page, pageSize: 20 }),
  });

  const columns: Column<DashboardUser>[] = [
    { key: "name", header: "User", cell: (r) => (
      <div><div className="font-semibold">{r.fullName}</div><div className="text-xs text-muted-foreground">{r.email}</div></div>
    ) },
    { key: "department", header: "Department", cell: (r) => r.department ?? "—" },
    { key: "roles", header: "Roles", cell: (r) => (
      <div className="flex flex-wrap gap-1">
        {r.roles.length === 0 ? <span className="text-muted-foreground">—</span> :
          r.roles.map((role) => <StatusBadge key={role.id} tone="info">{role.name}</StatusBadge>)}
      </div>
    ) },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  async function invite() {
    if (!form.email || !form.fullName) return;
    if (!form.roleId) { toast.error(t("Choose a role")); return; }
    try {
      await dashboardUsersApi.invite({
        fullName: form.fullName,
        email: form.email,
        department: form.department || undefined,
        temporaryPassword: form.temporaryPassword || undefined,
        roleIds: [form.roleId],
      });
      toast.success(t("Invitation sent"));
      setOpen(false);
      setForm({ fullName: "", email: "", department: "", temporaryPassword: "", roleId: "" });
      qc.invalidateQueries({ queryKey: ["dashboard-users"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <PageHeader
        title={t("Dashboard Users")} description={t("Staff who operate the platform.")}
        actions={<button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-[oklch(0.52_0.19_285)]"><Plus className="h-4 w-4" /> {t("Invite user")}</button>}
      />
      {query.isError ? (
        <EmptyState title={t("Could not load users")} description={(query.error as Error).message} />
      ) : query.data && query.data.totalItems === 0 && !query.isLoading ? (
        <EmptyState title={t("No dashboard users listed")} description={t("Invite your first dashboard user to get started.")} />
      ) : (
        <DataTable columns={columns} rows={query.data?.items} loading={query.isLoading}
          onRowClick={setSelected}
          emptyTitle={t("No dashboard users")} />
      )}
      {query.data && query.data.totalItems > 0 && (
        <TablePagination page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} onPageChange={setPage} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("Invite dashboard user")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">{t("Full name")}</label>
              <input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">{t("Email")}</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">{t("Role")}</label>
              <EntitySelect
                value={form.roleId}
                onChange={(roleId) => setForm((f) => ({ ...f, roleId }))}
                placeholder={t("Select role…")}
                options={(roles.data ?? []).map((r) => ({
                  value: r.id,
                  label: r.name,
                  hint: r.isSystemRole ? t("System") : undefined,
                }))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("Screen access is controlled by the role page permissions.")}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">{t("Department")}</label>
              <EntitySelect
                value={form.department}
                onChange={(department) => setForm((f) => ({ ...f, department }))}
                placeholder={t("Select department…")}
                options={optionsFrom(DEPARTMENTS, t)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">{t("Temporary password (optional)")}</label>
              <input type="password" value={form.temporaryPassword} onChange={(e) => setForm((f) => ({ ...f, temporaryPassword: e.target.value }))}
                className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setOpen(false)} className="rounded-[10px] border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("Cancel")}</button>
            <button onClick={invite} className="rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Send invite")}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {selected && <UserDetail user={selected} onClose={() => setSelected(null)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function UserDetail({ user, onClose }: { user: DashboardUser; onClose: () => void }) {
  const roles = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });
  const companies = useQuery({ queryKey: ["companies-scope"], queryFn: () => companiesApi.list({ pageSize: 100 }) });
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(user.roles.map((r) => r.id));
  const [scopeType, setScopeType] = useState<"all" | "specific">("all");
  const [companyId, setCompanyId] = useState("");

  async function saveRoles() {
    try { await dashboardUsersApi.assignRoles(user.id, selectedRoleIds); toast.success(t("Roles updated")); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function saveScope() {
    try {
      await dashboardUsersApi.setCompanyScope(user.id, {
        scopeType,
        companyIds: scopeType === "specific" && companyId ? [companyId] : undefined,
      });
      toast.success(t("Scope updated"));
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <SheetHeader><SheetTitle>{user.fullName}</SheetTitle></SheetHeader>
      <div className="mt-6 space-y-6 px-4 text-sm">
        <div>
          <div className="mb-2 text-xs uppercase text-muted-foreground">{t("Contact")}</div>
          <div>{user.email}</div>
          <div className="text-xs text-muted-foreground">{user.department ?? t("No department")}</div>
        </div>
        <div>
          <div className="mb-2 text-xs uppercase text-muted-foreground">{t("Roles")}</div>
          <p className="mb-2 text-xs text-muted-foreground">{t("Assign roles to decide which screens this user can open.")}</p>
          {!roles.data ? <span className="text-muted-foreground">{t("Loading…")}</span> : (
            <div className="space-y-1">
              {roles.data.map((r) => (
                <label key={r.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedRoleIds.includes(r.id)}
                    onChange={(e) => setSelectedRoleIds((s) => e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id))} />
                  {r.name}
                </label>
              ))}
            </div>
          )}
          <button onClick={saveRoles} className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">{t("Save roles")}</button>
        </div>
        <div>
          <div className="mb-2 text-xs uppercase text-muted-foreground">{t("Company scope")}</div>
          <select value={scopeType} onChange={(e) => setScopeType(e.target.value as never)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm">
            <option value="all">{t("All companies")}</option>
            <option value="specific">{t("Specific companies")}</option>
          </select>
          {scopeType === "specific" && (
            <div className="mt-2">
              <EntitySelect
                value={companyId}
                onChange={setCompanyId}
                placeholder={t("Select company…")}
                options={(companies.data?.items ?? []).map((c) => ({
                  value: c.id,
                  label: c.tradeName ?? c.legalName,
                }))}
              />
            </div>
          )}
          <button onClick={saveScope} className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">{t("Save scope")}</button>
        </div>
      </div>
    </>
  );
}
