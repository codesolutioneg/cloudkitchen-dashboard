import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { ordersApi, workflowsApi, filesExtApi } from "@/services/apiClient";
import type { WorkflowStep, WorkflowTransition } from "@/types/api";
import { ArrowLeft, ArrowRight, Check, CreditCard, Download, Loader2, MessageSquare, Save, Send, X } from "lucide-react";
import { toast } from "sonner";
import { getLocale, t } from "@/lib/i18n";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/orders/$id")({ component: OrderDetailPage });

function OrderDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  useLocale();
  const rtl = getLocale() === "ar";
  const FlowArrow = rtl ? ArrowLeft : ArrowRight;
  const { data, isLoading } = useQuery({ queryKey: ["order", id], queryFn: () => ordersApi.get(id) });

  const workflows = useQuery({
    queryKey: ["order-workflows"],
    queryFn: () => workflowsApi.list({ workflowType: "order" }).catch(() => [] as never[]),
  });
  const orderWorkflow = workflows.data?.[0];
  const steps = useQuery({
    queryKey: ["wf-steps", orderWorkflow?.id],
    enabled: !!orderWorkflow?.id,
    queryFn: () => workflowsApi.listSteps(orderWorkflow!.id).catch(() => [] as never[]),
  });
  const transitions = useQuery({
    queryKey: ["wf-transitions", orderWorkflow?.id],
    enabled: !!orderWorkflow?.id,
    queryFn: () => workflowsApi.listTransitions(orderWorkflow!.id).catch(() => [] as never[]),
  });

  const [note, setNote] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [toStepId, setToStepId] = useState("");
  const [comment, setComment] = useState("");
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [editDeliveryAt, setEditDeliveryAt] = useState("");
  const [editFulfillment, setEditFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [savingOrder, setSavingOrder] = useState(false);

  const payment = data?.payment ?? null;

  useEffect(() => {
    if (!data) return;
    const d = new Date(data.requestedDeliveryAt);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditDeliveryAt(local);
    setEditFulfillment(data.fulfillmentType === "pickup" ? "pickup" : "delivery");
  }, [data?.id, data?.requestedDeliveryAt, data?.fulfillmentType]);

  useEffect(() => {
    let objectUrl: string | null = null;
    const proofId = payment?.proofAttachmentId;
    if (!proofId) {
      setProofPreviewUrl(null);
      return;
    }
    void filesExtApi.fetchBlob(proofId).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      setProofPreviewUrl(objectUrl);
    }).catch(() => setProofPreviewUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [payment?.proofAttachmentId]);

  const orderedSteps = useMemo(() => {
    const list = [...(steps.data ?? [])];
    list.sort((a, b) => a.sortOrder - b.sortOrder);
    return list;
  }, [steps.data]);

  const stepById = useMemo(
    () => new Map(orderedSteps.map((s) => [s.id, s])),
    [orderedSteps],
  );

  const nextSteps = useMemo(() => {
    const currentId = data?.workflow?.currentStepId;
    if (!currentId) return [] as WorkflowStep[];
    const allowedIds = new Set(
      ((transitions.data ?? []) as WorkflowTransition[])
        .filter((tr) => tr.fromStepId === currentId && tr.triggerType === "manual")
        .map((tr) => tr.toStepId),
    );
    return orderedSteps
      .filter((s) => allowedIds.has(s.id))
      .filter((s) => {
        const cur = data?.workflow?.currentStepCode;
        if (cur === "payment_pending_review" && ["payment_approved", "kitchen_accepted"].includes(s.code)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [data?.workflow?.currentStepCode, transitions.data, orderedSteps]);

  useEffect(() => {
    if (nextSteps.length === 1) setToStepId(nextSteps[0]!.id);
    else if (!nextSteps.some((s) => s.id === toStepId)) setToStepId("");
  }, [nextSteps, toStepId]);

  async function saveOrderEdits() {
    if (!editDeliveryAt) {
      toast.error(t("Select delivery date and time"));
      return;
    }
    setSavingOrder(true);
    try {
      await ordersApi.update(id, {
        requestedDeliveryAt: new Date(editDeliveryAt).toISOString(),
        fulfillmentType: editFulfillment,
      });
      toast.success(t("Order updated"));
      qc.invalidateQueries({ queryKey: ["order", id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingOrder(false);
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    try {
      await ordersApi.addNote(id, { note, isInternal });
      toast.success(t("Note added"));
      setNote("");
      qc.invalidateQueries({ queryKey: ["order", id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function transition(stepId?: string) {
    const target = stepId || toStepId;
    if (!target) return;
    try {
      await ordersApi.transition(id, { toStepId: target, comment: comment || undefined });
      toast.success(t("Moved to next step"));
      setComment("");
      setToStepId("");
      qc.invalidateQueries({ queryKey: ["order", id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function decide(level: number, decision: "approved" | "rejected") {
    const c = decision === "rejected" ? (prompt(t("Reason?")) ?? undefined) : undefined;
    try {
      await ordersApi.decideApproval(id, level, { decision, comment: c });
      toast.success(decision === "approved" ? t("Approved") : t("Rejected"));
      qc.invalidateQueries({ queryKey: ["order", id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function approvePayment() {
    try {
      await ordersApi.approvePayment(id, { comment: comment || undefined });
      toast.success(t("Payment approved"));
      setComment("");
      qc.invalidateQueries({ queryKey: ["order", id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function rejectPayment() {
    const reason = prompt(t("Reason?")) ?? undefined;
    try {
      await ordersApi.rejectPayment(id, { reason });
      toast.success(t("Payment rejected"));
      qc.invalidateQueries({ queryKey: ["order", id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function downloadReceipt() {
    try {
      const blob = await ordersApi.downloadReceipt(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${data?.orderNumber ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!data) {
    return <div className="py-24 text-center text-muted-foreground">{t("Order not found")}</div>;
  }

  const currentStepId = data.workflow?.currentStepId;
  const currentIdx = orderedSteps.findIndex((s) => s.id === currentStepId);
  const canEditOrder = !["delivered", "picked_up", "cancelled", "refunded"].includes(
    data.workflow?.currentStepCode ?? "",
  );

  return (
    <>
      <PageHeader
        title={`${t("Order")} ${data.orderNumber}`}
        description={`${data.fulfillmentType} · ${data.totalAmount} ${data.currency}`}
        breadcrumbs={[
          { label: t("Dashboard"), to: "/dashboard" },
          { label: t("Orders"), to: "/dashboard/orders" },
          { label: data.orderNumber },
        ]}
        actions={
          <Link
            to="/dashboard/orders"
            className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> {t("Back")}
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {canEditOrder && (
            <div className="card-elevated p-5">
              <h3 className="mb-3 font-semibold">{t("Edit order")}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{t("Change delivery time or pickup/delivery before the kitchen starts.")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-semibold">{t("Delivery date & time")}</span>
                  <input
                    type="datetime-local"
                    value={editDeliveryAt}
                    onChange={(e) => setEditDeliveryAt(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold">{t("Fulfillment")}</span>
                  <select
                    value={editFulfillment}
                    onChange={(e) => setEditFulfillment(e.target.value as "delivery" | "pickup")}
                    className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                  >
                    <option value="delivery">{t("Delivery")}</option>
                    <option value="pickup">{t("Pickup")}</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={() => void saveOrderEdits()}
                disabled={savingOrder}
                className="mt-4 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingOrder ? t("Loading…") : t("Save changes")}
              </button>
            </div>
          )}

          <div className="card-elevated p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="font-semibold">{t("Workflow")}</h3>
              {data.workflow && (
                <StatusBadge status={data.workflow.currentStepCode}>
                  {data.workflow.currentStepName}
                </StatusBadge>
              )}
            </div>

            {/* Ordered pipeline */}
            <ol className={cn("mb-5 flex gap-2 overflow-x-auto pb-1", rtl && "flex-row-reverse")}>
              {orderedSteps
                .filter((s) => s.code !== "cancelled" && s.code !== "refunded")
                .map((s, i, arr) => {
                  const done = currentIdx >= 0 && s.sortOrder < (orderedSteps[currentIdx]?.sortOrder ?? 0);
                  const current = s.id === currentStepId;
                  return (
                    <li key={s.id} className="flex shrink-0 items-center gap-2">
                      <div
                        className={cn(
                          "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                          current && "border-primary bg-primary text-primary-foreground",
                          done && !current && "border-success/40 bg-success/10 text-success",
                          !done && !current && "border-border bg-muted/40 text-muted-foreground",
                        )}
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-[10px]">
                          {done ? <Check className="h-3 w-3" /> : i + 1}
                        </span>
                        {s.name}
                      </div>
                      {i < arr.length - 1 && <FlowArrow className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    </li>
                  );
                })}
            </ol>

            {data.workflow && (
              <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t("Entered step at")}</dt>
                  <dd>{new Date(data.workflow.enteredStepAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("SLA due")}</dt>
                  <dd>{data.workflow.slaDueAt ? new Date(data.workflow.slaDueAt).toLocaleString() : "—"}</dd>
                </div>
              </dl>
            )}

            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="mb-2 text-sm font-semibold">{t("Move to next step")}</div>
              <p className="mb-3 text-xs text-muted-foreground">
                {t("Only the next allowed steps are shown, in order.")}
              </p>
              {nextSteps.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("No further manual steps from here.")}</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {nextSteps.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => void transition(s.id)}
                        className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm active:scale-[0.99]"
                      >
                        <FlowArrow className="h-4 w-4" />
                        {s.name}
                      </button>
                    ))}
                  </div>
                  {nextSteps.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={toStepId}
                        onChange={(e) => setToStepId(e.target.value)}
                        className="h-10 flex-1 min-w-[160px] rounded-md border border-border bg-card px-2 text-sm"
                      >
                        <option value="">{t("Choose next step…")}</option>
                        {nextSteps.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <input
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={t("Comment (optional)")}
                        className="h-10 flex-1 min-w-[180px] rounded-md border border-border bg-card px-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => void transition()}
                        disabled={!toStepId}
                        className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {t("Transition")}
                      </button>
                    </div>
                  )}
                  {nextSteps.length === 1 && (
                    <input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={t("Comment (optional)")}
                      className="h-10 w-full rounded-md border border-border bg-card px-2 text-sm"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card-elevated p-5">
            <h3 className="mb-3 font-semibold">{t("Items")}</h3>
            {data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("No items.")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2">{t("Product")}</th>
                    <th className="pb-2">{t("Qty")}</th>
                    <th className="pb-2">{t("Unit")}</th>
                    <th className="pb-2 text-right">{t("Total")}</th>
                  </tr>
                </thead>
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
              <span className="text-muted-foreground">{t("Subtotal")}</span>
              <span className="text-right">{data.subtotalAmount}</span>
              <span className="text-muted-foreground">{t("Tax")}</span>
              <span className="text-right">{data.taxAmount}</span>
              <span className="text-muted-foreground">{t("Delivery")}</span>
              <span className="text-right">{data.deliveryFeeAmount}</span>
              <span className="text-muted-foreground">{t("Discount")}</span>
              <span className="text-right">−{data.discountAmount}</span>
              <span className="font-semibold">{t("Total")}</span>
              <span className="text-right font-bold">
                {data.totalAmount} {data.currency}
              </span>
            </div>
          </div>

          <div className="card-elevated p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <MessageSquare className="h-4 w-4" /> {t("Notes")}
            </h3>
            <div className="space-y-3">
              {data.notes.length === 0 && <p className="text-sm text-muted-foreground">{t("No notes.")}</p>}
              {data.notes.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-lg border p-3 text-sm ${n.isInternal ? "border-warning/30 bg-warning/5" : "border-border bg-card"}`}
                >
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{n.isInternal ? t("Internal") : t("Public")}</span>
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1">{n.note}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("Add a note…")}
                className="min-h-[70px] w-full rounded-[10px] border border-border bg-card p-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                  {t("Internal only")}
                </label>
                <button
                  onClick={() => void addNote()}
                  className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
                >
                  <Send className="h-4 w-4" /> {t("Post")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {payment && (
            <div className="card-elevated p-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <CreditCard className="h-4 w-4" /> {t("Payment")}
              </h3>
              <StatusBadge status={payment.status}>{payment.status.replace(/_/g, " ")}</StatusBadge>
              {payment.rejectionReason && (
                <p className="mt-2 text-sm text-destructive">{payment.rejectionReason}</p>
              )}
              {proofPreviewUrl && (
                <div className="mt-3 overflow-hidden rounded-lg border border-border">
                  <img src={proofPreviewUrl} alt={t("Payment proof")} className="max-h-64 w-full object-contain bg-muted" />
                </div>
              )}
              {payment.status === "pending_review" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => void approvePayment()}
                    className="flex items-center gap-2 rounded-md bg-success px-3 py-2 text-sm font-semibold text-success-foreground"
                  >
                    <Check className="h-4 w-4" /> {t("Approve payment")}
                  </button>
                  <button
                    onClick={() => void rejectPayment()}
                    className="flex items-center gap-2 rounded-md border border-destructive px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4" /> {t("Reject payment")}
                  </button>
                </div>
              )}
              {payment.status === "approved" && (
                <button
                  onClick={() => void downloadReceipt()}
                  className="mt-4 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
                >
                  <Download className="h-4 w-4" /> {t("Download receipt")}
                </button>
              )}
            </div>
          )}

          <div className="card-elevated p-5">
            <h3 className="mb-3 font-semibold">{t("Timeline")}</h3>
            {data.statusHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("No history.")}</p>
            ) : (
              <ol className="space-y-3">
                {data.statusHistory.map((h, i) => (
                  <li key={i} className="border-l-2 border-primary/30 pl-3">
                    <StatusBadge status={h.statusCode}>
                      {stepById.get(
                        orderedSteps.find((s) => s.code === h.statusCode)?.id ?? "",
                      )?.name ?? h.statusCode}
                    </StatusBadge>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(h.changedAt).toLocaleString()}
                    </div>
                    {h.comment && <div className="mt-1 text-sm">{h.comment}</div>}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="card-elevated p-5">
            <h3 className="mb-3 font-semibold">{t("Approvals")}</h3>
            {data.approvals.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("No approvals required.")}</p>
            ) : (
              data.approvals.map((a) => (
                <div
                  key={a.approvalLevel}
                  className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-0"
                >
                  <span className="text-sm">
                    {t("Level")} {a.approvalLevel}
                  </span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.status} />
                    {a.status === "pending" && (
                      <>
                        <button
                          onClick={() => void decide(a.approvalLevel, "approved")}
                          className="rounded-md bg-success p-1 text-white hover:opacity-90"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => void decide(a.approvalLevel, "rejected")}
                          className="rounded-md bg-destructive p-1 text-white hover:opacity-90"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
