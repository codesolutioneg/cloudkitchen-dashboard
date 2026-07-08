import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { rulesApi } from "@/services/apiClient";
import type { RuleType, BusinessRule, Calendar, CalendarEvent } from "@/types/api";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/rules")({ component: RulesPage });

function RulesPage() {
  return (
    <>
      <PageHeader title="Business Rules" description="Configurable operational rules and calendars." />
      <Tabs defaultValue="rule-types" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="rule-types">Rule Types</TabsTrigger>
          <TabsTrigger value="business-rules">Business Rules</TabsTrigger>
          <TabsTrigger value="resolve">Resolve tester</TabsTrigger>
          <TabsTrigger value="calendars">Calendars</TabsTrigger>
        </TabsList>
        <TabsContent value="rule-types"><RuleTypesTab /></TabsContent>
        <TabsContent value="business-rules"><BusinessRulesTab /></TabsContent>
        <TabsContent value="resolve"><ResolveTab /></TabsContent>
        <TabsContent value="calendars"><CalendarsTab /></TabsContent>
      </Tabs>
    </>
  );
}

function RuleTypesTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["rule-types"], queryFn: rulesApi.listRuleTypes });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "" });
  async function create() {
    try { await rulesApi.createRuleType(form); toast.success("Created"); setOpen(false); qc.invalidateQueries({ queryKey: ["rule-types"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  const cols: Column<RuleType>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "schema", header: "Has schema", cell: (r) => <StatusBadge tone={r.valueSchema ? "success" : "muted"}>{r.valueSchema ? "Yes" : "No"}</StatusBadge> },
  ];
  return (
    <>
      <div className="mb-3 flex justify-end"><button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New rule type</button></div>
      <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No rule types" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>New rule type</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BusinessRulesTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["business-rules"], queryFn: rulesApi.listBusinessRules });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ruleTypeId: "", scopeType: "global", scopeId: "", priority: 0, value: "{}", isActive: true });
  async function create() {
    let value: unknown;
    try { value = JSON.parse(form.value); } catch { toast.error("Invalid JSON"); return; }
    try { await rulesApi.createBusinessRule({ ...form, value, scopeId: form.scopeId || null } as never); toast.success("Created"); setOpen(false); qc.invalidateQueries({ queryKey: ["business-rules"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function del(id: string) {
    if (!confirm("Delete rule?")) return;
    try { await rulesApi.deleteBusinessRule(id); toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["business-rules"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  const cols: Column<BusinessRule>[] = [
    { key: "scope", header: "Scope", cell: (r) => <StatusBadge tone="info">{r.scopeType}</StatusBadge> },
    { key: "scopeId", header: "Scope ID", cell: (r) => r.scopeId ?? "—" },
    { key: "priority", header: "Priority", cell: (r) => r.priority },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
    { key: "value", header: "Value", cell: (r) => <code className="text-xs">{JSON.stringify(r.value).slice(0, 40)}…</code> },
    { key: "del", header: "", cell: (r) => <button onClick={() => del(r.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>, className: "text-right" },
  ];
  return (
    <>
      <div className="mb-3 flex justify-end"><button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New rule</button></div>
      <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No business rules configured" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>New business rule</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder="Rule type ID" value={form.ruleTypeId} onChange={(e) => setForm({ ...form, ruleTypeId: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <select value={form.scopeType} onChange={(e) => setForm({ ...form, scopeType: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm">
              <option value="global">global</option><option value="company">company</option><option value="department">department</option>
            </select>
            {form.scopeType !== "global" && <input placeholder="Scope ID" value={form.scopeId} onChange={(e) => setForm({ ...form, scopeId: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />}
            <input type="number" placeholder="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: +e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <textarea placeholder='Value (JSON)' value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="min-h-[100px] w-full rounded-md border border-border bg-card p-3 font-mono text-xs" />
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResolveTab() {
  const [code, setCode] = useState(""); const [companyId, setCompanyId] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  async function run() {
    if (!code) return;
    setLoading(true);
    try { const r = await rulesApi.resolve({ ruleTypeCode: code, companyId: companyId || undefined }); setResult(r); }
    catch (e) { toast.error((e as Error).message); setResult(null); }
    setLoading(false);
  }
  return (
    <div className="card-elevated max-w-2xl space-y-3 p-6">
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Rule type code" value={code} onChange={(e) => setCode(e.target.value)} className="h-10 rounded-md border border-border bg-card px-3 text-sm" />
        <input placeholder="Company ID (optional)" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-10 rounded-md border border-border bg-card px-3 text-sm" />
      </div>
      <button onClick={run} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Resolve</button>
      {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      {result != null && <pre className="rounded-lg border border-border bg-muted/40 p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}

function CalendarsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["calendars"], queryFn: rulesApi.listCalendars });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", timezone: "UTC" });
  const [selected, setSelected] = useState<Calendar | null>(null);
  async function create() {
    try { await rulesApi.createCalendar(form); toast.success("Created"); setOpen(false); qc.invalidateQueries({ queryKey: ["calendars"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  const cols: Column<Calendar>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "tz", header: "Timezone", cell: (r) => r.timezone },
  ];
  return (
    <>
      <div className="mb-3 flex justify-end"><button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New calendar</button></div>
      <DataTable columns={cols} rows={data} loading={isLoading} onRowClick={setSelected} emptyTitle="No calendars" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>New calendar</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Timezone" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create</button></DialogFooter>
        </DialogContent>
      </Dialog>
      {selected && <CalendarEvents calendar={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function CalendarEvents({ calendar, onClose }: { calendar: Calendar; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["calendar-events", calendar.id], queryFn: () => rulesApi.listEvents(calendar.id).catch(() => [] as CalendarEvent[]) });
  const [form, setForm] = useState({ name: "", eventDate: "", eventType: "holiday" as CalendarEvent["eventType"] });
  async function add() {
    if (!form.name || !form.eventDate) return;
    try { await rulesApi.createEvent(calendar.id, form as never); toast.success("Added"); setForm({ name: "", eventDate: "", eventType: "holiday" }); qc.invalidateQueries({ queryKey: ["calendar-events", calendar.id] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="mt-6 card-elevated p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{calendar.name} — events</h3>
        <button onClick={onClose} className="text-sm text-muted-foreground hover:underline">Close</button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input placeholder="Event name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 flex-1 min-w-[140px] rounded-md border border-border bg-card px-2 text-sm" />
        <input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} className="h-9 rounded-md border border-border bg-card px-2 text-sm" />
        <select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value as never })} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="holiday">holiday</option><option value="blackout">blackout</option><option value="special_hours">special_hours</option>
        </select>
        <button onClick={add} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Add</button>
      </div>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> :
        !data || data.length === 0 ? <EmptyState title="No events" /> : (
          <ul className="divide-y divide-border">
            {data.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span>{e.name} — {new Date(e.eventDate).toLocaleDateString()}</span>
                <StatusBadge tone="info">{e.eventType}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
