import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, TablePagination, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { companiesApi } from "@/services/apiClient";
import type { CompanySummary, ApprovalStatus } from "@/types/api";

const TABS: Array<{ id: ApprovalStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "under_review", label: "Under review" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "resubmission_required", label: "Resubmission" },
];

export const Route = createFileRoute("/dashboard/companies")({ component: CompaniesPage });

function CompaniesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["companies", tab, page],
    queryFn: () => companiesApi.list({
      approvalStatus: tab === "all" ? undefined : tab,
      page, pageSize: 20,
    }),
  });

  const columns: Column<CompanySummary>[] = [
    { key: "legalName", header: "Company", cell: (r) => (
      <div><div className="font-semibold">{r.legalName}</div>{r.tradeName && <div className="text-xs text-muted-foreground">{r.tradeName}</div>}</div>
    ) },
    { key: "contact", header: "Contact", cell: (r) => (
      <div className="text-sm"><div>{r.primaryEmail}</div><div className="text-xs text-muted-foreground">{r.primaryPhone}</div></div>
    ) },
    { key: "location", header: "Location", cell: (r) => `${r.city ?? "—"}, ${r.countryCode}` },
    { key: "approvalStatus", header: "Approval", cell: (r) => <StatusBadge status={r.approvalStatus} /> },
    { key: "createdAt", header: "Created", cell: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <>
      <PageHeader title="Companies" description="Corporate clients and onboarding approval." />
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === t.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <DataTable columns={columns} rows={query.data?.items} loading={query.isLoading}
        onRowClick={(r) => navigate({ to: "/dashboard/companies/$id", params: { id: r.id } })}
        emptyTitle="No companies" emptyDescription="Corporate registrations will show here once submitted." />
      {query.data && query.data.totalItems > 0 && (
        <TablePagination page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} onPageChange={setPage} />
      )}
    </>
  );
}
