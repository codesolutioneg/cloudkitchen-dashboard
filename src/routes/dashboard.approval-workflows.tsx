import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { approvalWorkflowsApi } from "@/services/apiClient";
import type { ApprovalWorkflow, ApprovalRequest } from "@/types/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/approval-workflows")({ component: ApprovalPage });

function ApprovalPage() {
  return (
    <>
      <PageHeader title="Approval Workflows" description="Multi-step approval templates and pending requests." />
      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="requests"><RequestsTab /></TabsContent>
      </Tabs>
    </>
  );
}

function TemplatesTab() {
  const { data, isLoading } = useQuery({ queryKey: ["approval-workflows"], queryFn: approvalWorkflowsApi.list });
  const cols: Column<ApprovalWorkflow>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "entity", header: "Entity", cell: (r) => <StatusBadge tone="info">{r.entityType}</StatusBadge> },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
  ];
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No approval workflows" />;
}
function RequestsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["approval-requests"], queryFn: approvalWorkflowsApi.listRequests });
  async function decide(id: string, decision: "approved" | "rejected") {
    const comment = decision === "rejected" ? (prompt("Rejection comment (optional):") ?? undefined) : undefined;
    try { await approvalWorkflowsApi.decide(id, { decision, comment }); toast.success(`Request ${decision}`); qc.invalidateQueries({ queryKey: ["approval-requests"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  const cols: Column<ApprovalRequest>[] = [
    { key: "entity", header: "Entity", cell: (r) => `${r.entityType} · ${r.entityId.slice(0, 8)}…` },
    { key: "step", header: "Current step", cell: (r) => r.currentStepOrder },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "actions", header: "", cell: (r) => (
      <div className="flex justify-end gap-1">
        <button onClick={() => decide(r.id, "approved")} className="rounded-md bg-success px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90">Approve</button>
        <button onClick={() => decide(r.id, "rejected")} className="rounded-md bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground hover:opacity-90">Reject</button>
      </div>
    ), className: "text-right" },
  ];
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No pending requests" />;
}
