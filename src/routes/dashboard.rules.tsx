import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { EntitySelect } from "@/components/app/EntitySelect";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { rulesApi, companiesApi } from "@/services/apiClient";
import type { RuleType, BusinessRule, Calendar, CalendarEvent } from "@/types/api";
import { Plus, Loader2, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { TIMEZONES, optionsFrom } from "@/lib/systemOptions";
import { cleanRuleTypeName, formatRuleValue, RULE_PRESETS } from "@/lib/ruleValueFormat";

export const Route = createFileRoute("/dashboard/rules")({ component: RulesPage });

function RulesPage() {
  return (
    <>
      <PageHeader title={t("Business Rules")} description={t("Operational settings like fees, delivery days, and calendars — not screen access.")} />
      <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-relaxed">
        <p className="font-semibold text-foreground">{t("rulesGuideTitle")}</p>
        <p className="mt-1 text-muted-foreground">{t("rulesGuideBody")}</p>
        <ul className="mt-2 list-disc space-y-1 ps-5 text-muted-foreground">
          <li>{t("rulesGuideMinDaily")}</li>
          <li>{t("rulesGuideMinQty")}</li>
        </ul>
      </div>
      <div className="mb-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
        {t("Need to hide screens from a user? Use Roles → Screen access. Business rules control how orders and pricing behave.")}
        {" "}
        <Link to="/dashboard/roles" className="font-semibold text-primary hover:underline">{t("Open roles")}</Link>
      </div>
      <Tabs defaultValue="business-rules" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="business-rules">{t("Business Rules")}</TabsTrigger>
          <TabsTrigger value="rule-types">{t("Rule Types")}</TabsTrigger>
          <TabsTrigger value="resolve">{t("Resolve tester")}</TabsTrigger>
          <TabsTrigger value="calendars">{t("Calendars")}</TabsTrigger>
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
      <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle={t("No rule types")} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>New rule type</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder={t("Code")} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder={t("Name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Create")}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BusinessRulesTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["business-rules"], queryFn: rulesApi.listBusinessRules });
  const types = useQuery({ queryKey: ["rule-types"], queryFn: rulesApi.listRuleTypes });
  const companies = useQuery({ queryKey: ["companies-rules"], queryFn: () => companiesApi.list({ pageSize: 100 }) });
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessRule | null>(null);
  const [form, setForm] = useState({
    ruleTypeId: "",
    scopeType: "platform",
    scopeId: "",
    priority: 5,
    value: '{\n  "amount": 1000,\n  "currency": "EGP"\n}',
    notes: "",
    isActive: true,
  });
  const [editForm, setEditForm] = useState({ value: "", priority: 5, isActive: true, notes: "" });

  const typeById = useMemo(() => new Map((types.data ?? []).map((rt) => [rt.id, rt])), [types.data]);
  const companyName = useMemo(() => {
    const map = new Map((companies.data?.items ?? []).map((c) => [c.id, c.tradeName ?? c.legalName]));
    return (id: string | null) => (id ? map.get(id) ?? id.slice(0, 8) + "…" : "—");
  }, [companies.data]);

  function applyPreset(code: string) {
    const preset = RULE_PRESETS.find((p) => p.code === code);
    const rt = types.data?.find((r) => r.code === code);
    if (!preset || !rt) return;
    setForm((f) => ({
      ...f,
      ruleTypeId: rt.id,
      value: JSON.stringify(preset.defaultValue, null, 2),
    }));
  }

  async function create() {
    if (!form.ruleTypeId) { toast.error(t("Choose a rule type")); return; }
    let value: unknown;
    try { value = JSON.parse(form.value); } catch { toast.error(t("Invalid JSON")); return; }
    try {
      await rulesApi.createBusinessRule({
        ruleTypeId: form.ruleTypeId,
        scopeType: form.scopeType,
        scopeId: form.scopeType === "platform" ? null : (form.scopeId || null),
        priority: form.priority,
        value,
        notes: form.notes || undefined,
        isActive: form.isActive,
      } as never);
      toast.success(t("Created"));
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["business-rules"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  function openEdit(rule: BusinessRule) {
    setEditing(rule);
    setEditForm({
      value: JSON.stringify(rule.value, null, 2),
      priority: rule.priority,
      isActive: rule.isActive,
      notes: "",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editing) return;
    let value: unknown;
    try { value = JSON.parse(editForm.value); } catch { toast.error(t("Invalid JSON")); return; }
    try {
      await rulesApi.updateBusinessRule(editing.id, {
        value,
        priority: editForm.priority,
        isActive: editForm.isActive,
      } as never);
      toast.success(t("Saved"));
      setEditOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["business-rules"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  async function del(id: string) {
    if (!confirm(t("Delete rule?"))) return;
    try { await rulesApi.deleteBusinessRule(id); toast.success(t("Deleted")); qc.invalidateQueries({ queryKey: ["business-rules"] }); }
    catch (e) { toast.error((e as Error).message); }
  }

  const cols: Column<BusinessRule>[] = [
    {
      key: "type",
      header: "Type",
      cell: (r) => {
        const rt = typeById.get(r.ruleTypeId);
        return <span className="font-semibold">{cleanRuleTypeName(rt?.name ?? r.ruleTypeId.slice(0, 8))}</span>;
      },
    },
    {
      key: "scope",
      header: "Scope",
      cell: (r) => (
        <StatusBadge tone="info">
          {r.scopeType === "platform" ? t("Platform (all companies)") : r.scopeType === "company" ? t("Company") : r.scopeType}
        </StatusBadge>
      ),
    },
    {
      key: "scopeId",
      header: "Company / scope",
      cell: (r) => <span>{r.scopeType === "company" ? companyName(r.scopeId) : "—"}</span>,
    },
    { key: "priority", header: "Priority", cell: (r) => r.priority },
    {
      key: "active",
      header: "Status",
      cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? t("Active") : t("Inactive")}</StatusBadge>,
    },
    {
      key: "value",
      header: "Value",
      cell: (r) => <span className="text-sm">{formatRuleValue(r.value, typeById.get(r.ruleTypeId))}</span>,
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="text-primary hover:opacity-80" aria-label={t("Edit")}>
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); void del(r.id); }} className="text-destructive hover:opacity-80" aria-label={t("Delete")}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {RULE_PRESETS.map((p) => (
            <button
              key={p.code}
              type="button"
              onClick={() => { applyPreset(p.code); setOpen(true); }}
              className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              + {t(p.labelKey)}
            </button>
          ))}
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> {t("New rule")}
        </button>
      </div>
      <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle={t("No business rules configured")} onRowClick={openEdit} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("New business rule")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">{t("Rule type")}</label>
              <EntitySelect
                value={form.ruleTypeId}
                onChange={(ruleTypeId) => setForm({ ...form, ruleTypeId })}
                placeholder={t("Select rule type…")}
                options={(types.data ?? []).map((rt) => ({ value: rt.id, label: cleanRuleTypeName(rt.name), hint: rt.code }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">{t("Scope")}</label>
              <select value={form.scopeType} onChange={(e) => setForm({ ...form, scopeType: e.target.value, scopeId: "" })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm">
                <option value="platform">{t("Platform (all companies)")}</option>
                <option value="company">{t("Company")}</option>
              </select>
            </div>
            {form.scopeType === "company" && (
              <div>
                <label className="mb-1 block text-sm font-semibold">{t("Company")}</label>
                <EntitySelect
                  value={form.scopeId}
                  onChange={(scopeId) => setForm({ ...form, scopeId })}
                  placeholder={t("Select company…")}
                  options={(companies.data?.items ?? []).map((c) => ({ value: c.id, label: c.tradeName ?? c.legalName }))}
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-semibold">{t("Priority")}</label>
              <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: +e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">{t("Value (JSON)")}</label>
              <textarea value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="min-h-[100px] w-full rounded-md border border-border bg-card p-3 font-mono text-xs" />
              <p className="mt-1 text-xs text-muted-foreground">{t("rulesValueHint")}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              {t("Active")}
            </label>
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Create")}</button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("Edit rule")}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {cleanRuleTypeName(typeById.get(editing.ruleTypeId)?.name ?? "")} · {formatRuleValue(editing.value, typeById.get(editing.ruleTypeId))}
              </p>
              <div>
                <label className="mb-1 block text-sm font-semibold">{t("Priority")}</label>
                <input type="number" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: +e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">{t("Value (JSON)")}</label>
                <textarea value={editForm.value} onChange={(e) => setEditForm({ ...editForm, value: e.target.value })} className="min-h-[120px] w-full rounded-md border border-border bg-card p-3 font-mono text-xs" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
                {t("Active")}
              </label>
            </div>
          )}
          <DialogFooter><button onClick={saveEdit} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Save changes")}</button></DialogFooter>
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
        <input placeholder={t("Rule type code")} value={code} onChange={(e) => setCode(e.target.value)} className="h-10 rounded-md border border-border bg-card px-3 text-sm" />
        <input placeholder={t("Company ID (optional)")} value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-10 rounded-md border border-border bg-card px-3 text-sm" />
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
      <DataTable columns={cols} rows={data} loading={isLoading} onRowClick={setSelected} emptyTitle={t("No calendars")} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>New calendar</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder={t("Code")} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder={t("Name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <EntitySelect
              value={form.timezone}
              onChange={(timezone) => setForm({ ...form, timezone })}
              options={optionsFrom(TIMEZONES, t)}
              placeholder={t("Timezone")}
            />
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Create")}</button></DialogFooter>
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
        <button onClick={onClose} className="text-sm text-muted-foreground hover:underline">{t("Close")}</button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input placeholder={t("Event name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 flex-1 min-w-[140px] rounded-md border border-border bg-card px-2 text-sm" />
        <input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} className="h-9 rounded-md border border-border bg-card px-2 text-sm" />
        <select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value as never })} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="holiday">holiday</option><option value="blackout">blackout</option><option value="special_hours">special_hours</option>
        </select>
        <button onClick={add} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">{t("Add")}</button>
      </div>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> :
        !data || data.length === 0 ? <EmptyState title={t("No events")} /> : (
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
