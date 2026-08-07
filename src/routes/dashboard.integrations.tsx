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
import { Eye, Plus, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/integrations")({ component: IntegrationsPage });

function IntegrationsPage() {
  return (
    <>
      <PageHeader title={t("Integrations")} description={t("External systems, mappings and events.")} />
      <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-relaxed">
        <p className="font-semibold">{t("integrationsGuideTitle")}</p>
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-muted-foreground">
          <li>{t("integrationsStep1")}</li>
          <li>{t("integrationsStep2")}</li>
          <li>{t("integrationsStep3")}</li>
        </ol>
      </div>
      <Tabs defaultValue="systems">
        <TabsList className="mb-4">
          <TabsTrigger value="systems">{t("Systems")}</TabsTrigger>
          <TabsTrigger value="events">{t("Events")}</TabsTrigger>
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
    if (!form.code.trim() || !form.name.trim()) {
      toast.error(t("Fill required fields"));
      return;
    }
    try {
      await integrationsApi.createSystem({ ...form, code: form.code.trim(), name: form.name.trim(), isActive: true });
      toast.success(t("Created"));
      setOpen(false);
      setForm({ code: "", name: "", systemType: "erp", baseUrl: "" });
      qc.invalidateQueries({ queryKey: ["integration-systems"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const cols: Column<ExternalSystem>[] = [
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "type", header: "Type", cell: (r) => <StatusBadge tone="info">{r.systemType.toUpperCase()}</StatusBadge> },
    { key: "url", header: "Base URL", cell: (r) => r.baseUrl ? <span className="text-xs">{r.baseUrl}</span> : "—" },
    {
      key: "active",
      header: "Status",
      cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? t("Active") : t("Inactive")}</StatusBadge>,
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setSelected(r); }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <Eye className="h-3.5 w-3.5" />
          {t("Open")}
        </button>
      ),
      className: "text-right",
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> {t("New integration system")}
        </button>
      </div>
      <DataTable columns={cols} rows={data} loading={isLoading} onRowClick={setSelected} emptyTitle={t("No integrations connected")} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plug className="h-5 w-5 text-primary" /> {t("New integration system")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("integrationsCreateHint")}</p>
          <div className="space-y-2">
            <input placeholder={t("Code (e.g. odoo)")} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder={t("Display name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <select value={form.systemType} onChange={(e) => setForm({ ...form, systemType: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm">
              <option value="erp">ERP</option><option value="crm">CRM</option><option value="pos">POS</option><option value="payment">Payment</option><option value="webhook">Webhook</option>
            </select>
            <input placeholder={t("Base URL (optional)")} value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Create")}</button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selected?.name}</DialogTitle></DialogHeader>
          {selected && <MappingsPanel system={selected} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function MappingsPanel({ system }: { system: ExternalSystem }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["integration-mappings", system.id],
    queryFn: () => integrationsApi.listMappings(system.id).catch(() => [] as IntegrationMapping[]),
  });
  const [form, setForm] = useState({ entityType: "product", localValue: "", externalValue: "" });

  async function add() {
    if (!form.localValue.trim() || !form.externalValue.trim()) {
      toast.error(t("Fill mapping fields"));
      return;
    }
    try {
      await integrationsExtApi.createMapping(system.id, form);
      toast.success(t("Added"));
      setForm({ entityType: "product", localValue: "", externalValue: "" });
      qc.invalidateQueries({ queryKey: ["integration-mappings", system.id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <div><span className="text-muted-foreground">{t("Type")}:</span> {system.systemType}</div>
        <div><span className="text-muted-foreground">{t("Code")}:</span> <code>{system.code}</code></div>
        {system.baseUrl && <div><span className="text-muted-foreground">{t("Base URL")}:</span> {system.baseUrl}</div>}
      </div>
      <p className="text-sm text-muted-foreground">{t("integrationsMappingHint")}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <select value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value })} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="product">{t("Products")}</option>
          <option value="category">{t("Categories")}</option>
          <option value="company">{t("Companies")}</option>
        </select>
        <input placeholder={t("Local ID / SKU")} value={form.localValue} onChange={(e) => setForm({ ...form, localValue: e.target.value })} className="h-9 rounded-md border border-border bg-card px-2 text-sm" />
        <input placeholder={t("External ID")} value={form.externalValue} onChange={(e) => setForm({ ...form, externalValue: e.target.value })} className="h-9 rounded-md border border-border bg-card px-2 text-sm" />
        <button onClick={add} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">{t("Add mapping")}</button>
      </div>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> :
        !data || data.length === 0 ? <EmptyState title={t("No mappings")} description={t("integrationsNoMappingsDesc")} /> : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {data.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <StatusBadge tone="info">{m.entityType}</StatusBadge>
                <span className="min-w-0 flex-1 truncate font-medium">{m.localValue}</span>
                <span className="text-muted-foreground">→</span>
                <span className="min-w-0 flex-1 truncate text-end">{m.externalValue}</span>
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
    { key: "when", header: "When", cell: (r) => new Date(r.occurredAt).toLocaleString("ar-EG") },
    { key: "type", header: "Event", cell: (r) => <span className="text-xs font-medium">{r.eventType}</span> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  ];
  return (
    <>
      <div className="mb-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border border-border bg-card px-3 text-sm">
          <option value="">{t("All statuses")}</option>
          <option value="pending">{t("Pending")}</option>
          <option value="delivered">{t("Delivered")}</option>
          <option value="failed">{t("Failed")}</option>
        </select>
      </div>
      <DataTable columns={cols} rows={filtered} loading={isLoading} emptyTitle={t("No integration events")} />
    </>
  );
}
