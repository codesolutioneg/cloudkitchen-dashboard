import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { companiesApi, companyDocumentsApi, filesApi } from "@/services/apiClient";
import { ArrowLeft, Check, X, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/companies/$id")({ component: CompanyDetail });

function CompanyDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const co = useQuery({ queryKey: ["company", id], queryFn: () => companiesApi.get(id) });

  async function approve() {
    try { await companiesApi.approve(id); toast.success("Approved"); qc.invalidateQueries({ queryKey: ["company", id] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function reject() {
    const reason = prompt("Reason?") ?? undefined;
    try { await companiesApi.reject(id, reason); toast.success("Rejected"); qc.invalidateQueries({ queryKey: ["company", id] }); }
    catch (e) { toast.error((e as Error).message); }
  }

  if (co.isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!co.data) return <div className="py-24 text-center text-muted-foreground">Company not found</div>;
  const c = co.data;

  return (
    <>
      <PageHeader
        title={c.legalName}
        description={c.tradeName ?? c.primaryEmail}
        breadcrumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Companies", to: "/dashboard/companies" }, { label: c.legalName }]}
        actions={<Link to="/dashboard/companies" className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><ArrowLeft className="h-4 w-4" /> Back</Link>}
      />
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="card-elevated space-y-4 p-6">
            <Row label="Trade name" value={c.tradeName ?? "—"} />
            <Row label="Email" value={c.primaryEmail} />
            <Row label="Phone" value={c.primaryPhone} />
            <Row label="Location" value={`${c.city ?? "—"}, ${c.countryCode}`} />
            <Row label="Approval" value={<StatusBadge status={c.approvalStatus} />} />
            <Row label="Status" value={<StatusBadge status={c.status} tone="muted" />} />
            <div className="flex gap-2 pt-2">
              <button onClick={approve} className="flex items-center gap-2 rounded-[10px] bg-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90"><Check className="h-4 w-4" /> Approve</button>
              <button onClick={reject} className="flex items-center gap-2 rounded-[10px] bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90"><X className="h-4 w-4" /> Reject</button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents"><DocumentsTab companyId={id} /></TabsContent>
        <TabsContent value="users"><UsersTab companyId={id} /></TabsContent>
        <TabsContent value="features"><FeaturesTab companyId={id} /></TabsContent>
        <TabsContent value="modules"><ModulesTab companyId={id} /></TabsContent>
        <TabsContent value="settings"><SettingsTab companyId={id} /></TabsContent>
      </Tabs>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-4"><div className="text-sm text-muted-foreground">{label}</div><div className="col-span-2 text-sm font-medium">{value}</div></div>;
}

function DocumentsTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["company-docs", companyId], queryFn: () => companyDocumentsApi.list(companyId).catch(() => [] as never[]) });
  const [attachmentType, setAttachmentType] = useState("commercial_registration");

  async function verify(attId: string, status: "verified" | "rejected") {
    try { await companiesApi.verifyDocument(companyId, attId, status); toast.success("Document " + status); qc.invalidateQueries({ queryKey: ["company-docs", companyId] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function upload(f: File) {
    try { await filesApi.upload(f, "company", companyId, attachmentType); toast.success("Uploaded"); qc.invalidateQueries({ queryKey: ["company-docs", companyId] }); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="card-elevated flex flex-wrap items-center gap-3 p-4">
        <select value={attachmentType} onChange={(e) => setAttachmentType(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="commercial_registration">Commercial registration</option>
          <option value="vat_certificate">VAT certificate</option>
          <option value="bank_letter">Bank letter</option>
          <option value="id_card">ID card</option>
          <option value="other">Other</option>
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-[oklch(0.52_0.19_285)]">
          <Upload className="h-4 w-4" /> Upload file
          <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </div>
      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> :
        !data || data.length === 0 ? <EmptyState title="No documents" description="Upload onboarding attachments above." /> : (
          <div className="card-elevated divide-y divide-border">
            {data.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-semibold">{d.file.fileName}</div>
                  <div className="text-xs text-muted-foreground">{d.attachmentType} · {d.file.mimeType}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.verificationStatus ?? "pending"} />
                  <button onClick={() => verify(d.id, "verified")} className="rounded-md border border-success/40 px-2 py-1 text-xs text-success hover:bg-success/10">Verify</button>
                  <button onClick={() => verify(d.id, "rejected")} className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function UsersTab({ companyId }: { companyId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["company-users", companyId], queryFn: () => companiesApi.users(companyId).catch(() => [] as never[]) });
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!data || data.length === 0) return <EmptyState title="No company users" description="Corporate users will list here." />;
  return (
    <div className="card-elevated divide-y divide-border">
      {data.map((u) => (
        <div key={u.id} className="flex items-center justify-between p-4">
          <div><div className="font-semibold">{u.fullName}</div><div className="text-xs text-muted-foreground">{u.email}</div></div>
          <StatusBadge status={u.status} />
        </div>
      ))}
    </div>
  );
}

function FeaturesTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["company-features", companyId], queryFn: () => companiesApi.getFeatures(companyId).catch(() => [] as never[]) });
  const [pending, setPending] = useState<Record<string, boolean>>({});
  async function save() {
    try { await companiesApi.updateFeatures(companyId, { features: Object.entries(pending).map(([id, isEnabled]) => ({ featureId: id, isEnabled })) }); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["company-features", companyId] }); setPending({}); }
    catch (e) { toast.error((e as Error).message); }
  }
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!data || data.length === 0) return <EmptyState title="No feature overrides" description="This company inherits global feature defaults." />;
  return (
    <div className="space-y-3">
      <div className="card-elevated divide-y divide-border">
        {data.map((f) => {
          const cur = pending[f.id] ?? f.isGlobalDefaultEnabled;
          return (
            <div key={f.id} className="flex items-center justify-between p-4">
              <div><div className="font-semibold">{f.name}</div><code className="text-xs text-muted-foreground">{f.code}</code></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cur} onChange={(e) => setPending((p) => ({ ...p, [f.id]: e.target.checked }))} /> Enabled</label>
            </div>
          );
        })}
      </div>
      {Object.keys(pending).length > 0 && <button onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save changes</button>}
    </div>
  );
}

function ModulesTab({ companyId }: { companyId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["company-modules", companyId], queryFn: () => companiesApi.getModules(companyId).catch(() => [] as never[]) });
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!data || data.length === 0) return <EmptyState title="No module overrides" />;
  return (
    <div className="card-elevated divide-y divide-border">
      {data.map((m) => (
        <div key={m.id} className="flex items-center justify-between p-4">
          <div><div className="font-semibold">{m.name}</div><code className="text-xs text-muted-foreground">{m.code}</code></div>
          <StatusBadge tone={m.isCore ? "warning" : "info"}>{m.isCore ? "Core" : m.audience}</StatusBadge>
        </div>
      ))}
    </div>
  );
}

function SettingsTab({ companyId }: { companyId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["company-settings", companyId], queryFn: () => companiesApi.getSettings(companyId).catch(() => null) });
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!data || Object.keys(data.settings).length === 0) return <EmptyState title="No overrides" description="Company inherits all global settings." />;
  return (
    <div className="card-elevated divide-y divide-border">
      {Object.entries(data.settings).map(([k, v]) => (
        <div key={k} className="grid grid-cols-2 gap-4 p-4">
          <code className="text-sm font-semibold">{v.key}</code>
          <code className="text-sm">{JSON.stringify(v.value)}</code>
        </div>
      ))}
    </div>
  );
}
