import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { companiesApi, companyDocumentsApi, filesApi, featuresApi } from "@/services/apiClient";
import { ArrowLeft, Check, X, Loader2, Upload, Eye, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { EntitySelect } from "@/components/app/EntitySelect";
import { DOCUMENT_TYPES, optionsFrom } from "@/lib/systemOptions";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { filesExtApi } from "@/services/apiClient";
import type { VerifiedDocument } from "@/types/api";

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
        breadcrumbs={[{ label: t("Dashboard"), to: "/dashboard" }, { label: t("Companies"), to: "/dashboard/companies" }, { label: c.legalName }]}
        actions={<Link to="/dashboard/companies" className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><ArrowLeft className="h-4 w-4" /> {t("Back")}</Link>}
      />
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">{t("Overview")}</TabsTrigger>
          <TabsTrigger value="documents">{t("Documents")}</TabsTrigger>
          <TabsTrigger value="users">{t("Users")}</TabsTrigger>
          <TabsTrigger value="features">{t("Features")}</TabsTrigger>
          <TabsTrigger value="modules">{t("Modules")}</TabsTrigger>
          <TabsTrigger value="settings">{t("Settings")}</TabsTrigger>
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
              <button onClick={approve} className="flex items-center gap-2 rounded-[10px] bg-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90"><Check className="h-4 w-4" /> {t("Approve")}</button>
              <button onClick={reject} className="flex items-center gap-2 rounded-[10px] bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90"><X className="h-4 w-4" /> {t("Reject")}</button>
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
  const [previewDoc, setPreviewDoc] = useState<VerifiedDocument | null>(null);

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
        <EntitySelect
          value={attachmentType}
          onChange={setAttachmentType}
          options={optionsFrom(DOCUMENT_TYPES, t)}
          placeholder={t("Document type")}
          className="h-9"
        />
        <label className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-[oklch(0.52_0.19_285)]">
          <Upload className="h-4 w-4" /> Upload file
          <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </div>
      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> :
        !data || data.length === 0 ? <EmptyState title={t("No documents")} description={t("Upload onboarding attachments above.")} /> : (
          <div className="card-elevated divide-y divide-border">
            {data.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 p-4">
                <button
                  type="button"
                  onClick={() => setPreviewDoc(d)}
                  className="min-w-0 flex-1 text-start transition-opacity hover:opacity-80"
                >
                  <div className="font-semibold">{d.file.fileName}</div>
                  <div className="text-xs text-muted-foreground">{documentTypeLabel(d.attachmentType)} · {d.file.mimeType}</div>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={d.verificationStatus ?? "pending"} />
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(d)}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
                  >
                    <Eye className="h-3.5 w-3.5" /> {t("View")}
                  </button>
                  <button onClick={() => verify(d.id, "verified")} className="rounded-md border border-success/40 px-2 py-1 text-xs text-success hover:bg-success/10">Verify</button>
                  <button onClick={() => verify(d.id, "rejected")} className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10">{t("Reject")}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      {previewDoc && <DocumentPreviewDialog doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}

function documentTypeLabel(type: string) {
  const found = DOCUMENT_TYPES.find((d) => d.value === type);
  return found ? t(found.labelKey) : type.replace(/_/g, " ");
}

function DocumentPreviewDialog({ doc, onClose }: { doc: VerifiedDocument; onClose: () => void }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isImage = doc.file.mimeType.startsWith("image/");

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const blob = await filesExtApi.fetchBlob(doc.file.id);
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || t("Failed to load document"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc.file.id]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pe-8">{doc.file.fileName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {documentTypeLabel(doc.attachmentType)} · {doc.file.mimeType}
        </p>
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {error && <p className="py-8 text-center text-sm text-destructive">{error}</p>}
        {objectUrl && isImage && (
          <img
            src={objectUrl}
            alt={doc.file.fileName}
            className="mx-auto max-h-[65vh] w-full rounded-lg border border-border object-contain"
          />
        )}
        {objectUrl && !isImage && (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
            <p>{t("Preview not available for this file type.")}</p>
            <a
              href={objectUrl}
              download={doc.file.fileName}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              {t("Download")}
            </a>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          {objectUrl && (
            <a
              href={objectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4" /> {t("Open in new tab")}
            </a>
          )}
          <button type="button" onClick={onClose} className="rounded-md bg-muted px-4 py-2 text-sm font-semibold hover:bg-muted/80">
            {t("Close")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UsersTab({ companyId }: { companyId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["company-users", companyId], queryFn: () => companiesApi.users(companyId).catch(() => [] as never[]) });
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!data || data.length === 0) return <EmptyState title={t("No company users")} description={t("Corporate users will list here.")} />;
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
  const allFeatures = useQuery({ queryKey: ["features"], queryFn: featuresApi.list });
  const overrides = useQuery({ queryKey: ["company-features", companyId], queryFn: () => companiesApi.getFeatures(companyId) });
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const enabledByFeatureId = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of overrides.data ?? []) map.set(row.featureId, row.isEnabled);
    return map;
  }, [overrides.data]);

  async function save() {
    try {
      await companiesApi.updateFeatures(companyId, {
        features: Object.entries(pending).map(([featureId, isEnabled]) => ({ featureId, isEnabled })),
      });
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["company-features", companyId] });
      setPending({});
    } catch (e) { toast.error((e as Error).message); }
  }

  if (allFeatures.isLoading || overrides.isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }
  if (!allFeatures.data || allFeatures.data.length === 0) {
    return <EmptyState title={t("No feature overrides")} description={t("This company inherits global feature defaults.")} />;
  }

  return (
    <div className="space-y-3">
      <div className="card-elevated divide-y divide-border">
        {allFeatures.data.map((f) => {
          const cur = pending[f.id] ?? enabledByFeatureId.get(f.id) ?? f.isGlobalDefaultEnabled;
          return (
            <div key={f.id} className="flex items-center justify-between p-4">
              <div><div className="font-semibold">{f.name}</div><code className="text-xs text-muted-foreground">{f.code}</code></div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={cur} onChange={(e) => setPending((p) => ({ ...p, [f.id]: e.target.checked }))} /> Enabled
              </label>
            </div>
          );
        })}
      </div>
      {Object.keys(pending).length > 0 && <button onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save changes</button>}
    </div>
  );
}

