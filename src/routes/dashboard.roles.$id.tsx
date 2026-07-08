import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { rolesApi, permissionsApi, dashboardPagesApi } from "@/services/apiClient";
import type { PagePermissionInput } from "@/types/api";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/roles/$id")({ component: RoleDetail });

const PERMS: Array<keyof PagePermissionInput> = ["canView", "canCreate", "canEdit", "canDelete", "canApprove", "canReject", "canExport", "canImport"];

function RoleDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const role = useQuery({ queryKey: ["role", id], queryFn: () => rolesApi.get(id) });
  const [name, setName] = useState(""); const [desc, setDesc] = useState("");
  useEffect(() => { if (role.data) { setName(role.data.name); setDesc(role.data.description ?? ""); } }, [role.data]);

  async function saveGeneral() {
    try { await rolesApi.update(id, { name, description: desc }); toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["role", id] }); }
    catch (e) { toast.error((e as Error).message); }
  }

  if (role.isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!role.data) return <div className="py-24 text-center">Role not found</div>;

  return (
    <>
      <PageHeader
        title={role.data.name} description={t("Edit role permissions and access.")}
        breadcrumbs={[{ label: t("Dashboard"), to: "/dashboard" }, { label: t("Roles"), to: "/dashboard/roles" }, { label: role.data.name }]}
        actions={<Link to="/dashboard/roles" className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><ArrowLeft className="h-4 w-4" /> {t("Back")}</Link>}
      />
      <Tabs defaultValue="general">
        <TabsList className="mb-4">
          <TabsTrigger value="general">{t("General")}</TabsTrigger>
          <TabsTrigger value="pages">{t("Page permissions")}</TabsTrigger>
          <TabsTrigger value="api">{t("API permissions")}</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <div className="card-elevated max-w-xl space-y-3 p-6">
            <div><label className="mb-1 block text-sm font-semibold">Name</label><input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm" /></div>
            <div><label className="mb-1 block text-sm font-semibold">Description</label><textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="min-h-[80px] w-full rounded-[10px] border border-border bg-card p-3 text-sm" /></div>
            <button onClick={saveGeneral} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Save className="h-4 w-4" /> {t("Save")}</button>
          </div>
        </TabsContent>
        <TabsContent value="pages"><PagesMatrix roleId={id} /></TabsContent>
        <TabsContent value="api"><ApiMatrix roleId={id} /></TabsContent>
      </Tabs>
    </>
  );
}

function PagesMatrix({ roleId }: { roleId: string }) {
  const pages = useQuery({ queryKey: ["dashboard-pages"], queryFn: dashboardPagesApi.list });
  const [state, setState] = useState<Record<string, Partial<PagePermissionInput>>>({});
  function toggle(pageId: string, key: keyof PagePermissionInput) {
    setState((s) => ({ ...s, [pageId]: { ...s[pageId], [key]: !s[pageId]?.[key] } }));
  }
  async function save() {
    const payload: PagePermissionInput[] = Object.entries(state).map(([pageId, v]) => ({ pageId, ...v }));
    try { await rolesApi.setPagePermissions(roleId, payload); toast.success("Saved"); setState({}); }
    catch (e) { toast.error((e as Error).message); }
  }
  if (pages.isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!pages.data || pages.data.length === 0) return <EmptyState title={t("No dashboard pages registered")} />;
  return (
    <div className="space-y-3">
      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60"><tr><th className="px-4 py-3 text-left text-xs uppercase text-muted-foreground">Page</th>
            {PERMS.map((p) => <th key={p} className="px-2 py-3 text-xs uppercase text-muted-foreground">{p.slice(3)}</th>)}
          </tr></thead>
          <tbody>{pages.data.map((pg) => (
            <tr key={pg.id} className="border-t border-border">
              <td className="px-4 py-2"><div className="font-semibold">{pg.name}</div><code className="text-xs text-muted-foreground">{pg.route}</code></td>
              {PERMS.map((p) => (
                <td key={p} className="px-2 py-2 text-center">
                  <input type="checkbox" checked={!!state[pg.id]?.[p]} onChange={() => toggle(pg.id, p)} />
                </td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <button onClick={save} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Save className="h-4 w-4" /> Save permissions</button>
    </div>
  );
}

function ApiMatrix({ roleId }: { roleId: string }) {
  const perms = useQuery({ queryKey: ["permissions"], queryFn: permissionsApi.list });
  const [state, setState] = useState<Record<string, "allow" | "deny" | undefined>>({});
  async function save() {
    const payload = Object.entries(state).filter(([, v]) => v).map(([permissionId, effect]) => ({ permissionId, effect: effect! }));
    try { await rolesApi.setApiPermissions(roleId, payload); toast.success("Saved"); }
    catch (e) { toast.error((e as Error).message); }
  }
  if (perms.isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!perms.data || perms.data.length === 0) return <EmptyState title={t("No permissions registered")} />;
  return (
    <div className="space-y-3">
      <div className="card-elevated divide-y divide-border">
        {perms.data.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-3">
            <div><div className="font-semibold">{p.name}</div><code className="text-xs text-muted-foreground">{p.code}</code></div>
            <div className="flex gap-1">
              {(["allow", "deny"] as const).map((v) => (
                <button key={v} onClick={() => setState((s) => ({ ...s, [p.id]: s[p.id] === v ? undefined : v }))}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold border ${state[p.id] === v ? (v === "allow" ? "bg-success text-white border-success" : "bg-destructive text-white border-destructive") : "border-border hover:bg-muted"}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={save} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Save className="h-4 w-4" /> {t("Save")}</button>
    </div>
  );
}
