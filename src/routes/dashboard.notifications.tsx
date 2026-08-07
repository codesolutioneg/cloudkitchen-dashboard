import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EntitySelect } from "@/components/app/EntitySelect";
import { notificationsApi } from "@/services/apiClient";
import type { NotificationTemplate } from "@/types/api";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import {
  LANGUAGES,
  NOTIFICATION_CHANNELS,
  TEMPLATE_PRESETS,
  optionsFrom,
} from "@/lib/systemOptions";

export const Route = createFileRoute("/dashboard/notifications")({ component: NotificationsPage });

const CHANNEL_LABEL: Record<string, string> = {
  in_app: "In-app",
  push: "Push",
  email: "Email",
  sms: "SMS",
};

function isJunkTemplate(tpl: NotificationTemplate) {
  const code = tpl.code.toLowerCase();
  const subject = (tpl.subjectTemplate ?? "").toLowerCase();
  return (
    code.startsWith("e2e_") ||
    code.startsWith("test_") ||
    subject.includes("e2e") ||
    /^alert$/i.test(tpl.subjectTemplate ?? "")
  );
}

function humanTemplateName(code: string) {
  const found = TEMPLATE_PRESETS.find((p) => p.value === code);
  return found ? t(found.labelKey) : code.replaceAll("_", " ");
}

function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["notification-templates"], queryFn: notificationsApi.list });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [form, setForm] = useState({
    code: "order_confirmation",
    channel: "in_app",
    subjectTemplate: "",
    bodyTemplate: "",
    languageCode: "ar",
  });

  const cleanRows = useMemo(
    () => (data ?? []).filter((row) => !isJunkTemplate(row)),
    [data],
  );

  function openNew() {
    setEditing(null);
    setForm({
      code: "order_confirmation",
      channel: "in_app",
      subjectTemplate: t("Order confirmed"),
      bodyTemplate: t("Your order {{orderNumber}} for {{companyName}} is confirmed. Total {{totalAmount}}."),
      languageCode: "ar",
    });
    setOpen(true);
  }

  function openEdit(row: NotificationTemplate) {
    setEditing(row);
    setForm({
      code: row.code,
      channel: row.channel,
      subjectTemplate: row.subjectTemplate ?? "",
      bodyTemplate: row.bodyTemplate,
      languageCode: row.languageCode,
    });
    setOpen(true);
  }

  async function save() {
    try {
      if (editing) await notificationsApi.update(editing.id, form);
      else await notificationsApi.create(form);
      toast.success(t("Saved"));
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["notification-templates"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const cols: Column<NotificationTemplate>[] = [
    {
      key: "name",
      header: t("Message"),
      cell: (r) => (
        <div>
          <div className="font-semibold">{humanTemplateName(r.code)}</div>
          <div className="text-xs text-muted-foreground">{r.subjectTemplate ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "channel",
      header: t("Channel"),
      cell: (r) => <StatusBadge tone="info">{t(CHANNEL_LABEL[r.channel] ?? r.channel)}</StatusBadge>,
    },
    {
      key: "lang",
      header: t("Language"),
      cell: (r) => (r.languageCode === "ar" ? t("Arabic") : t("English")),
    },
    {
      key: "body",
      header: t("Content"),
      cell: (r) => <span className="line-clamp-2 text-xs text-muted-foreground">{r.bodyTemplate}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title={t("Notifications")}
        description={t("Message templates sent to companies and users.")}
        actions={
          <button onClick={openNew} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" /> {t("New template")}
          </button>
        }
      />

      <div className="mb-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
        <div className="font-semibold">{t("Available fields you can use in the message:")}</div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs">
          {["orderNumber", "companyName", "fullName", "totalAmount", "deliveryAt"].map((v) => (
            <code key={v} className="rounded-md bg-card px-2 py-1 border border-border">{`{{${v}}}`}</code>
          ))}
        </div>
      </div>

      <DataTable
        columns={cols}
        rows={cleanRows}
        loading={isLoading}
        onRowClick={openEdit}
        emptyTitle={t("No templates yet")}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("Edit template") : t("New template")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">{t("Template")}</label>
              <EntitySelect
                value={form.code}
                onChange={(code) => setForm({ ...form, code })}
                placeholder={t("Select template…")}
                options={optionsFrom(TEMPLATE_PRESETS, t)}
                disabled={!!editing}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-sm font-semibold">{t("Channel")}</label>
                <EntitySelect
                  value={form.channel}
                  onChange={(channel) => setForm({ ...form, channel })}
                  options={optionsFrom(NOTIFICATION_CHANNELS, t)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">{t("Language")}</label>
                <EntitySelect
                  value={form.languageCode}
                  onChange={(languageCode) => setForm({ ...form, languageCode })}
                  options={optionsFrom(LANGUAGES, t)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">{t("Subject")}</label>
              <input
                value={form.subjectTemplate}
                onChange={(e) => setForm({ ...form, subjectTemplate: e.target.value })}
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">{t("Message body")}</label>
              <textarea
                value={form.bodyTemplate}
                onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })}
                className="min-h-[140px] w-full rounded-md border border-border bg-card p-3 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setOpen(false)} className="rounded-md border border-border px-4 py-2 text-sm font-semibold">{t("Cancel")}</button>
            <button onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              {editing ? t("Update") : t("Create")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
