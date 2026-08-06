import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EntitySelect } from "@/components/app/EntitySelect";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { companiesApi, mealPlansApi, menusApi } from "@/services/apiClient";
import type { MealPlan, MealPlanPreview, MealSlot } from "@/types/api";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/meal-plans/")({ component: MealPlansPage });

const STATUS_TONES: Record<string, "success" | "info" | "warning" | "muted"> = {
  approved: "success",
  generated: "info",
  draft: "warning",
  archived: "muted",
};

/** One protein, one carb, one salad: the standard factory hot meal. */
const DEFAULT_SLOTS: MealSlot[] = [
  { componentType: "protein", quantity: 1 },
  { componentType: "carb", quantity: 1 },
  { componentType: "salad", quantity: 1 },
];

function todayPlus(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function MealPlansPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<MealPlanPreview | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["meal-plans", statusFilter],
    queryFn: () => mealPlansApi.list({ page: 1, pageSize: 100, status: statusFilter || undefined }),
  });

  const companies = useQuery({
    queryKey: ["companies-picker"],
    queryFn: () => companiesApi.list({ page: 1, pageSize: 100, approvalStatus: "approved" }),
  });
  const menus = useQuery({ queryKey: ["menus"], queryFn: menusApi.list });

  const [form, setForm] = useState({
    companyId: "",
    name: "",
    startDate: todayPlus(1),
    endDate: todayPlus(5),
    headcount: 200,
    budgetPerMeal: "25.00",
    currency: "SAR",
    sourceMenuId: "",
    minProteinG: 45,
    maxCarbsG: 120,
    minCaloriesKcal: 650,
    maxCaloriesKcal: 1200,
    varietyWindowDays: 2,
  });

  const companyOptions = useMemo(
    () =>
      (companies.data?.items ?? []).map((c) => ({
        value: c.id,
        label: c.legalName,
        hint: c.tradeName ?? undefined,
      })),
    [companies.data],
  );

  function brief() {
    return {
      companyId: form.companyId,
      startDate: form.startDate,
      endDate: form.endDate,
      headcount: form.headcount,
      budgetPerMeal: form.budgetPerMeal,
      sourceMenuId: form.sourceMenuId || null,
      slots: DEFAULT_SLOTS,
      minProteinG: form.minProteinG,
      maxCarbsG: form.maxCarbsG,
      minCaloriesKcal: form.minCaloriesKcal,
      maxCaloriesKcal: form.maxCaloriesKcal,
      varietyWindowDays: form.varietyWindowDays,
    };
  }

  /** Solve the brief without saving it, so the numbers are visible before committing. */
  async function runPreview() {
    if (!form.companyId) {
      toast.error(t("Pick a company and name the plan."));
      return;
    }
    setPreviewing(true);
    try {
      setPreview(await mealPlansApi.preview(brief()));
    } catch (e) {
      setPreview(null);
      toast.error((e as Error).message);
    } finally {
      setPreviewing(false);
    }
  }

  async function create() {
    if (!form.companyId || !form.name.trim()) {
      toast.error(t("Pick a company and name the plan."));
      return;
    }
    setSaving(true);
    try {
      const plan = await mealPlansApi.create({
        ...brief(),
        name: form.name.trim(),
        currency: form.currency,
      });
      toast.success(t("Meal plan created"));
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["meal-plans"] });
      navigate({ to: "/dashboard/meal-plans/$id", params: { id: plan.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const cols: Column<MealPlan>[] = [
    {
      key: "name",
      header: t("Plan"),
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-semibold">{r.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {r.companyName ?? r.companyId}
          </div>
        </div>
      ),
    },
    {
      key: "period",
      header: t("Period"),
      cell: (r) => (
        <span className="whitespace-nowrap text-xs">
          {r.startDate} → {r.endDate}
        </span>
      ),
    },
    { key: "headcount", header: t("Headcount"), cell: (r) => r.headcount.toLocaleString() },
    {
      key: "budget",
      header: t("Budget / head"),
      cell: (r) => (
        <span className="whitespace-nowrap font-medium">
          {r.budgetPerMeal} {r.currency}
        </span>
      ),
    },
    {
      key: "avg",
      header: t("Avg cost / meal"),
      cell: (r) =>
        r.status === "draft" ? (
          <span className="text-xs text-muted-foreground">{t("Not generated")}</span>
        ) : (
          <span
            className={
              Number(r.avgCostPerMeal) > Number(r.budgetPerMeal)
                ? "font-semibold text-destructive"
                : "font-semibold text-foreground"
            }
          >
            {r.avgCostPerMeal} {r.currency}
          </span>
        ),
    },
    {
      key: "protein",
      header: t("Avg protein"),
      cell: (r) => (r.status === "draft" ? "-" : `${r.avgProteinG} g`),
    },
    {
      key: "status",
      header: t("Status"),
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge tone={STATUS_TONES[r.status] ?? "muted"}>{t(r.status)}</StatusBadge>
          {r.status !== "draft" && !r.isFeasible && (
            <StatusBadge tone="warning">{t("Off target")}</StatusBadge>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("Meal Plans")}
        description={t(
          "Plan budget meals for factory canteens against protein, carb and cost targets.",
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm"
            >
              <option value="">{t("All statuses")}</option>
              <option value="draft">{t("draft")}</option>
              <option value="generated">{t("generated")}</option>
              <option value="approved">{t("approved")}</option>
            </select>
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> {t("New plan")}
            </button>
          </div>
        }
      />

      <DataTable
        columns={cols}
        rows={data?.items}
        loading={isLoading}
        onRowClick={(r) => navigate({ to: "/dashboard/meal-plans/$id", params: { id: r.id } })}
        emptyTitle={t("No meal plans yet")}
        emptyDescription={t("Create a plan to budget a week of meals for a corporate client.")}
      />

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setPreview(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("New meal plan")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={t("Company")}>
              <EntitySelect
                value={form.companyId}
                onChange={(v) => setForm({ ...form, companyId: v })}
                options={companyOptions}
                placeholder={t("Select company…")}
                disabled={companies.isLoading}
              />
            </Field>
            <Field label={t("Plan name")}>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("e.g. Plant canteen: March week 1")}
                className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("Start date")}>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
                />
              </Field>
              <Field label={t("End date")}>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
                />
              </Field>
              <Field label={t("Headcount")}>
                <input
                  type="number"
                  min={1}
                  value={form.headcount}
                  onChange={(e) => setForm({ ...form, headcount: Number(e.target.value) })}
                  className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
                />
              </Field>
              <Field label={t("Budget per head")}>
                <div className="flex gap-2">
                  <input
                    value={form.budgetPerMeal}
                    onChange={(e) => setForm({ ...form, budgetPerMeal: e.target.value })}
                    className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
                  />
                  <input
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                    maxLength={3}
                    className="h-10 w-20 rounded-[10px] border border-border bg-card px-3 text-sm"
                  />
                </div>
              </Field>
            </div>

            <Field label={t("Source menu (optional)")}>
              <select
                value={form.sourceMenuId}
                onChange={(e) => setForm({ ...form, sourceMenuId: e.target.value })}
                className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
              >
                <option value="">{t("Whole catalog")}</option>
                {(menus.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("Min protein (g)")}>
                <NumberInput
                  value={form.minProteinG}
                  onChange={(v) => setForm({ ...form, minProteinG: v })}
                />
              </Field>
              <Field label={t("Max carbs (g)")}>
                <NumberInput
                  value={form.maxCarbsG}
                  onChange={(v) => setForm({ ...form, maxCarbsG: v })}
                />
              </Field>
              <Field label={t("Min energy (kcal)")}>
                <NumberInput
                  value={form.minCaloriesKcal}
                  onChange={(v) => setForm({ ...form, minCaloriesKcal: v })}
                />
              </Field>
              <Field label={t("Max energy (kcal)")}>
                <NumberInput
                  value={form.maxCaloriesKcal}
                  onChange={(v) => setForm({ ...form, maxCaloriesKcal: v })}
                />
              </Field>
            </div>

            <p className="text-xs text-muted-foreground">
              {t(
                "Each meal is one protein, one carb and one salad. Adjust components after creating the plan.",
              )}
            </p>

            {preview && (
              <div className="rounded-[12px] border border-border bg-muted/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">{t("Preview result")}</span>
                  <StatusBadge tone={preview.isFeasible ? "success" : "warning"}>
                    {preview.isFeasible ? t("Feasible") : t("Cannot meet the brief")}
                  </StatusBadge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <PreviewStat
                    label={t("Avg cost / meal")}
                    value={`${preview.avgCostPerMeal.toFixed(2)} ${form.currency}`}
                    bad={preview.avgCostPerMeal > Number(form.budgetPerMeal)}
                  />
                  <PreviewStat
                    label={t("Avg protein")}
                    value={`${preview.avgProteinG.toFixed(1)} g`}
                    bad={preview.avgProteinG < form.minProteinG}
                  />
                  <PreviewStat
                    label={t("Avg carbs")}
                    value={`${preview.avgCarbsG.toFixed(1)} g`}
                    bad={preview.avgCarbsG > form.maxCarbsG}
                  />
                  <PreviewStat
                    label={t("Avg energy")}
                    value={`${preview.avgCaloriesKcal.toFixed(0)} kcal`}
                    bad={false}
                  />
                </div>
                {preview.warnings.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-[11px] text-amber-700 dark:text-amber-400">
                    {preview.warnings.map((w, i) => (
                      <li key={`${w.code}-${i}`}>{w.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              onClick={runPreview}
              disabled={previewing || saving}
              className="rounded-[10px] border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              {previewing ? t("Previewing…") : t("Preview")}
            </button>
            <button
              onClick={create}
              disabled={saving}
              className="rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving ? t("Saving…") : t("Create")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
    />
  );
}

function PreviewStat({ label, value, bad }: { label: string; value: string; bad: boolean }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className={bad ? "font-bold text-destructive" : "font-bold text-foreground"}>
        {value}
      </div>
    </div>
  );
}
