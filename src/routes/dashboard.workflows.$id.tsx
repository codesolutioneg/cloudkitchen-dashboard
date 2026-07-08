import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { workflowsApi, workflowsExtApi } from "@/services/apiClient";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/workflows/$id")({ component: WorkflowBuilder });

function WorkflowBuilder() {
  const { id } = Route.useParams();
  const wf = useQuery({ queryKey: ["workflow", id], queryFn: () => workflowsExtApi.get(id).catch(() => null) });

  if (wf.isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <>
      <PageHeader
        title={wf.data?.name ?? "Workflow"} description={wf.data?.code ?? id}
        breadcrumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Workflows", to: "/dashboard/workflows" }, { label: wf.data?.name ?? id }]}
        actions={<Link to="/dashboard/workflows" className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><ArrowLeft className="h-4 w-4" /> Back</Link>}
      />
      <Tabs defaultValue="steps">
        <TabsList className="mb-4">
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger value="transitions">Transitions</TabsTrigger>
        </TabsList>
        <TabsContent value="steps"><StepsTab workflowId={id} /></TabsContent>
        <TabsContent value="transitions"><TransitionsTab workflowId={id} /></TabsContent>
      </Tabs>
    </>
  );
}

function StepsTab({ workflowId }: { workflowId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["wf-steps", workflowId], queryFn: () => workflowsApi.listSteps(workflowId).catch(() => [] as never[]) });
  const [form, setForm] = useState({ code: "", name: "", stepType: "intermediate" as "initial" | "intermediate" | "final", slaMinutes: "" });
  async function add() {
    if (!form.code || !form.name) return;
    try {
      await workflowsApi.createStep(workflowId, { code: form.code, name: form.name, stepType: form.stepType, slaMinutes: form.slaMinutes ? +form.slaMinutes : null, sortOrder: (data?.length ?? 0) + 1 });
      toast.success("Step added"); setForm({ code: "", name: "", stepType: "intermediate", slaMinutes: "" });
      qc.invalidateQueries({ queryKey: ["wf-steps", workflowId] });
    } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="space-y-3">
      <div className="card-elevated grid grid-cols-1 gap-2 p-4 sm:grid-cols-5">
        <input placeholder="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-9 rounded-md border border-border bg-card px-2 text-sm" />
        <input placeholder="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 rounded-md border border-border bg-card px-2 text-sm" />
        <select value={form.stepType} onChange={(e) => setForm({ ...form, stepType: e.target.value as never })} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="initial">initial</option><option value="intermediate">intermediate</option><option value="final">final</option>
        </select>
        <input placeholder="SLA min" value={form.slaMinutes} onChange={(e) => setForm({ ...form, slaMinutes: e.target.value })} className="h-9 rounded-md border border-border bg-card px-2 text-sm" />
        <button onClick={add} className="flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Add step</button>
      </div>
      {isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /> :
        !data || data.length === 0 ? <EmptyState title="No steps" description="Define the states of this workflow." /> : (
          <div className="card-elevated overflow-x-auto p-4">
            <div className="flex flex-wrap items-center gap-2">
              {data.sort((a, b) => a.sortOrder - b.sortOrder).map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="text-xs uppercase text-muted-foreground">{s.stepType}</div>
                    <div className="font-semibold">{s.name}</div>
                    <code className="text-xs text-muted-foreground">{s.code}</code>
                    {s.slaMinutes && <div className="mt-1 text-xs text-warning">SLA {s.slaMinutes}m</div>}
                  </div>
                  {i < data.length - 1 && <span className="text-muted-foreground">→</span>}
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}

function TransitionsTab({ workflowId }: { workflowId: string }) {
  const qc = useQueryClient();
  const steps = useQuery({ queryKey: ["wf-steps", workflowId], queryFn: () => workflowsApi.listSteps(workflowId).catch(() => [] as never[]) });
  const { data, isLoading } = useQuery({ queryKey: ["wf-transitions", workflowId], queryFn: () => workflowsApi.listTransitions(workflowId).catch(() => [] as never[]) });
  const [fromStepId, setFrom] = useState(""); const [toStepId, setTo] = useState(""); const [trig, setTrig] = useState<"manual" | "automatic" | "scheduled">("manual");
  async function add() {
    if (!toStepId) return;
    try { await workflowsApi.createTransition(workflowId, { fromStepId: fromStepId || null, toStepId, triggerType: trig }); toast.success("Transition added"); qc.invalidateQueries({ queryKey: ["wf-transitions", workflowId] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  const nameOf = (id: string | null) => id ? steps.data?.find((s) => s.id === id)?.name ?? id.slice(0, 8) : "∅";
  return (
    <div className="space-y-3">
      <div className="card-elevated grid grid-cols-1 gap-2 p-4 sm:grid-cols-4">
        <select value={fromStepId} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="">(any / start)</option>
          {steps.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={toStepId} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="">To step…</option>
          {steps.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={trig} onChange={(e) => setTrig(e.target.value as never)} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="manual">manual</option><option value="automatic">automatic</option><option value="scheduled">scheduled</option>
        </select>
        <button onClick={add} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Add transition</button>
      </div>
      {isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /> :
        !data || data.length === 0 ? <EmptyState title="No transitions" /> : (
          <div className="card-elevated divide-y divide-border">
            {data.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 text-sm">
                <div className="flex items-center gap-2"><span className="font-semibold">{nameOf(t.fromStepId)}</span> → <span className="font-semibold">{nameOf(t.toStepId)}</span></div>
                <StatusBadge tone="info">{t.triggerType}</StatusBadge>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
