import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, TablePagination, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { companiesApi } from "@/services/apiClient";
import type { CompanySummary, ApprovalStatus } from "@/types/api";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

const TABS: Array<{ id: ApprovalStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "under_review", label: "Under review" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "resubmission_required", label: "Resubmission" },
];

export const Route = createFileRoute("/dashboard/companies")({
  component: CompaniesPage,
});

function CompaniesPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CompanySummary | null>(null);

  const query = useQuery({
    queryKey: ["companies", tab, page],
    queryFn: () => companiesApi.list({
      approvalStatus: tab === "all" ? undefined : tab,
      page, pageSize: 20,
    }),
  });

  const columns: Column<CompanySummary>[] = [
    { key: "legalName", header: "Company", cell: (r) => (
      <div>
        <div className="font-semibold">{r.legalName}</div>
        {r.tradeName && <div className="text-xs text-muted-foreground">{r.tradeName}</div>}
      </div>
    ) },
    { key: "contact", header: "Contact", cell: (r) => (
      <div className="text-sm">
        <div>{r.primaryEmail}</div>
        <div className="text-xs text-muted-foreground">{r.primaryPhone}</div>
      </div>
    ) },
    { key: "location", header: "Location", cell: (r) => `${r.city ?? "—"}, ${r.countryCode}` },
    { key: "approvalStatus", header: "Approval", cell: (r) => <StatusBadge status={r.approvalStatus} /> },
    { key: "createdAt", header: "Created", cell: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  const rows = query.data?.items;

  async function approve(id: string) {
    try { await companiesApi.approve(id); toast.success("Company approved"); query.refetch(); setSelected(null); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function reject(id: string) {
    const reason = prompt("Rejection reason (optional):") ?? undefined;
    try { await companiesApi.reject(id, reason); toast.success("Company rejected"); query.refetch(); setSelected(null); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <PageHeader title="Companies" description="Corporate clients and onboarding approval." />
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              tab === t.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >{t.label}</button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={query.isLoading}
        onRowClick={(r) => setSelected(r)}
        emptyTitle="No companies"
        emptyDescription="Corporate registrations will show here once submitted."
      />
      {query.data && query.data.totalItems > 0 && (
        <TablePagination
          page={query.data.page}
          pageSize={query.data.pageSize}
          totalItems={query.data.totalItems}
          onPageChange={setPage}
        />
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.legalName}</SheetTitle>
                <SheetDescription>Company details and approval actions.</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 px-4">
                <Field label="Trade name" value={selected.tradeName ?? "—"} />
                <Field label="Email" value={selected.primaryEmail} />
                <Field label="Phone" value={selected.primaryPhone} />
                <Field label="Location" value={`${selected.city ?? "—"}, ${selected.countryCode}`} />
                <Field label="Approval" value={<StatusBadge status={selected.approvalStatus} />} />
                <Field label="Status" value={<StatusBadge status={selected.status} tone="muted" />} />

                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Onboarding documents will list here (verify / reject each via /companies/{"{id}"}/documents/{"{attachmentId}"}/verify).
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => approve(selected.id)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-success px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                  ><Check className="h-4 w-4" /> Approve</button>
                  <button
                    onClick={() => reject(selected.id)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:opacity-90"
                  ><X className="h-4 w-4" /> Reject</button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="col-span-2 text-sm font-medium">{value}</div>
    </div>
  );
}
