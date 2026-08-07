import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";
import { QrCameraScanner } from "@/components/app/QrCameraScanner";
import { deliveryApi } from "@/services/apiClient";
import type { DeliveryOrderView } from "@/types/api";
import { Loader2, MapPin, Navigation, Phone, QrCode, ScanLine, Truck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/delivery")({ component: DeliveryPage });

function DeliveryPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-delivery-orders"], queryFn: deliveryApi.myOrders });
  const [qrOrder, setQrOrder] = useState<DeliveryOrderView | null>(null);
  const [confirmOrder, setConfirmOrder] = useState<DeliveryOrderView | null>(null);

  async function depart(id: string) {
    try {
      await deliveryApi.depart(id);
      toast.success(t("Departed — on the way"));
      qc.invalidateQueries({ queryKey: ["my-delivery-orders"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title={t("Delivery")}
        description={t("Your assigned trips. Depart first, then confirm with the customer QR.")}
      />
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState title={t("No assigned orders")} description={t("Orders will appear here when dispatch assigns you.")} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
          {data.map((o) => {
            const step = o.currentStepCode;
            const canDepart = step === "ready";
            const canConfirm = step === "out_for_delivery";
            const phone = o.deliveryAddress?.contactPhone;
            return (
              <div key={o.id} className="card-elevated overflow-hidden p-4 sm:p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-primary">{o.orderNumber}</div>
                    <div className="truncate text-sm text-muted-foreground">{o.companyName}</div>
                  </div>
                  <StatusBadge status={step ?? "assigned"} />
                </div>

                <div className="mb-3 text-sm">
                  <div className="text-xs uppercase text-muted-foreground">{t("Requested")}</div>
                  <div className="text-[13px] sm:text-sm">{new Date(o.requestedDeliveryAt).toLocaleString()}</div>
                </div>

                {o.deliveryAddress && (
                  <div className="mb-4 rounded-xl bg-muted/50 p-3 text-sm">
                    <div className="mb-1 flex items-center gap-2 font-semibold">
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      {t("Delivery address")}
                    </div>
                    <div className="leading-relaxed">
                      {o.deliveryAddress.addressLine1}
                      {o.deliveryAddress.addressLine2 ? `, ${o.deliveryAddress.addressLine2}` : ""}
                    </div>
                    <div className="text-muted-foreground">{o.deliveryAddress.city}, {o.deliveryAddress.countryCode}</div>
                    {o.deliveryAddress.contactName && (
                      <div className="mt-1">{o.deliveryAddress.contactName}</div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {phone && (
                        <a
                          href={`tel:${phone}`}
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold"
                        >
                          <Phone className="h-4 w-4" /> {phone}
                        </a>
                      )}
                      {o.deliveryAddress.latitude && o.deliveryAddress.longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${o.deliveryAddress.latitude},${o.deliveryAddress.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-primary"
                        >
                          <Navigation className="h-4 w-4" /> {t("Open in maps")}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    disabled={!canDepart}
                    onClick={() => depart(o.id)}
                    className={cn(
                      "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold",
                      "bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40",
                    )}
                  >
                    <Truck className="h-4 w-4" /> {t("Depart")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrOrder(o)}
                    className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted"
                  >
                    <QrCode className="h-4 w-4" /> {t("Show QR")}
                  </button>
                  <button
                    type="button"
                    disabled={!canConfirm}
                    onClick={() => setConfirmOrder(o)}
                    className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-success px-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ScanLine className="h-4 w-4" /> {t("Scan QR")}
                  </button>
                </div>
                {!canDepart && !canConfirm && (
                  <p className="mt-2 text-xs text-muted-foreground">{t("Waiting for kitchen / dispatch.")}</p>
                )}
                {canConfirm && (
                  <p className="mt-2 text-xs text-muted-foreground">{t("Ask the customer to show their QR, then scan or paste it.")}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {qrOrder && <ShowQrDialog order={qrOrder} onClose={() => setQrOrder(null)} />}
      {confirmOrder && (
        <ConfirmQrDialog
          order={confirmOrder}
          onClose={() => setConfirmOrder(null)}
          onDone={() => {
            setConfirmOrder(null);
            qc.invalidateQueries({ queryKey: ["my-delivery-orders"] });
          }}
        />
      )}
    </>
  );
}

function ShowQrDialog({ order, onClose }: { order: DeliveryOrderView; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [payload, setPayload] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qr = await deliveryApi.fulfillmentQr(order.id);
        if (cancelled) return;
        setPayload(qr.qrPayload);
        const url = await QRCode.toDataURL(qr.qrPayload, { width: 280, margin: 2 });
        if (!cancelled) setDataUrl(url);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [order.id]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>{t("Order QR")} · {order.orderNumber}</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          {loading && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {dataUrl && <img src={dataUrl} alt="QR" className="max-w-full rounded-xl border border-border bg-white p-2" />}
          <p className="text-center text-xs text-muted-foreground">
            {t("Show this code to the driver, or use it for testing confirmation.")}
          </p>
          {payload && (
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => { void navigator.clipboard.writeText(payload); toast.success(t("Copied")); }}
            >
              {t("Copy code")}
            </button>
          )}
        </div>
        <DialogFooter>
          <button onClick={onClose} className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-semibold">{t("Close")}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmQrDialog({
  order, onClose, onDone,
}: {
  order: DeliveryOrderView; onClose: () => void; onDone: () => void;
}) {
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(valueOverride?: string) {
    const value = (valueOverride ?? token).trim();
    if (value.length < 8) {
      toast.error(t("Enter or paste the customer QR code first"));
      return;
    }
    setSubmitting(true);
    try {
      await deliveryApi.confirmDelivery(order.id, value);
      toast.success(t("Delivery confirmed"));
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94dvh] w-[calc(100%-1rem)] overflow-y-auto p-4 sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle>{t("Confirm delivery")} · {order.orderNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("Ask the customer to show their QR, then scan or paste it.")}
          </p>

          <QrCameraScanner
            onScan={(value) => {
              setToken(value);
              toast.success(t("QR scanned"));
              void submit(value);
            }}
          />

          <div className="relative py-1 text-center text-xs text-muted-foreground">
            <span className="bg-background px-2">{t("or paste manually")}</span>
            <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-border" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">{t("QR code")}</label>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3">
              <ScanLine className="h-4 w-4 text-muted-foreground" />
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t("Paste QR code here")}
                className="h-12 flex-1 bg-transparent text-sm outline-none"
                dir="ltr"
                inputMode="text"
                autoComplete="off"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className="min-h-12 rounded-xl border border-border px-4 py-2 text-sm font-semibold">{t("Cancel")}</button>
          <button
            disabled={submitting}
            onClick={() => void submit()}
            className="min-h-12 rounded-xl bg-success px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t("Confirm delivery")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
