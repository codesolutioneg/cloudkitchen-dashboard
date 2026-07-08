import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { ordersApi, workflowsApi } from "@/services/apiClient";
import { ArrowLeft, Loader2, Send, MessageSquare, Check, X } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/orders/$id")({ component: OrderDetailPage });

function OrderDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["order", id], queryFn: () => ordersApi.get(id) });

  // Fetch workflow steps for target step dropdown
  const workflows = useQuery({
    queryKey: ["order-workflows"], queryFn: () => workflowsApi.list({ workflowType: "order" }).catch(() => [] as never[]),
  });
  const orderWorkflow = workflows.data?.[0];
  const steps = useQuery({
    queryKey: ["wf-steps", orderWorkflow?.id], enabled: !!orderWorkflow?.id,
    queryFn: () => workflowsApi.listSteps(orderWorkflow!.id).catch(() => [] as never[]),
  });

  const [note, setNote] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [toStepId, setToStepId] = useState("");
  const [comment, setComment] = useState("");

  const availableSteps = useMemo(() => steps.data?.filter((s) => s.id !== data?.workflow?.currentStepId) ?? [], [steps.data, data]);

  async function addNote() {
    if (!note.trim()) return;
    try { await ordersApi.addNote(id, { note, isInternal }); toast.success("Note added"); setNote(""); qc.invalidateQueries({ queryKey: ["order", id] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function transition() {
    if (!toStepId) return;
    try { await ordersApi.transition(id, { toStepId, comment: comment || undefined }); toast.success("Transitioned"); setComment(""); setToStepId(""); qc.invalidateQueries({ queryKey: ["order", id] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function decide(level: number, decision: "approved" | "rejected") {
    const c = decision === "rejected" ? (prompt("Reason?") ?? undefined) : undefined;
    try { await ordersApi.decideApproval(id, level, { decision, comment: c }); toast.success(`Approval ${decision}`); qc.invalidateQueries({ queryKey: ["order", id] }); }
    catch (e) { toast.error((e as Error).message); }
  }

  if (isLoading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return <div className="py-24 text-center text-muted-foreground">Order not found</div>;

  return (
    <>
      <PageHeader
        title={`Order ${data.orderNumber}`}
        description={`${data.fulfillmentType} · ${data.totalAmount} ${data.currency}`}
        breadcrumbs={[{ label: t("Dashboard"), to: "/dashboard" }, { label: t("Orders"), to: "/dashboard/orders" }, { label: data.orderNumber }]}
        actions={<Link to="/dashboard/orders" className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><ArrowLeft className="h-4 w-4" /> {t("Back")}</Link>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="card-elevated p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Workflow</h3>
              {data.workflow && <StatusBadge status={data.workflow.currentStepCode}>{data.workflow.currentStepName}</StatusBadge>}
            </div>
            {data.workflow && (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted-foreground">Entered step at</dt><dd>{new Date(data.workflow.enteredStepAt).toLocaleString()}</dd></div>
                <div><dt className="text-muted-foreground">SLA due</dt><dd>{data.workflow.slaDueAt ? new Date(data.workflow.slaDueAt).toLocaleString() : "—"}</dd></div>
              </dl>
            )}
            <div className="mt-4 flex flex-wrap gap-2 rounded-lg bg-muted/50 p-3">
              <select value={toStepId} onChange={(e) => setToStepId(e.target.value)} className="h-9 flex-1 min-w-[160px] rounded-md border border-border bg-card px-2 text-sm">
                <option value="">Choose target step…</option>
                {availableSteps.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("Comment (optional)")}
                className="h-9 flex-1 min-w-[180px] rounded-md border border-border bg-card px-2 text-sm" />
              <button onClick={transition} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-[oklch(0.52_0.19_285)]">{t("Transition")}</button>
            </div>
          </div>

          <div className="card-elevated p-5">
            <h3 className="mb-3 font-semibold">Items</h3>
            {data.items.length === 0 ? <p className="text-sm text-muted-foreground">No items.</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="pb-2">Product</th><th className="pb-2">Qty</th><th className="pb-2">Unit</th><th className="pb-2 text-right">Total</th></tr></thead>
                <tbody>
                  {data.items.map((it) => (
                    <tr key={it.id} className="border-t border-border">
                      <td className="py-2">{it.productNameSnapshot}</td>
                      <td className="py-2">×{it.quantity}</td>
                      <td className="py-2">{it.unitPriceSnapshot}</td>
                      <td className="py-2 text-right font-semibold">{it.lineTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">Subtotal</span><span className="text-right">{data.subtotalAmount}</span>
              <span className="text-muted-foreground">Tax</span><span className="text-right">{data.taxAmount}</span>
              <span className="text-muted-foreground">Delivery</span><span className="text-right">{data.deliveryFeeAmount}</span>
              <span className="text-muted-foreground">Discount</span><span className="text-right">−{data.discountAmount}</span>
              <span className="font-semibold">Total</span><span className="text-right font-bold">{data.totalAmount} {data.currency}</span>
            </div>
          </div>

          <div className="card-elevated p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4" /> Notes</h3>
            <div className="space-y-3">
              {data.notes.length === 0 && <p className="text-sm text-muted-foreground">No notes.</p>}
              {data.notes.map((n) => (
                <div key={n.id} className={`rounded-lg border p-3 text-sm ${n.isInternal ? "border-warning/30 bg-warning/5" : "border-border bg-card"}`}>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{n.isInternal ? "Internal" : "Public"}</span>
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1">{n.note}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Add a note…")}
                className="min-h-[70px] w-full rounded-[10px] border border-border bg-card p-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                  Internal only
                </label>
                <button onClick={addNote} className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-[oklch(0.52_0.19_285)]">
                  <Send className="h-4 w-4" /> {t("Post")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card-elevated p-5">
            <h3 className="mb-3 font-semibold">Timeline</h3>
            {data.statusHistory.length === 0 ? <p className="text-sm text-muted-foreground">No history.</p> : (
              <ol className="space-y-3">
                {data.statusHistory.map((h, i) => (
                  <li key={i} className="border-l-2 border-primary/30 pl-3">
                    <StatusBadge status={h.statusCode} />
                    <div className="mt-1 text-xs text-muted-foreground">{new Date(h.changedAt).toLocaleString()}</div>
                    {h.comment && <div className="mt-1 text-sm">{h.comment}</div>}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="card-elevated p-5">
            <h3 className="mb-3 font-semibold">{t("Approvals")}</h3>
            {data.approvals.length === 0 ? <p className="text-sm text-muted-foreground">No approvals required.</p> :
              data.approvals.map((a) => (
                <div key={a.approvalLevel} className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-0">
                  <span className="text-sm">Level {a.approvalLevel}</span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.status} />
                    {a.status === "pending" && (
                      <>
                        <button onClick={() => decide(a.approvalLevel, "approved")} className="rounded-md bg-success p-1 text-white hover:opacity-90"><Check className="h-3.5 w-3.5" /></button>
                        <button onClick={() => decide(a.approvalLevel, "rejected")} className="rounded-md bg-destructive p-1 text-white hover:opacity-90"><X className="h-3.5 w-3.5" /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}
