import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";
import { settingsApi } from "@/services/apiClient";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/settings")({ component: SettingsPage });

const HINTS = ["theme.primary_color", "ordering.default_vat_rate", "notification.order_confirmation.channel"];

function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["global-settings"], queryFn: settingsApi.getGlobal });
  const [edits, setEdits] = useState<Record<string, string>>({});
  useEffect(() => { if (data) { const seed: Record<string, string> = {}; for (const [k, v] of Object.entries(data.settings)) seed[k] = JSON.stringify(v.value); setEdits(seed); } }, [data]);

  async function save() {
    const settings: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(edits)) {
      try { settings[k] = JSON.parse(v); } catch { settings[k] = v; }
    }
    try { await settingsApi.updateGlobal(settings); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["global-settings"] }); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <PageHeader title={t("Platform Settings")} description={t("Global configuration applied across all companies.")}
        actions={<button onClick={save} className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Save className="h-4 w-4" /> Save all</button>} />
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> :
       !data || Object.keys(data.settings).length === 0 ? (
        <EmptyState title={t("No global settings loaded")}
          description={`Known keys: ${HINTS.join(", ")}. Settings from /api/v1/dashboard/settings/global will render here.`} />
       ) : (
        <div className="card-elevated divide-y divide-border">
          {Object.entries(data.settings).map(([key, entry]) => (
            <div key={key} className="grid grid-cols-1 gap-2 p-5 md:grid-cols-[1fr,1fr,auto]">
              <div>
                <code className="text-sm font-semibold text-foreground">{entry.key}</code>
                {entry.description && <div className="mt-1 text-xs text-muted-foreground">{entry.description}</div>}
              </div>
              <div>
                <textarea value={edits[key] ?? ""} onChange={(e) => setEdits((s) => ({ ...s, [key]: e.target.value }))}
                  disabled={!entry.isOverridable}
                  className="min-h-[38px] w-full rounded-md border border-border bg-card p-2 font-mono text-xs disabled:opacity-60" />
              </div>
              <StatusBadge tone={entry.isOverridable ? "info" : "muted"}>{entry.isOverridable ? "Overridable" : "Locked"}</StatusBadge>
            </div>
          ))}
        </div>
       )}
    </>
  );
}
