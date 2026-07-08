import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";
import { deliveryApi } from "@/services/apiClient";
import { Loader2, MapPin, Copy, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/delivery")({ component: DeliveryPage });

function DeliveryPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-delivery-orders"], queryFn: deliveryApi.myOrders });
  const [tokens, setTokens] = useState<Record<string, string>>({});

  async function depart(id: string) {
    try { await deliveryApi.depart(id); toast.success("Departed"); qc.invalidateQueries({ queryKey: ["my-delivery-orders"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function confirmDelivery(id: string) {
    const token = tokens[id];
    if (!token) { toast.error("Scan / paste QR token first"); return; }
    try { await deliveryApi.confirmDelivery(id, token); toast.success("Delivery confirmed"); qc.invalidateQueries({ queryKey: ["my-delivery-orders"] }); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <PageHeader title={t("Delivery")} description={t("Your assigned delivery orders.")} />
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> :
       !data || data.length === 0 ? <EmptyState title={t("No assigned orders")} description={t("Orders will appear here when dispatch assigns you.")} /> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.map((o) => (
            <div key={o.id} className="card-elevated p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-primary">{o.orderNumber}</div>
                  <div className="text-sm text-muted-foreground">{o.companyName}</div>
                </div>
                <StatusBadge status={o.currentStepCode ?? "assigned"} />
              </div>
              <div className="mb-3 text-sm">
                <div className="text-xs uppercase text-muted-foreground">Requested</div>
                <div>{new Date(o.requestedDeliveryAt).toLocaleString()}</div>
              </div>
              {o.deliveryAddress && (
                <div className="mb-4 rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="mb-1 flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4 text-primary" />Delivery address</div>
                  <div>{o.deliveryAddress.addressLine1}{o.deliveryAddress.addressLine2 ? `, ${o.deliveryAddress.addressLine2}` : ""}</div>
                  <div className="text-muted-foreground">{o.deliveryAddress.city}, {o.deliveryAddress.countryCode}</div>
                  {o.deliveryAddress.contactPhone && <div className="mt-1">{o.deliveryAddress.contactName} · {o.deliveryAddress.contactPhone}</div>}
                  {o.deliveryAddress.latitude && o.deliveryAddress.longitude && (
                    <button
                      onClick={() => { void navigator.clipboard.writeText(`${o.deliveryAddress?.latitude},${o.deliveryAddress?.longitude}`); toast.success("Coordinates copied"); }}
                      className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                    ><Copy className="h-3 w-3" /> {o.deliveryAddress.latitude},{o.deliveryAddress.longitude}</button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => depart(o.id)} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted">{t("Depart")}</button>
                <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-card px-2">
                  <ScanLine className="h-4 w-4 text-muted-foreground" />
                  <input placeholder={t("QR token")} value={tokens[o.id] ?? ""} onChange={(e) => setTokens((t) => ({ ...t, [o.id]: e.target.value }))}
                    className="h-9 flex-1 bg-transparent text-sm outline-none" />
                </div>
                <button onClick={() => confirmDelivery(o.id)} className="rounded-md bg-success px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">{t("Confirm delivery")}</button>
              </div>
            </div>
          ))}
        </div>
       )}
    </>
  );
}
