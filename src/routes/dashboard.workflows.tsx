import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { workflowsApi } from "@/services/apiClient";
import type { Workflow, WorkflowInstance } from "@/types/api";

export const Route = createFileRoute("/dashboard/workflows")({ component: WorkflowsPage });

const ORDER_STEPS = [
  "submitted", "pending_approval", "kitchen_accepted", "preparing",
  "ready", "out_for_delivery", "delivered",
];

function WorkflowsPage() {
  return (
    <>
      <PageHeader title="Workflows" description="Design order workflows, steps, transitions and monitor instances." />
      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="instances">Instances</TabsTrigger>
          <TabsTrigger value="reference">Standard Order Flow</TabsTrigger>
        </TabsList>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="instances"><InstancesTab /></TabsContent>
        <TabsContent value="reference"><ReferenceFlow /></TabsContent>
      </Tabs>
    </>
  );
}
function TemplatesTab() {
  const { data, isLoading } = useQuery({ queryKey: ["workflows"], queryFn: () => workflowsApi.list({ workflowType: "order" }) });
  const cols: Column<Workflow>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "type", header: "Type", cell: (r) => <StatusBadge tone="info">{r.workflowType}</StatusBadge> },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
  ];
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No workflow templates" />;
}
function InstancesTab() {
  const { data, isLoading } = useQuery({ queryKey: ["workflow-instances"], queryFn: workflowsApi.listInstances });
  const cols: Column<WorkflowInstance>[] = [
    { key: "entity", header: "Entity", cell: (r) => `${r.entityType} · ${r.entityId.slice(0, 8)}…` },
    { key: "step", header: "Current step", cell: (r) => <StatusBadge status={r.currentStepCode} /> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  ];
  return <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No workflow instances" />;
}
function ReferenceFlow() {
  return (
    <div className="card-elevated p-6">
      <p className="mb-4 text-sm text-muted-foreground">Reference order lifecycle:</p>
      <div className="flex flex-wrap items-center gap-2">
        {ORDER_STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <StatusBadge status={s} />
            {i < ORDER_STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Alternate paths: <code>awaiting_pickup → picked_up</code> for pickup orders, <code>cancelled</code> from any step.</p>
    </div>
  );
}
