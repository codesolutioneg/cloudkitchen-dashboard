import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { localizationApi } from "@/services/apiClient";
import type { Language, Translation } from "@/types/api";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/localization")({ component: LocalizationPage });

function LocalizationPage() {
  return (
    <>
      <PageHeader title="Localization" description="Languages and translations for content entities." />
      <Tabs defaultValue="languages">
        <TabsList className="mb-4">
          <TabsTrigger value="languages">Languages</TabsTrigger>
          <TabsTrigger value="translations">Translations</TabsTrigger>
        </TabsList>
        <TabsContent value="languages"><LanguagesTab /></TabsContent>
        <TabsContent value="translations"><TranslationsTab /></TabsContent>
      </Tabs>
    </>
  );
}

function LanguagesTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["languages"], queryFn: localizationApi.listLanguages });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", isDefault: false, isActive: true });
  async function create() {
    try { await localizationApi.createLanguage(form); toast.success("Created"); setOpen(false); qc.invalidateQueries({ queryKey: ["languages"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  const cols: Column<Language>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs uppercase">{r.code}</code> },
    { key: "name", header: "Language", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "default", header: "Default", cell: (r) => r.isDefault ? <StatusBadge tone="success">Default</StatusBadge> : <span className="text-muted-foreground">—</span> },
    { key: "active", header: "Status", cell: (r) => <StatusBadge tone={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge> },
  ];
  return (
    <>
      <div className="mb-3 flex justify-end"><button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New language</button></div>
      <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No languages configured" emptyDescription="Add languages so you can translate products, menus and notifications." />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>New language</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder="Code (e.g. ar)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Default</label>
          </div>
          <DialogFooter><button onClick={create} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TranslationsTab() {
  const [search, setSearch] = useState({ entityType: "", entityId: "", languageCode: "" });
  const [result, setResult] = useState<Translation[] | null>(null);
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    try { const r = await localizationApi.listTranslations({ entityType: search.entityType || undefined, entityId: search.entityId || undefined, languageCode: search.languageCode || undefined }); setResult(r); }
    catch (e) { toast.error((e as Error).message); setResult(null); }
    setLoading(false);
  }
  return (
    <div className="space-y-4">
      <div className="card-elevated grid grid-cols-1 gap-2 p-4 sm:grid-cols-4">
        <input placeholder="entityType" value={search.entityType} onChange={(e) => setSearch({ ...search, entityType: e.target.value })} className="h-10 rounded-md border border-border bg-card px-3 text-sm" />
        <input placeholder="entityId" value={search.entityId} onChange={(e) => setSearch({ ...search, entityId: e.target.value })} className="h-10 rounded-md border border-border bg-card px-3 text-sm" />
        <input placeholder="languageCode" value={search.languageCode} onChange={(e) => setSearch({ ...search, languageCode: e.target.value })} className="h-10 rounded-md border border-border bg-card px-3 text-sm" />
        <button onClick={run} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Search</button>
      </div>
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /> :
        !result ? <EmptyState title="Search translations" description="Filter by entity type, ID or language above." /> :
        result.length === 0 ? <EmptyState title="No translations found" /> : (
          <div className="card-elevated divide-y divide-border">
            {result.map((t, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 p-3 text-sm">
                <code className="text-xs">{t.entityType}</code>
                <code className="text-xs">{t.entityId.slice(0, 8)}…</code>
                <span><StatusBadge tone="info">{t.languageCode.toUpperCase()}</StatusBadge> {t.fieldName}</span>
                <span className="font-medium">{t.translatedValue}</span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
