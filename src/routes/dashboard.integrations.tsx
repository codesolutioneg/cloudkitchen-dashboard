import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { integrationsApi, integrationsExtApi } from "@/services/apiClient";
import type { ExternalSystem, IntegrationEvent, IntegrationMapping } from "@/types/api";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/integrations")({ component: IntegrationsPage });

function IntegrationsPage() {
  return (
    <>
      <PageHeader title="Integrations" description="External systems, mappings and events." />
      <Tabs defaultValue="systems">
        <TabsList className="mb-4">
          <TabsTrigger value="systems">Systems</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>
        <TabsContent value="systems"><SystemsTab /></TabsContent>
        <TabsContent value="events"><EventsTab /></TabsContent>
      </Tabs>
    </>
  );
}

function SystemsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["integration-systems"], queryFn: integrationsApi.listSystems });
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ExternalSystem | null>(null);
  const [form, setForm] = useState({ code: "", name: "", systemType: "erp", baseUrl: "" });
  async function create() {
    try { await integrationsApi.createSystem({ ...form, isActive: true }); toast.success("Created"); setOpen(false); qc.invalidateQueries({ queryKey: ["integration-systems"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  const cols: Column<ExternalSystem>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "type", header: "Type", cell: (r) => <StatusBadge tone="info">{r.systemType}</StatusBadge> },
    { key: "url", header: "Base URL", cell: (r) => r.baseUrl ?? "—" },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
  ];
  return (
    <>
      <div className="mb-3 flex justify-end"><button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New system</button></div>
      <DataTable columns={cols} rows={data} loading={isLoading} onRowClick={setSelected} emptyTitle="No integrations connected" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>New external system</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <select value={form.systemType} onChange={(e) => setForm({ ...form, systemType: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm">
              <option value="erp">erp</option><option value="crm">crm</option><option value="pos">pos</option><option value="payment">payment</option><option value="webhook">webhook</option>
            </select>
            <input placeholder="Base URL" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create</button></DialogFooter>
        </DialogContent>
      </Dialog>
      {selected && <MappingsPanel system={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function MappingsPanel({ system, onClose }: { system: ExternalSystem; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["integration-mappings", system.id], queryFn: () => integrationsApi.listMappings(system.id).catch(() => [] as IntegrationMapping[]) });
  const [form, setForm] = useState({ entityType: "", localValue: "", externalValue: "" });
  async function add() {
    try { await integrationsExtApi.createMapping(system.id, form); toast.success("Added"); qc.invalidateQueries({ queryKey: ["integration-mappings", system.id] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="mt-6 card-elevated p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{system.name} — mappings</h3>
        <button onClick={onClose} className="text-sm text-muted-foreground hover:underline">Close</button>
      </div>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
        <input placeholder="Entity type" value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value })} className="h-9 rounded-md border border-border bg-card px-2 text-sm" />
        <input placeholder="Local value" value={form.localValue} onChange={(e) => setForm({ ...form, localValue: e.target.value })} className="h-9 rounded-md border border-border bg-card px-2 text-sm" />
        <input placeholder="External value" value={form.externalValue} onChange={(e) => setForm({ ...form, externalValue: e.target.value })} className="h-9 rounded-md border border-border bg-card px-2 text-sm" />
        <button onClick={add} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Add mapping</button>
      </div>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> :
        !data || data.length === 0 ? <EmptyState title="No mappings" /> : (
          <ul className="divide-y divide-border">
            {data.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                <span><StatusBadge tone="info">{m.entityType}</StatusBadge> <code className="ml-2 text-xs">{m.localValue}</code> → <code className="text-xs">{m.externalValue}</code></span>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

function EventsTab() {
  const [status, setStatus] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["integration-events"], queryFn: integrationsApi.listEvents });
  const filtered = data?.filter((e) => !status || e.status === status);
  const cols: Column<IntegrationEvent>[] = [
    { key: "when", header: "When", cell: (r) => new Date(r.occurredAt).toLocaleString() },
    { key: "type", header: "Event", cell: (r) => <code className="text-xs">{r.eventType}</code> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  ];
  return (
    <>
      <div className="mb-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border border-border bg-card px-3 text-sm">
          <option value="">All statuses</option><option value="pending">pending</option><option value="delivered">delivered</option><option value="failed">failed</option>
        </select>
      </div>
      <DataTable columns={cols} rows={filtered} loading={isLoading} emptyTitle="No integration events" />
    </>
  );
}
