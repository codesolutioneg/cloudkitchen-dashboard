import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { notificationsApi } from "@/services/apiClient";
import type { NotificationTemplate } from "@/types/api";

export const Route = createFileRoute("/dashboard/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["notification-templates"], queryFn: notificationsApi.list });
  const cols: Column<NotificationTemplate>[] = [
    { key: "code", header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
    { key: "channel", header: "Channel", cell: (r) => <StatusBadge tone="info">{r.channel}</StatusBadge> },
    { key: "lang", header: "Lang", cell: (r) => r.languageCode.toUpperCase() },
    { key: "subject", header: "Subject", cell: (r) => r.subjectTemplate ?? "—" },
    { key: "body", header: "Body", cell: (r) => <span className="line-clamp-1 text-xs text-muted-foreground">{r.bodyTemplate}</span> },
  ];
  return (
    <>
      <PageHeader title="Notifications" description="Templates for transactional messaging." />
      <div className="mb-3 rounded-xl border border-info/20 bg-info/5 p-3 text-xs text-info">
        Use variables like <code>{"{{orderNumber}}"}</code>, <code>{"{{companyName}}"}</code>, <code>{"{{fullName}}"}</code> in your templates.
      </div>
      <DataTable columns={cols} rows={data} loading={isLoading} emptyTitle="No templates yet" />
    </>
  );
}
