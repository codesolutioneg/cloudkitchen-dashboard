import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, TablePagination, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { dashboardUsersApi } from "@/services/apiClient";
import type { DashboardUser } from "@/types/api";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/users")({
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", department: "", temporaryPassword: "" });

  const query = useQuery({
    queryKey: ["dashboard-users", page],
    queryFn: () => dashboardUsersApi.list({ page, pageSize: 20 }),
  });

  const columns: Column<DashboardUser>[] = [
    { key: "name", header: "User", cell: (r) => (
      <div>
        <div className="font-semibold">{r.fullName}</div>
        <div className="text-xs text-muted-foreground">{r.email}</div>
      </div>
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
    try {
      await dashboardUsersApi.invite({
        fullName: form.fullName, email: form.email,
        department: form.department || undefined,
        temporaryPassword: form.temporaryPassword || undefined,
      });
      toast.success("Invitation sent");
      setOpen(false); setForm({ fullName: "", email: "", department: "", temporaryPassword: "" });
      qc.invalidateQueries({ queryKey: ["dashboard-users"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <PageHeader
        title="Dashboard Users"
        description="Staff who operate the platform."
        actions={
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-[oklch(0.52_0.19_285)]">
            <Plus className="h-4 w-4" /> Invite user
          </button>
        }
      />
      <DataTable columns={columns} rows={query.data?.items} loading={query.isLoading}
        emptyTitle="No dashboard users" emptyDescription="Invite your first admin to get started." />
      {query.data && query.data.totalItems > 0 && (
        <TablePagination page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} onPageChange={setPage} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite dashboard user</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {(["fullName", "email", "department", "temporaryPassword"] as const).map((k) => (
              <div key={k}>
                <label className="mb-1 block text-sm font-semibold capitalize">
                  {k === "fullName" ? "Full name" : k === "temporaryPassword" ? "Temporary password (optional)" : k}
                </label>
                <input
                  type={k === "temporaryPassword" ? "password" : k === "email" ? "email" : "text"}
                  value={form[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <button onClick={() => setOpen(false)} className="rounded-[10px] border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
            <button onClick={invite} className="rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-[oklch(0.52_0.19_285)]">Send invite</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
