import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { menusApi, menusExtApi } from "@/services/apiClient";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/menus/$id")({ component: MenuBuilder });

function MenuBuilder() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const menu = useQuery({ queryKey: ["menu", id], queryFn: () => menusApi.get(id) });
  async function del() {
    if (!confirm("Delete this menu?")) return;
    try { await menusExtApi.remove(id); toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["menus"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  if (menu.isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!menu.data) return <div className="py-24 text-center">Menu not found</div>;

  return (
    <>
      <PageHeader
        title={menu.data.name} description={`${menu.data.menuType} menu`}
        breadcrumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Menus", to: "/dashboard/menus" }, { label: menu.data.name }]}
        actions={<div className="flex gap-2">
          <button onClick={del} className="flex items-center gap-2 rounded-[10px] border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /> Delete</button>
          <Link to="/dashboard/menus" className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </div>}
      />
      <Tabs defaultValue="sections">
        <TabsList className="mb-4">
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>
        <TabsContent value="sections"><SectionsTab menuId={id} /></TabsContent>
        <TabsContent value="assignments"><AssignmentsTab menuId={id} /></TabsContent>
      </Tabs>
    </>
  );
}

function SectionsTab({ menuId }: { menuId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["menu-sections", menuId], queryFn: () => menusApi.listSections(menuId).catch(() => [] as never[]) });
  const [name, setName] = useState("");
  async function add() {
    if (!name.trim()) return;
    try { await menusApi.createSection(menuId, { name, sortOrder: (data?.length ?? 0) + 1 }); toast.success("Section added"); setName(""); qc.invalidateQueries({ queryKey: ["menu-sections", menuId] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function del(sectionId: string) {
    if (!confirm("Delete section?")) return;
    try { await menusExtApi.deleteSection(menuId, sectionId); toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["menu-sections", menuId] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="space-y-3">
      <div className="card-elevated flex gap-2 p-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Section name (e.g. Starters)" className="h-9 flex-1 rounded-md border border-border bg-card px-2 text-sm" />
        <button onClick={add} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Add</button>
      </div>
      {isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /> :
        !data || data.length === 0 ? <EmptyState title="No sections yet" description="Add a section to group products." /> : (
          <div className="space-y-3">
            {data.map((s) => (
              <SectionCard key={s.id} menuId={menuId} sectionId={s.id} name={s.name} onDelete={() => del(s.id)} />
            ))}
          </div>
        )}
    </div>
  );
}

function SectionCard({ menuId, sectionId, name, onDelete }: { menuId: string; sectionId: string; name: string; onDelete: () => void }) {
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ["section-products", menuId, sectionId], queryFn: () => menusExtApi.listSectionProducts(menuId, sectionId).catch(() => [] as never[]) });
  const [pid, setPid] = useState("");
  async function add() {
    if (!pid.trim()) return;
    try { await menusApi.addSectionProduct(menuId, sectionId, { productId: pid, sortOrder: (products.data?.length ?? 0) + 1 }); toast.success("Added"); setPid(""); qc.invalidateQueries({ queryKey: ["section-products", menuId, sectionId] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function rm(productId: string) {
    try { await menusExtApi.removeSectionProduct(menuId, sectionId, productId); toast.success("Removed"); qc.invalidateQueries({ queryKey: ["section-products", menuId, sectionId] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="card-elevated p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-semibold">{name}</h4>
        <button onClick={onDelete} className="text-destructive hover:underline"><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="mb-2 flex gap-2">
        <input value={pid} onChange={(e) => setPid(e.target.value)} placeholder="Product ID" className="h-9 flex-1 rounded-md border border-border bg-card px-2 text-sm" />
        <button onClick={add} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Add product</button>
      </div>
      {!products.data || products.data.length === 0 ? <p className="text-xs text-muted-foreground">No products in this section.</p> : (
        <ul className="divide-y divide-border">
          {products.data.map((sp) => (
            <li key={sp.id} className="flex items-center justify-between py-2 text-sm">
              <code className="text-xs">{sp.productId}</code>
              <button onClick={() => rm(sp.productId)} className="text-destructive hover:underline text-xs">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AssignmentsTab({ menuId }: { menuId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["menu-assignments", menuId], queryFn: () => menusExtApi.listAssignments(menuId).catch(() => [] as never[]) });
  const [scopeType, setScopeType] = useState<"company" | "global">("global");
  const [scopeId, setScopeId] = useState(""); const [priority, setPriority] = useState(1);
  async function add() {
    try { await menusApi.createAssignment(menuId, { scopeType, scopeId: scopeType === "company" ? scopeId : undefined, priority }); toast.success("Assigned"); qc.invalidateQueries({ queryKey: ["menu-assignments", menuId] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function del(assignmentId: string) {
    try { await menusExtApi.deleteAssignment(menuId, assignmentId); toast.success("Removed"); qc.invalidateQueries({ queryKey: ["menu-assignments", menuId] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="space-y-3">
      <div className="card-elevated flex flex-wrap gap-2 p-4">
        <select value={scopeType} onChange={(e) => setScopeType(e.target.value as "company" | "global")} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="global">Global</option>
          <option value="company">Company</option>
        </select>
        {scopeType === "company" && <input value={scopeId} onChange={(e) => setScopeId(e.target.value)} placeholder="Company ID" className="h-9 flex-1 rounded-md border border-border bg-card px-2 text-sm" />}
        <input type="number" value={priority} onChange={(e) => setPriority(+e.target.value)} className="h-9 w-20 rounded-md border border-border bg-card px-2 text-sm" />
        <button onClick={add} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Assign</button>
      </div>
      {isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /> :
        !data || data.length === 0 ? <EmptyState title="No assignments" /> : (
          <div className="card-elevated divide-y divide-border">
            {data.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 text-sm">
                <div><StatusBadge tone="info">{a.scopeType}</StatusBadge> <code className="ml-2 text-xs">{a.scopeId ?? "*"}</code> <span className="ml-2 text-muted-foreground">priority {a.priority}</span></div>
                <button onClick={() => del(a.id)} className="text-destructive hover:underline"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
