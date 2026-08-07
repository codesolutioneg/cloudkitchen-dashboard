import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { approvalWorkflowsApi } from "@/services/apiClient";
import type { ApprovalWorkflow, ApprovalRequest } from "@/types/api";
import { Eye, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EntitySelect } from "@/components/app/EntitySelect";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { APPROVAL_ENTITY_TYPES, optionsFrom } from "@/lib/systemOptions";

export const Route = createFileRoute("/dashboard/approval-workflows/")({ component: ApprovalPage });

function cleanWorkflowName(name: string) {
  return name.replace(/\s+\d{10,}$/, "").trim();
}

function entityTypeLabel(entityType: string) {
  const key = `approvalEntity.${entityType}`;
  const translated = t(key);
  return translated !== key ? translated : entityType;
}

function ApprovalPage() {
  return (
    <>
      <PageHeader title={t("Approval Workflows")} description={t("Multi-step approval templates and pending requests.")} />
      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="templates">{t("Templates")}</TabsTrigger>
          <TabsTrigger value="requests">{t("Requests")}</TabsTrigger>
        </TabsList>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="requests"><RequestsTab /></TabsContent>
      </Tabs>
    </>
  );
}

function TemplatesTab() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["approval-workflows"], queryFn: approvalWorkflowsApi.list });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", entityType: "order" });

  async function create() {
    if (!form.name.trim()) return;
    try {
      await approvalWorkflowsApi.create({ ...form, name: form.name.trim(), isActive: true });
      toast.success(t("Created"));
      setOpen(false);
      setForm({ name: "", entityType: "order" });
      qc.invalidateQueries({ queryKey: ["approval-workflows"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const cols: Column<ApprovalWorkflow>[] = [
    {
      key: "name",
      header: "Name",
      cell: (r) => <span className="font-semibold">{cleanWorkflowName(r.name)}</span>,
    },
    {
      key: "entity",
      header: "Entity",
      cell: (r) => <StatusBadge tone="info">{entityTypeLabel(r.entityType)}</StatusBadge>,
    },
    {
      key: "steps",
      header: "Steps",
      cell: (r) => <span className="text-muted-foreground">{r.stepCount ?? 0}</span>,
    },
    {
      key: "active",
      header: "Status",
      cell: (r) => (
        <StatusBadge tone={r.isActive ? "success" : "muted"}>
          {r.isActive ? t("Active") : t("Inactive")}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <Link
          to="/dashboard/approval-workflows/$id"
          params={{ id: r.id }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <Eye className="h-3.5 w-3.5" />
          {t("Open")}
        </Link>
      ),
      className: "text-right",
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> {t("New template")}
        </button>
      </div>
      <DataTable
        columns={cols}
        rows={data}
        loading={isLoading}
        onRowClick={(r) => navigate({ to: "/dashboard/approval-workflows/$id", params: { id: r.id } })}
        emptyTitle={t("No approval workflows")}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Create approval workflow")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <input
              placeholder={t("Name")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
            />
            <EntitySelect
              value={form.entityType}
              onChange={(entityType) => setForm({ ...form, entityType })}
              options={optionsFrom(APPROVAL_ENTITY_TYPES, t)}
              placeholder={t("Entity type")}
            />
          </div>
          <DialogFooter>
            <button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              {t("Create")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RequestsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["approval-requests"], queryFn: approvalWorkflowsApi.listRequests });
  async function decide(id: string, decision: "approved" | "rejected") {
    const comment = decision === "rejected" ? (prompt("Rejection comment (optional):") ?? undefined) : undefined;
    try {
      await approvalWorkflowsApi.decide(id, { decision, comment });
      toast.success(decision === "approved" ? t("Approved") : t("Rejected"));
      qc.invalidateQueries({ queryKey: ["approval-requests"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const cols: Column<ApprovalRequest>[] = [
    {
      key: "entity",
      header: "Entity",
      cell: (r) => <span>{entityTypeLabel(r.entityType)}</span>,
    },
    { key: "step", header: "Current step", cell: (r) => r.currentStepOrder },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void decide(r.id, "approved");
            }}
            className="rounded-md bg-success px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
          >
            {t("Approve")}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void decide(r.id, "rejected");
            }}
            className="rounded-md bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground hover:opacity-90"
          >
            {t("Reject")}
          </button>
        </div>
      ),
      className: "text-right",
    },
  ];
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle={t("No pending requests")} />;
}
