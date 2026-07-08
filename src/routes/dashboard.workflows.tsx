import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { workflowsApi } from "@/services/apiClient";
import type { Workflow, WorkflowInstance } from "@/types/api";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/workflows")({ component: WorkflowsPage });

const ORDER_STEPS = [
  "submitted", "pending_approval", "kitchen_accepted", "preparing",
  "ready", "out_for_delivery", "delivered",
];
const PICKUP_STEPS = ["ready", "awaiting_pickup", "picked_up"];

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
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["workflows"], queryFn: () => workflowsApi.list({ workflowType: "order" }) });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", workflowType: "order" });
  async function create() {
    if (!form.code || !form.name) return;
    try { await workflowsApi.create({ ...form, isActive: true }); toast.success("Workflow created"); setOpen(false); qc.invalidateQueries({ queryKey: ["workflows"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  const cols: Column<Workflow>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "type", header: "Type", cell: (r) => <StatusBadge tone="info">{r.workflowType}</StatusBadge> },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
  ];
  return (
    <>
      <div className="mb-3 flex justify-end">
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New template</button>
      </div>
      <DataTable columns={cols} rows={data} loading={isLoading}
        onRowClick={(r) => navigate({ to: "/dashboard/workflows/$id", params: { id: r.id } })}
        emptyTitle="No workflow templates" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>Create workflow</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <select value={form.workflowType} onChange={(e) => setForm({ ...form, workflowType: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm">
              <option value="order">order</option><option value="approval">approval</option><option value="onboarding">onboarding</option>
            </select>
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
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
    <div className="card-elevated space-y-6 p-6">
      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Delivery order lifecycle:</p>
        <div className="flex flex-wrap items-center gap-2">
          {ORDER_STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <StatusBadge status={s} />
              {i < ORDER_STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Pickup path:</p>
        <div className="flex flex-wrap items-center gap-2">
          {PICKUP_STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <StatusBadge status={s} />
              {i < PICKUP_STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground"><code>cancelled</code> may branch from any step.</p>
    </div>
  );
}
