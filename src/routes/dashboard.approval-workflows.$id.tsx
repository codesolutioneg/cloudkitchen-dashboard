import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { approvalWorkflowsApi, approvalWorkflowsExtApi } from "@/services/apiClient";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

function cleanWorkflowName(name: string) {
  return name.replace(/\s+\d{10,}$/, "").trim();
}

function entityTypeLabel(entityType: string) {
  const key = `approvalEntity.${entityType}`;
  const translated = t(key);
  return translated !== key ? translated : entityType;
}

export const Route = createFileRoute("/dashboard/approval-workflows/$id")({ component: ApprovalWorkflowDetail });

function ApprovalWorkflowDetail() {
  const { id } = Route.useParams();
  const wf = useQuery({ queryKey: ["approval-workflow", id], queryFn: () => approvalWorkflowsExtApi.get(id).catch(() => null) });

  return (
    <>
      <PageHeader
        title={wf.data ? cleanWorkflowName(wf.data.name) : t("Approval Workflows")}
        description={wf.data ? `${entityTypeLabel(wf.data.entityType)} · ${wf.data.stepCount ?? 0} ${t("Steps")}` : id}
        breadcrumbs={[{ label: t("Dashboard"), to: "/dashboard" }, { label: t("Approval Workflows"), to: "/dashboard/approval-workflows" }, { label: wf.data ? cleanWorkflowName(wf.data.name) : id }]}
        actions={<Link to="/dashboard/approval-workflows" className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><ArrowLeft className="h-4 w-4" /> {t("Back")}</Link>}
      />
      <Tabs defaultValue="steps">
        <TabsList className="mb-4">
          <TabsTrigger value="steps">{t("Steps")}</TabsTrigger>
        </TabsList>
        <TabsContent value="steps"><StepsTab wfId={id} /></TabsContent>
      </Tabs>
    </>
  );
}

function StepsTab({ wfId }: { wfId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["apw-steps", wfId], queryFn: () => approvalWorkflowsApi.listSteps(wfId).catch(() => [] as never[]) });
  const [name, setName] = useState(""); const [approverType, setApproverType] = useState("role");
  async function add() {
    if (!name) return;
    try { await approvalWorkflowsApi.createStep(wfId, { name, approverType, stepOrder: (data?.length ?? 0) + 1 }); toast.success("Added"); setName(""); qc.invalidateQueries({ queryKey: ["apw-steps", wfId] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  if (isLoading) return <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />;
  return (
    <div className="space-y-3">
      <div className="card-elevated flex flex-wrap gap-2 p-4">
        <input placeholder={t("Step name")} value={name} onChange={(e) => setName(e.target.value)} className="h-9 flex-1 min-w-[160px] rounded-md border border-border bg-card px-2 text-sm" />
        <select value={approverType} onChange={(e) => setApproverType(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="role">role</option><option value="user">user</option><option value="department">department</option>
        </select>
        <button onClick={add} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Add step</button>
      </div>
      {!data || data.length === 0 ? <EmptyState title={t("No steps")} /> : (
        <div className="card-elevated divide-y divide-border">
          {data.sort((a, b) => a.stepOrder - b.stepOrder).map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 text-sm">
              <div><span className="mr-2 rounded bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">#{s.stepOrder}</span> {s.name}</div>
              <span className="text-xs text-muted-foreground">{s.approverType}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
