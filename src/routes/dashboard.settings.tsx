import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";
import { settingsApi } from "@/services/apiClient";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/dashboard/settings")({ component: SettingsPage });

function SettingsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["global-settings"], queryFn: settingsApi.getGlobal });
  return (
    <>
      <PageHeader title="Platform Settings" description="Global configuration applied across all companies." />
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> :
       !data || Object.keys(data.settings).length === 0 ? (
        <EmptyState title="No global settings loaded"
          description="Settings from /api/v1/dashboard/settings/global will render here." />
       ) : (
        <div className="card-elevated divide-y divide-border">
          {Object.entries(data.settings).map(([key, entry]) => (
            <div key={key} className="grid grid-cols-1 gap-2 p-5 md:grid-cols-[1fr,1fr,auto]">
              <div>
                <code className="text-sm font-semibold text-foreground">{entry.key}</code>
                {entry.description && <div className="mt-1 text-xs text-muted-foreground">{entry.description}</div>}
              </div>
              <div className="text-sm">
                <div className="text-xs uppercase text-muted-foreground">Value</div>
                <code className="break-all">{JSON.stringify(entry.value)}</code>
              </div>
              <StatusBadge tone={entry.isOverridable ? "info" : "muted"}>
                {entry.isOverridable ? "Overridable" : "Locked"}
              </StatusBadge>
            </div>
          ))}
        </div>
       )}
    </>
  );
}