function ModulesTab({ companyId }: { companyId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["company-modules", companyId], queryFn: () => companiesApi.getModules(companyId) });
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!data || data.length === 0) return <EmptyState title={t("No module overrides")} />;
  return (
    <div className="card-elevated divide-y divide-border">
      {data.map((m) => (
        <div key={m.id} className="flex items-center justify-between p-4">
          <div>
            <div className="font-semibold">{m.moduleCode}</div>
            <code className="text-xs text-muted-foreground">{m.moduleId}</code>
          </div>
          <StatusBadge tone={m.isEnabled ? "success" : "muted"}>{m.isEnabled ? "Enabled" : "Disabled"}</StatusBadge>
        </div>
      ))}
    </div>
  );
}

function SettingsTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["company-settings", companyId], queryFn: () => companiesApi.getSettings(companyId) });
  const [edits, setEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data?.settings) {
      const seed: Record<string, string> = {};
      for (const [k, v] of Object.entries(data.settings)) seed[k] = JSON.stringify(v);
      setEdits(seed);
    }
  }, [data]);

  async function save() {
    const settings: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(edits)) {
      try { settings[k] = JSON.parse(v); } catch { settings[k] = v; }
    }
    try {
      await companiesApi.updateSettings(companyId, settings);
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["company-settings", companyId] });
    } catch (e) { toast.error((e as Error).message); }
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!data || Object.keys(data.settings).length === 0) {
    return <EmptyState title={t("No overrides")} description={t("Company inherits all global settings.")} />;
  }

  return (
    <div className="space-y-3">
      <div className="card-elevated divide-y divide-border">
        {Object.entries(data.settings).map(([key, value]) => (
          <div key={key} className="grid grid-cols-2 gap-4 p-4">
            <code className="text-sm font-semibold">{key}</code>
            <textarea
              value={edits[key] ?? JSON.stringify(value)}
              onChange={(e) => setEdits((s) => ({ ...s, [key]: e.target.value }))}
              className="min-h-[38px] w-full rounded-md border border-border bg-card p-2 font-mono text-xs"
            />
          </div>
        ))}
      </div>
      <button onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Save")}</button>
    </div>
  );
}
