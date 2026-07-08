import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { featuresApi, featureGroupsApi, modulesApi, featureFlagsApi, dashboardPagesApi } from "@/services/apiClient";
import type { Feature, Module, FeatureFlag, FeatureGroup, DashboardPage } from "@/types/api";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/features")({ component: FeaturesPage });

function FeaturesPage() {
  return (
    <>
      <PageHeader title="Features & Modules" description="Platform capability catalog." />
      <Tabs defaultValue="features" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="groups">Feature Groups</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="flags">Feature Flags</TabsTrigger>
          <TabsTrigger value="pages">Dashboard Pages</TabsTrigger>
        </TabsList>
        <TabsContent value="features"><FeaturesTab /></TabsContent>
        <TabsContent value="groups"><GroupsTab /></TabsContent>
        <TabsContent value="modules"><ModulesTab /></TabsContent>
        <TabsContent value="flags"><FlagsTab /></TabsContent>
        <TabsContent value="pages"><PagesTab /></TabsContent>
      </Tabs>
    </>
  );
}

function Toolbar({ children, onNew }: { children?: ReactNode; onNew: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div>{children}</div>
      <button onClick={onNew} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New</button>
    </div>
  );
}

function useCrud<T extends { id: string }>(key: string, api: { list: () => Promise<T[]>; create: (b: never) => Promise<T>; update: (id: string, b: never) => Promise<T>; remove: (id: string) => Promise<void> }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [key], queryFn: api.list });
  async function create(b: unknown) { try { await api.create(b as never); toast.success("Created"); qc.invalidateQueries({ queryKey: [key] }); } catch (e) { toast.error((e as Error).message); } }
  async function remove(id: string) { if (!confirm("Delete?")) return; try { await api.remove(id); toast.success("Deleted"); qc.invalidateQueries({ queryKey: [key] }); } catch (e) { toast.error((e as Error).message); } }
  return { ...q, create, remove };
}

function FeaturesTab() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", isGlobalDefaultEnabled: true });
  const { data, isLoading, create, remove } = useCrud("features", featuresApi);
  const cols: Column<Feature>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "default", header: "Global default", cell: (r) => <StatusBadge tone={r.isGlobalDefaultEnabled ? "success" : "muted"}>{r.isGlobalDefaultEnabled ? "Enabled" : "Disabled"}</StatusBadge> },
    { key: "del", header: "", cell: (r) => <button onClick={() => remove(r.id)} className="text-destructive hover:underline"><Trash2 className="h-4 w-4" /></button>, className: "text-right" },
  ];
  return (
    <>
      <Toolbar onNew={() => setOpen(true)} />
      <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No features yet" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>New feature</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isGlobalDefaultEnabled} onChange={(e) => setForm({ ...form, isGlobalDefaultEnabled: e.target.checked })} /> Enabled by default</label>
          </div>
          <DialogFooter><button onClick={() => { create(form); setOpen(false); }} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GroupsTab() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "" });
  const { data, isLoading, create, remove } = useCrud("feature-groups", featureGroupsApi);
  const cols: Column<FeatureGroup>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => r.name },
    { key: "del", header: "", cell: (r) => <button onClick={() => remove(r.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>, className: "text-right" },
  ];
  return (
    <>
      <Toolbar onNew={() => setOpen(true)} />
      <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No feature groups yet" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>New feature group</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <DialogFooter><button onClick={() => { create(form); setOpen(false); }} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ModulesTab() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", audience: "corporate", isCore: false });
  const { data, isLoading, create, remove } = useCrud("modules", modulesApi);
  const cols: Column<Module>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "audience", header: "Audience", cell: (r) => <StatusBadge tone="info">{r.audience}</StatusBadge> },
    { key: "core", header: "Type", cell: (r) => <StatusBadge tone={r.isCore ? "warning" : "muted"}>{r.isCore ? "Core" : "Optional"}</StatusBadge> },
    { key: "del", header: "", cell: (r) => <button onClick={() => remove(r.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>, className: "text-right" },
  ];
  return (
    <>
      <Toolbar onNew={() => setOpen(true)} />
      <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No modules yet" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>New module</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Audience" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isCore} onChange={(e) => setForm({ ...form, isCore: e.target.checked })} /> Core</label>
          </div>
          <DialogFooter><button onClick={() => { create(form); setOpen(false); }} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FlagsTab() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", isEnabled: false });
  const { data, isLoading, create, remove } = useCrud("feature-flags", featureFlagsApi);
  const cols: Column<FeatureFlag>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => r.name },
    { key: "on", header: "Enabled", cell: (r) => <StatusBadge tone={r.isEnabled ? "success" : "muted"}>{r.isEnabled ? "On" : "Off"}</StatusBadge> },
    { key: "del", header: "", cell: (r) => <button onClick={() => remove(r.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>, className: "text-right" },
  ];
  return (
    <>
      <Toolbar onNew={() => setOpen(true)} />
      <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No feature flags yet" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>New flag</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isEnabled} onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })} /> Enabled</label>
          </div>
          <DialogFooter><button onClick={() => { create(form); setOpen(false); }} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PagesTab() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", route: "", sortOrder: 0 });
  const { data, isLoading, create, remove } = useCrud("dashboard-pages", dashboardPagesApi);
  const cols: Column<DashboardPage>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "route", header: "Route", cell: (r) => <code className="text-xs">{r.route}</code> },
    { key: "sort", header: "Order", cell: (r) => r.sortOrder },
    { key: "del", header: "", cell: (r) => <button onClick={() => remove(r.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>, className: "text-right" },
  ];
  return (
    <>
      <Toolbar onNew={() => setOpen(true)} />
      <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No dashboard pages registered" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>New page</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input placeholder="Route" value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <input type="number" placeholder="Sort order" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: +e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <DialogFooter><button onClick={() => { create(form); setOpen(false); }} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
