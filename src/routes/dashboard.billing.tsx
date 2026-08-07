import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EntitySelect } from "@/components/app/EntitySelect";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { billingApi, companiesApi, type AdminInvoice } from "@/services/apiClient";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/billing")({ component: BillingPage });

const TONE: Record<string, "success" | "warning" | "muted" | "info"> = {
  paid: "success",
  part_paid: "warning",
  overdue: "warning",
  issued: "info",
  draft: "muted",
  void: "muted",
};

const PAYMENT_MODES = ["per_order", "weekly_invoice", "monthly_invoice", "plan_instalments"];

function BillingPage() {
  return (
    <>
      <PageHeader
        title={t("Billing")}
        description={t("Invoices, payment terms and instalment approvals.")}
      />
      <Tabs defaultValue="invoices">
        <TabsList className="mb-4">
          <TabsTrigger value="invoices">{t("Invoices")}</TabsTrigger>
          <TabsTrigger value="terms">{t("Payment terms")}</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices">
          <InvoicesTab />
        </TabsContent>
        <TabsContent value="terms">
          <TermsTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

function InvoicesTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<AdminInvoice | null>(null);

  const q = useQuery({
    queryKey: ["invoices", status],
    queryFn: () => billingApi.listInvoices({ status: status || undefined }),
  });

  const overdue = useMutation({
    mutationFn: billingApi.markOverdue,
    onSuccess: (r) => {
      toast.success(`${t("Marked overdue")}: ${r.invoicesMarked}`);
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) =>
      billingApi.decideInstalment(id, decision),
    onSuccess: (inv) => {
      toast.success(t("Saved"));
      setSelected(inv);
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cols: Column<AdminInvoice>[] = [
    {
      key: "num",
      header: t("Invoice"),
      cell: (r) => <span className="font-semibold">{r.invoiceNumber}</span>,
    },
    { key: "company", header: t("Company"), cell: (r) => r.companyName ?? r.companyId },
    {
      key: "period",
      header: t("Period"),
      cell: (r) => (r.periodStart ? `${r.periodStart} → ${r.periodEnd}` : "-"),
    },
    { key: "due", header: t("Due"), cell: (r) => r.dueAt ?? "-" },
    {
      key: "total",
      header: t("Total"),
      cell: (r) => (
        <b>
          {r.totalAmount} {r.currency}
        </b>
      ),
    },
    {
      key: "outstanding",
      header: t("Outstanding"),
      cell: (r) => (
        <span className={Number(r.outstandingAmount) > 0 ? "font-semibold text-destructive" : ""}>
          {r.outstandingAmount}
        </span>
      ),
    },
    {
      key: "status",
      header: t("Status"),
      cell: (r) => <StatusBadge tone={TONE[r.status] ?? "muted"}>{t(r.status)}</StatusBadge>,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm"
        >
          <option value="">{t("All statuses")}</option>
          {["issued", "part_paid", "paid", "overdue"].map((s) => (
            <option key={s} value={s}>
              {t(s)}
            </option>
          ))}
        </select>
        <button
          onClick={() => overdue.mutate()}
          className="rounded-[10px] border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
        >
          {t("Mark overdue")}
        </button>
      </div>

      <DataTable
        columns={cols}
        rows={q.data}
        loading={q.isLoading}
        onRowClick={(r) => setSelected(r)}
        emptyTitle={t("No invoices yet")}
        emptyDescription={t("Generate one from a company's delivered orders.")}
      />

      {selected && (
        <div className="card-elevated p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold">{selected.invoiceNumber}</h3>
            <button
              onClick={() => setSelected(null)}
              className="text-sm text-muted-foreground hover:underline"
            >
              {t("Close")}
            </button>
          </div>
          <ul className="divide-y divide-border text-sm">
            {selected.lines.map((l) => (
              <li key={l.id} className="flex justify-between py-2">
                <span>{l.description}</span>
                <b>{l.lineTotal}</b>
              </li>
            ))}
          </ul>
          {selected.instalments.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-bold uppercase text-muted-foreground">
                {t("Instalments")}
              </div>
              <ul className="mt-2 divide-y divide-border text-sm">
                {selected.instalments.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      #{i.sequence} · {i.dueAt} · <b>{i.amount}</b>
                    </span>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={i.status === "paid" ? "success" : "warning"}>
                        {t(i.status)}
                      </StatusBadge>
                      {i.status !== "paid" && (
                        <>
                          <button
                            onClick={() => decide.mutate({ id: i.id, decision: "approved" })}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            {t("Approve")}
                          </button>
                          <button
                            onClick={() => decide.mutate({ id: i.id, decision: "rejected" })}
                            className="text-xs font-semibold text-destructive hover:underline"
                          >
                            {t("Reject")}
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TermsTab() {
  const qc = useQueryClient();
  const [companyId, setCompanyId] = useState("");
  const companies = useQuery({
    queryKey: ["companies-picker"],
    queryFn: () => companiesApi.list({ page: 1, pageSize: 100, approvalStatus: "approved" }),
  });

  const terms = useQuery({
    queryKey: ["billing-terms", companyId],
    queryFn: () => billingApi.getTerms(companyId),
    enabled: Boolean(companyId),
  });

  const [form, setForm] = useState({
    paymentMode: "per_order",
    netDays: 0,
    creditLimit: "0",
    poReference: "",
  });

  const save = useMutation({
    mutationFn: () =>
      billingApi.setTerms(companyId, {
        paymentMode: form.paymentMode,
        netDays: Number(form.netDays),
        creditLimit: form.creditLimit,
        poReference: form.poReference || null,
      }),
    onSuccess: () => {
      toast.success(t("Terms saved"));
      qc.invalidateQueries({ queryKey: ["billing-terms", companyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generate = useMutation({
    mutationFn: (body: { periodStart: string; periodEnd: string }) =>
      billingApi.generateInvoice(companyId, body),
    onSuccess: () => {
      toast.success(t("Invoice created"));
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [period, setPeriod] = useState({ periodStart: "", periodEnd: "" });

  const options = useMemo(
    () => (companies.data?.items ?? []).map((c) => ({ value: c.id, label: c.legalName })),
    [companies.data],
  );

  return (
    <div className="space-y-4">
      <div className="card-elevated space-y-3 p-5">
        <EntitySelect
          value={companyId}
          onChange={(v) => {
            setCompanyId(v);
            setForm({ paymentMode: "per_order", netDays: 0, creditLimit: "0", poReference: "" });
          }}
          options={options}
          placeholder={t("Select company…")}
          disabled={companies.isLoading}
        />

        {companyId && terms.data && (
          <p className="text-xs text-muted-foreground">
            {t("Current")}: {t(terms.data.paymentMode)} · {t("net")} {terms.data.netDays} ·{" "}
            {t("Credit limit")} {terms.data.creditLimit}
          </p>
        )}

        {companyId && (
          <>
            <div className="grid gap-2 sm:grid-cols-4">
              <select
                value={form.paymentMode}
                onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
                className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm"
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {t(m)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={form.netDays}
                onChange={(e) => setForm({ ...form, netDays: Number(e.target.value) })}
                placeholder={t("Net days")}
                className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm"
              />
              <input
                value={form.creditLimit}
                onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                placeholder={t("Credit limit")}
                className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm"
              />
              <input
                value={form.poReference}
                onChange={(e) => setForm({ ...form, poReference: e.target.value })}
                placeholder={t("PO reference")}
                className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm"
              />
            </div>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {t("Save terms")}
            </button>
          </>
        )}
      </div>

      {companyId && (
        <div className="card-elevated space-y-3 p-5">
          <h3 className="text-base font-semibold">{t("Generate an invoice")}</h3>
          <p className="text-sm text-muted-foreground">
            {t(
              "Every delivered order in the period that is not already invoiced goes on one invoice.",
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={period.periodStart}
              onChange={(e) => setPeriod({ ...period, periodStart: e.target.value })}
              className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm"
            />
            <input
              type="date"
              value={period.periodEnd}
              onChange={(e) => setPeriod({ ...period, periodEnd: e.target.value })}
              className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm"
            />
            <button
              onClick={() => generate.mutate(period)}
              disabled={!period.periodStart || !period.periodEnd || generate.isPending}
              className="rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {t("Generate")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
