import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { catalogApi } from "@/services/apiClient";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/catalog/custom-products")({
  component: CustomProductsAdminPage,
});

function CustomProductsAdminPage() {
  const qc = useQueryClient();
  const [priceById, setPriceById] = useState<Record<string, string>>({});
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "">("pending");

  const q = useQuery({
    queryKey: ["custom-products", statusFilter || "all"],
    queryFn: () => catalogApi.listCustomProducts(statusFilter ? { status: statusFilter } : {}),
  });

  async function approve(id: string) {
    const basePrice = Number(priceById[id]);
    if (!basePrice || basePrice <= 0) {
      toast.error(t("Enter a valid EGP price"));
      return;
    }
    try {
      await catalogApi.approveCustomProduct(id, { basePrice, currency: "EGP" });
      toast.success(t("Approved"));
      qc.invalidateQueries({ queryKey: ["custom-products"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function confirmReject() {
    if (!rejectId) return;
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      toast.error(t("Rejection reason is required"));
      return;
    }
    try {
      await catalogApi.rejectCustomProduct(rejectId, { reason });
      toast.success(t("Rejected"));
      setRejectId(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["custom-products"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const items = q.data ?? [];

  return (
    <>
      <PageHeader
        title={t("Custom product requests")}
        description={t("Review company custom menu items, set pricing, or reject with a reason shown on the website.")}
        breadcrumbs={[
          { label: t("Dashboard"), to: "/dashboard" },
          { label: t("Catalog"), to: "/dashboard/catalog" },
          { label: t("Custom products") },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["pending", "approved", "rejected", ""] as const).map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
              statusFilter === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
            }`}
          >
            {s ? t(s === "pending" ? "Pending" : s === "approved" ? "Approved" : "Rejected") : t("All")}
          </button>
        ))}
      </div>

      <div className="card-elevated p-5">
        {q.isLoading ? (
          <p className="text-muted-foreground">{t("Loading…")}</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground">{t("No custom product requests in this filter.")}</p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.company?.tradeName ?? item.company?.legalName}
                    </div>
                    {item.description && <p className="mt-2 whitespace-pre-wrap text-sm">{item.description}</p>}
                  </div>
                  <StatusBadge status={item.approvalStatus}>{item.approvalStatus}</StatusBadge>
                </div>
                {item.approvalStatus === "pending" ? (
                  <div className="mt-4 flex flex-wrap items-end gap-2">
                    <label className="text-sm">
                      <span className="font-medium">{t("Price (EGP)")}</span>
                      <input
                        type="number"
                        min={1}
                        step="0.01"
                        value={priceById[item.id] ?? ""}
                        onChange={(e) => setPriceById((s) => ({ ...s, [item.id]: e.target.value }))}
                        className="mt-1 block h-10 w-40 rounded-md border border-border px-2"
                      />
                    </label>
                    <button
                      onClick={() => void approve(item.id)}
                      className="rounded-md bg-success px-4 py-2 text-sm font-semibold text-success-foreground"
                    >
                      {t("Approve")}
                    </button>
                    <button
                      onClick={() => {
                        setRejectId(item.id);
                        setRejectReason("");
                      }}
                      className="rounded-md border border-destructive px-4 py-2 text-sm font-semibold text-destructive"
                    >
                      {t("Reject")}
                    </button>
                  </div>
                ) : item.rejectionReason ? (
                  <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {t("Rejection reason")}: {item.rejectionReason}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!rejectId} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Reject custom product")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("This reason will be shown to the company on the website.")}</p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-border p-3 text-sm"
            placeholder={t("Explain why this custom item cannot be approved…")}
          />
          <DialogFooter>
            <button type="button" onClick={() => setRejectId(null)} className="rounded-md border border-border px-4 py-2 text-sm font-semibold">
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={() => void confirmReject()}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground"
            >
              {t("Reject")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
