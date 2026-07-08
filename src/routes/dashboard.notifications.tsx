import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { notificationsApi } from "@/services/apiClient";
import type { NotificationTemplate } from "@/types/api";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["notification-templates"], queryFn: notificationsApi.list });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [form, setForm] = useState({ code: "", channel: "email", subjectTemplate: "", bodyTemplate: "", languageCode: "en" });

  function openNew() { setEditing(null); setForm({ code: "", channel: "email", subjectTemplate: "", bodyTemplate: "", languageCode: "en" }); setOpen(true); }
  function openEdit(t: NotificationTemplate) { setEditing(t); setForm({ code: t.code, channel: t.channel, subjectTemplate: t.subjectTemplate ?? "", bodyTemplate: t.bodyTemplate, languageCode: t.languageCode }); setOpen(true); }
  async function save() {
    try {
      if (editing) await notificationsApi.update(editing.id, form);
      else await notificationsApi.create(form);
      toast.success("Saved"); setOpen(false); qc.invalidateQueries({ queryKey: ["notification-templates"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  const cols: Column<NotificationTemplate>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "channel", header: "Channel", cell: (r) => <StatusBadge tone="info">{r.channel}</StatusBadge> },
    { key: "lang", header: "Lang", cell: (r) => r.languageCode.toUpperCase() },
    { key: "subject", header: "Subject", cell: (r) => r.subjectTemplate ?? "—" },
    { key: "body", header: "Body", cell: (r) => <span className="line-clamp-1 text-xs text-muted-foreground">{r.bodyTemplate}</span> },
  ];
  return (
    <>
      <PageHeader title={t("Notifications")} description={t("Templates for transactional messaging.")}
        actions={<button onClick={openNew} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New template</button>} />
      <div className="mb-3 rounded-xl border border-info/20 bg-info/5 p-3 text-xs text-info">
        Variables: <code>{"{{orderNumber}}"}</code>, <code>{"{{companyName}}"}</code>, <code>{"{{fullName}}"}</code>, <code>{"{{totalAmount}}"}</code>, <code>{"{{deliveryAt}}"}</code>
      </div>
      <DataTable columns={cols} rows={data} loading={isLoading} onRowClick={openEdit} emptyTitle={t("No templates yet")} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <input placeholder={t("Code")} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="h-10 rounded-md border border-border bg-card px-3 text-sm">
                <option value="email">email</option><option value="sms">sms</option><option value="push">push</option><option value="in_app">in_app</option>
              </select>
              <input placeholder={t("Language (en, ar)")} value={form.languageCode} onChange={(e) => setForm({ ...form, languageCode: e.target.value })} className="h-10 rounded-md border border-border bg-card px-3 text-sm" />
            </div>
            <input placeholder={t("Subject")} value={form.subjectTemplate} onChange={(e) => setForm({ ...form, subjectTemplate: e.target.value })} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
            <textarea placeholder="Body (supports {{variables}})" value={form.bodyTemplate} onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })} className="min-h-[140px] w-full rounded-md border border-border bg-card p-3 text-sm" />
          </div>
          <DialogFooter><button onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{editing ? "Update" : "Create"}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
