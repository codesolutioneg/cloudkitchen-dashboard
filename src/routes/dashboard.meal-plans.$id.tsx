import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EntitySelect } from "@/components/app/EntitySelect";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { mealPlansApi } from "@/services/apiClient";
import type {
  MealComponentType,
  MealPlanCandidate,
  MealPlanDay,
  MealPlanDetail,
  MealSlot,
} from "@/types/api";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Loader2,
  Lock,
  LockOpen,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/meal-plans/$id")({ component: MealPlanBuilder });

const COMPONENT_TYPES: MealComponentType[] = [
  "protein",
  "carb",
  "vegetable",
  "salad",
  "soup",
  "side",
  "drink",
  "dessert",
  "other",
];

const STATUS_TONES: Record<string, "success" | "info" | "warning" | "muted"> = {
  approved: "success",
  generated: "info",
  draft: "warning",
  archived: "muted",
};

function num(value: string | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function MealPlanBuilder() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"generate" | "approve" | "duplicate" | "archive" | null>(null);

  const plan = useQuery({ queryKey: ["meal-plan", id], queryFn: () => mealPlansApi.get(id) });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["meal-plan", id] });
    qc.invalidateQueries({ queryKey: ["meal-plans"] });
  }

  async function run(action: NonNullable<typeof busy>, fn: () => Promise<unknown>, done: string) {
    setBusy(action);
    try {
      await fn();
      toast.success(done);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (plan.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!plan.data) return <div className="py-24 text-center">{t("Page not found")}</div>;

  const p = plan.data;
  const readOnly = p.status === "approved" || p.status === "archived";

  return (
    <>
      <PageHeader
        title={p.name}
        description={`${p.companyName ?? ""} · ${p.startDate} → ${p.endDate} · ${p.headcount.toLocaleString()} ${t("heads")}`}
        breadcrumbs={[
          { label: t("Dashboard"), to: "/dashboard" },
          { label: t("Meal Plans"), to: "/dashboard/meal-plans" },
          { label: p.name },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => run("generate", () => mealPlansApi.generate(id), t("Plan generated"))}
              disabled={readOnly || busy !== null}
              className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy === "generate" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {p.status === "draft" ? t("Generate plan") : t("Regenerate")}
            </button>
            <button
              onClick={() => run("approve", () => mealPlansApi.approve(id), t("Plan approved"))}
              disabled={p.status !== "generated" || busy !== null}
              className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" /> {t("Approve")}
            </button>
            <button
              onClick={() =>
                run(
                  "duplicate",
                  async () => {
                    const copy = await mealPlansApi.duplicate(id);
                    navigate({ to: "/dashboard/meal-plans/$id", params: { id: copy.id } });
                  },
                  t("Plan duplicated"),
                )
              }
              disabled={busy !== null}
              className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              <Copy className="h-4 w-4" /> {t("Duplicate")}
            </button>
            <button
              onClick={() => {
                if (!confirm(t("Archive this plan?"))) return;
                run(
                  "archive",
                  async () => {
                    await mealPlansApi.archive(id);
                    navigate({ to: "/dashboard/meal-plans" });
                  },
                  t("Plan archived"),
                );
              }}
              disabled={busy !== null}
              className="flex items-center gap-2 rounded-[10px] border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> {t("Archive")}
            </button>
            <Link
              to="/dashboard/meal-plans"
              className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" /> {t("Back")}
            </Link>
          </div>
        }
      />

      <SummaryCards plan={p} />

      {p.warnings.length > 0 && (
        <div className="mb-4 rounded-[12px] border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" /> {t("Plan cannot fully meet the brief")}
          </div>
          <ul className="list-inside list-disc text-xs text-amber-800 dark:text-amber-300">
            {p.warnings.map((w, i) => (
              <li key={`${w.code}-${i}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      <Tabs defaultValue="days">
        <TabsList className="mb-4">
          <TabsTrigger value="days">{t("Daily menus")}</TabsTrigger>
          <TabsTrigger value="brief">{t("Brief")}</TabsTrigger>
          <TabsTrigger value="candidates">{t("Available products")}</TabsTrigger>
        </TabsList>
        <TabsContent value="days">
          <DaysTab plan={p} readOnly={readOnly} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="brief">
          <BriefTab plan={p} readOnly={readOnly} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="candidates">
          <CandidatesTab plan={p} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function SummaryCards({ plan }: { plan: MealPlanDetail }) {
  const budget = num(plan.budgetPerMeal);
  const avg = num(plan.avgCostPerMeal);
  const overBudget = avg > budget;
  const generated = plan.status !== "draft";

  const cards = [
    {
      label: t("Avg cost / meal"),
      value: generated ? `${plan.avgCostPerMeal} ${plan.currency}` : "-",
      hint: `${t("Budget")} ${plan.budgetPerMeal} ${plan.currency}`,
      tone: overBudget ? "bad" : "good",
    },
    {
      label: t("Plan total"),
      value: generated ? `${plan.totalCost} ${plan.currency}` : "-",
      hint: `${plan.headcount.toLocaleString()} ${t("heads")} · ${plan.days.length} ${t("days")}`,
      tone: "neutral",
    },
    {
      label: t("Avg protein"),
      value: generated ? `${plan.avgProteinG} g` : "-",
      hint: plan.minProteinG ? `${t("Min")} ${num(plan.minProteinG)} g` : t("No target"),
      tone: plan.minProteinG && num(plan.avgProteinG) < num(plan.minProteinG) ? "bad" : "good",
    },
    {
      label: t("Avg carbs"),
      value: generated ? `${plan.avgCarbsG} g` : "-",
      hint: plan.maxCarbsG ? `${t("Max")} ${num(plan.maxCarbsG)} g` : t("No target"),
      tone: plan.maxCarbsG && num(plan.avgCarbsG) > num(plan.maxCarbsG) ? "bad" : "good",
    },
    {
      label: t("Avg energy"),
      value: generated ? `${plan.avgCaloriesKcal} kcal` : "-",
      hint:
        plan.minCaloriesKcal || plan.maxCaloriesKcal
          ? `${num(plan.minCaloriesKcal)} - ${num(plan.maxCaloriesKcal)} kcal`
          : t("No target"),
      tone: "neutral",
    },
    {
      label: t("Status"),
      value: t(plan.status),
      hint: plan.isFeasible
        ? t("Meets the brief")
        : generated
          ? t("Off target")
          : t("Not generated"),
      tone: generated ? (plan.isFeasible ? "good" : "bad") : "neutral",
    },
  ];

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="card-elevated p-4">
          <div className="text-xs font-semibold text-muted-foreground">{c.label}</div>
          <div
            className={
              c.tone === "bad"
                ? "mt-1 text-xl font-bold text-destructive"
                : c.tone === "good"
                  ? "mt-1 text-xl font-bold text-foreground"
                  : "mt-1 text-xl font-bold text-foreground"
            }
          >
            {c.value}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">{c.hint}</div>
        </div>
      ))}
    </div>
  );
}

function Meter({
  label,
  value,
  limit,
  unit,
  direction,
}: {
  label: string;
  value: number;
  limit: number | null;
  unit: string;
  /** "max" means value should stay under limit; "min" means value should reach it. */
  direction: "max" | "min";
}) {
  const pct = limit && limit > 0 ? Math.min(100, Math.round((value / limit) * 100)) : 0;
  const ok = !limit ? true : direction === "max" ? value <= limit : value >= limit;
  return (
    <div className="min-w-[130px] flex-1">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-semibold text-muted-foreground">{label}</span>
        <span className={ok ? "font-semibold" : "font-semibold text-destructive"}>
          {value.toFixed(1)} {unit}
          {limit ? (
            <span className="text-muted-foreground">
              {" "}
              / {direction === "max" ? "≤" : "≥"} {limit}
            </span>
          ) : null}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={ok ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-destructive"}
          style={{ width: `${limit ? pct : 0}%` }}
        />
      </div>
    </div>
  );
}

function DaysTab({
  plan,
  readOnly,
  onChanged,
}: {
  plan: MealPlanDetail;
  readOnly: boolean;
  onChanged: () => void;
}) {
  if (plan.days.length === 0) {
    return (
      <EmptyState
        title={t("Nothing planned yet")}
        description={t("Hit Generate plan to solve the brief against the priced catalog.")}
      />
    );
  }
  return (
    <div className="space-y-3">
      {plan.days.map((day) => (
        <DayCard key={day.id} plan={plan} day={day} readOnly={readOnly} onChanged={onChanged} />
      ))}
    </div>
  );
}

function DayCard({
  plan,
  day,
  readOnly,
  onChanged,
}: {
  plan: MealPlanDetail;
  day: MealPlanDay;
  readOnly: boolean;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [productId, setProductId] = useState("");
  const [componentType, setComponentType] = useState<MealComponentType>("side");

  const candidates = useQuery({
    queryKey: ["meal-plan-candidates", plan.companyId, plan.sourceMenuId],
    queryFn: () =>
      mealPlansApi.candidates({
        companyId: plan.companyId,
        sourceMenuId: plan.sourceMenuId ?? undefined,
        pricingListId: plan.pricingListId ?? undefined,
      }),
    enabled: adding,
  });

  const options = useMemo(
    () =>
      (candidates.data ?? []).map((c) => ({
        value: c.productId,
        label: c.name,
        hint: `${c.componentType} · ${c.unitPrice} ${c.currency} · ${c.proteinG} g ${t("protein")}`,
      })),
    [candidates.data],
  );

  async function addItem() {
    if (!productId) return;
    try {
      await mealPlansApi.addItem(plan.id, day.id, { productId, componentType, quantity: 1 });
      toast.success(t("Item added"));
      setProductId("");
      setAdding(false);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function toggleLock(itemId: string, isLocked: boolean) {
    try {
      await mealPlansApi.updateItem(plan.id, day.id, itemId, { isLocked });
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function removeItem(itemId: string) {
    try {
      await mealPlansApi.removeItem(plan.id, day.id, itemId);
      toast.success(t("Removed"));
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const budget = num(plan.budgetPerMeal);
  const cost = num(day.costPerHead);

  return (
    <div className="card-elevated p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold">{day.planDate}</h4>
          {day.isFeasible ? (
            <StatusBadge tone="success">{t("On target")}</StatusBadge>
          ) : (
            <StatusBadge tone="warning">{t("Off target")}</StatusBadge>
          )}
        </div>
        <div className="text-sm">
          <span className={cost > budget ? "font-bold text-destructive" : "font-bold"}>
            {day.costPerHead} {plan.currency}
          </span>
          <span className="text-muted-foreground">
            {" "}
            / {t("head")} · {day.totalCost} {plan.currency} {t("total")}
          </span>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-4">
        <Meter label={t("Cost")} value={cost} limit={budget} unit={plan.currency} direction="max" />
        <Meter
          label={t("Protein")}
          value={num(day.proteinG)}
          limit={plan.minProteinG ? num(plan.minProteinG) : null}
          unit="g"
          direction="min"
        />
        <Meter
          label={t("Carbs")}
          value={num(day.carbsG)}
          limit={plan.maxCarbsG ? num(plan.maxCarbsG) : null}
          unit="g"
          direction="max"
        />
        <Meter
          label={t("Energy")}
          value={num(day.caloriesKcal)}
          limit={plan.maxCaloriesKcal ? num(plan.maxCaloriesKcal) : null}
          unit="kcal"
          direction="max"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">{t("Component")}</th>
              <th className="px-3 py-2 text-start">{t("Product")}</th>
              <th className="px-3 py-2 text-start">{t("Qty")}</th>
              <th className="px-3 py-2 text-start">{t("Unit")}</th>
              <th className="px-3 py-2 text-start">{t("Line")}</th>
              <th className="px-3 py-2 text-start">{t("Protein")}</th>
              <th className="px-3 py-2 text-start">{t("Carbs")}</th>
              <th className="px-3 py-2 text-start">{t("kcal")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {day.items.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-2">
                  <StatusBadge tone="info">{t(item.componentType)}</StatusBadge>
                </td>
                <td className="px-3 py-2 font-medium">{item.productName ?? item.productId}</td>
                <td className="px-3 py-2">{item.quantity}</td>
                <td className="px-3 py-2">{item.unitPrice}</td>
                <td className="px-3 py-2 font-semibold">{item.lineTotal}</td>
                <td className="px-3 py-2">{item.proteinG}</td>
                <td className="px-3 py-2">{item.carbsG}</td>
                <td className="px-3 py-2">{item.caloriesKcal}</td>
                <td className="px-3 py-2">
                  {!readOnly && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleLock(item.id, !item.isLocked)}
                        title={
                          item.isLocked
                            ? t("Unlock (may change on regenerate)")
                            : t("Lock (kept on regenerate)")
                        }
                        className={
                          item.isLocked
                            ? "text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }
                      >
                        {item.isLocked ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <LockOpen className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-destructive hover:opacity-70"
                        aria-label={t("Remove")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {day.warnings.length > 0 && (
        <ul className="mt-3 list-inside list-disc text-xs text-amber-700 dark:text-amber-400">
          {day.warnings.map((w, i) => (
            <li key={`${w.code}-${i}`}>{w.message}</li>
          ))}
        </ul>
      )}

      {!readOnly &&
        (adding ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="min-w-[260px] flex-1">
              <EntitySelect
                value={productId}
                onChange={setProductId}
                options={options}
                placeholder={t("Select product…")}
                disabled={candidates.isLoading}
              />
            </div>
            <select
              value={componentType}
              onChange={(e) => setComponentType(e.target.value as MealComponentType)}
              className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm"
            >
              {COMPONENT_TYPES.map((c) => (
                <option key={c} value={c}>
                  {t(c)}
                </option>
              ))}
            </select>
            <button
              onClick={addItem}
              disabled={!productId}
              className="rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {t("Add")}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-[10px] border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
            >
              {t("Cancel")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-3 text-sm font-semibold text-primary hover:underline"
          >
            {t("Add item to this day")}
          </button>
        ))}
    </div>
  );
}

function BriefTab({
  plan,
  readOnly,
  onChanged,
}: {
  plan: MealPlanDetail;
  readOnly: boolean;
  onChanged: () => void;
}) {
  const [slots, setSlots] = useState<MealSlot[]>(plan.slots);
  const [allergens, setAllergens] = useState(plan.excludeAllergens.join(", "));
  const [form, setForm] = useState({
    headcount: plan.headcount,
    budgetPerMeal: plan.budgetPerMeal,
    startDate: plan.startDate,
    endDate: plan.endDate,
    varietyWindowDays: plan.varietyWindowDays,
    minProteinG: plan.minProteinG ? num(plan.minProteinG) : 0,
    maxCarbsG: plan.maxCarbsG ? num(plan.maxCarbsG) : 0,
    minCaloriesKcal: plan.minCaloriesKcal ? num(plan.minCaloriesKcal) : 0,
    maxCaloriesKcal: plan.maxCaloriesKcal ? num(plan.maxCaloriesKcal) : 0,
    maxFatG: plan.maxFatG ? num(plan.maxFatG) : 0,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await mealPlansApi.update(plan.id, {
        headcount: form.headcount,
        budgetPerMeal: form.budgetPerMeal,
        startDate: form.startDate,
        endDate: form.endDate,
        varietyWindowDays: form.varietyWindowDays,
        slots,
        excludeAllergens: allergens
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        // Zero means "no target"; the API treats null as unset.
        minProteinG: form.minProteinG || null,
        maxCarbsG: form.maxCarbsG || null,
        minCaloriesKcal: form.minCaloriesKcal || null,
        maxCaloriesKcal: form.maxCaloriesKcal || null,
        maxFatG: form.maxFatG || null,
      });
      toast.success(t("Brief saved"));
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card-elevated space-y-4 p-5">
        <h3 className="text-base font-semibold">{t("Meal composition")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("One row per component the planner must fill for every meal.")}
        </p>
        <div className="space-y-2">
          {slots.map((slot, index) => (
            <div key={`${slot.componentType}-${index}`} className="flex flex-wrap gap-2">
              <select
                value={slot.componentType}
                disabled={readOnly}
                onChange={(e) =>
                  setSlots(
                    slots.map((s, i) =>
                      i === index
                        ? { ...s, componentType: e.target.value as MealComponentType }
                        : s,
                    ),
                  )
                }
                className="h-10 flex-1 rounded-[10px] border border-border bg-card px-3 text-sm"
              >
                {COMPONENT_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {t(c)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={10}
                disabled={readOnly}
                value={slot.quantity}
                onChange={(e) =>
                  setSlots(
                    slots.map((s, i) =>
                      i === index ? { ...s, quantity: Math.max(1, Number(e.target.value)) } : s,
                    ),
                  )
                }
                className="h-10 w-24 rounded-[10px] border border-border bg-card px-3 text-sm"
              />
              <button
                onClick={() => setSlots(slots.filter((_, i) => i !== index))}
                disabled={readOnly || slots.length === 1}
                className="rounded-[10px] border border-destructive/40 px-3 text-sm text-destructive disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setSlots([...slots, { componentType: "side", quantity: 1 }])}
          disabled={readOnly || slots.length >= 10}
          className="text-sm font-semibold text-primary hover:underline disabled:opacity-40"
        >
          {t("Add component")}
        </button>
      </div>

      <div className="card-elevated grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <LabeledNumber
          label={t("Headcount")}
          value={form.headcount}
          disabled={readOnly}
          onChange={(v) => setForm({ ...form, headcount: v })}
        />
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">
            {t("Budget per head")} ({plan.currency})
          </span>
          <input
            value={form.budgetPerMeal}
            disabled={readOnly}
            onChange={(e) => setForm({ ...form, budgetPerMeal: e.target.value })}
            className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
          />
        </label>
        <LabeledNumber
          label={t("Variety window (days)")}
          value={form.varietyWindowDays}
          disabled={readOnly}
          onChange={(v) => setForm({ ...form, varietyWindowDays: v })}
        />
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">{t("Start date")}</span>
          <input
            type="date"
            value={form.startDate}
            disabled={readOnly}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">{t("End date")}</span>
          <input
            type="date"
            value={form.endDate}
            disabled={readOnly}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
          />
        </label>
        <label className="block space-y-1.5 sm:col-span-2 lg:col-span-1">
          <span className="text-xs font-semibold text-muted-foreground">
            {t("Excluded allergens (comma separated)")}
          </span>
          <input
            value={allergens}
            disabled={readOnly}
            onChange={(e) => setAllergens(e.target.value)}
            placeholder="nuts, gluten"
            className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
          />
        </label>
      </div>

      <div className="card-elevated grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <LabeledNumber
          label={t("Min protein (g)")}
          value={form.minProteinG}
          disabled={readOnly}
          onChange={(v) => setForm({ ...form, minProteinG: v })}
        />
        <LabeledNumber
          label={t("Max carbs (g)")}
          value={form.maxCarbsG}
          disabled={readOnly}
          onChange={(v) => setForm({ ...form, maxCarbsG: v })}
        />
        <LabeledNumber
          label={t("Max fat (g)")}
          value={form.maxFatG}
          disabled={readOnly}
          onChange={(v) => setForm({ ...form, maxFatG: v })}
        />
        <LabeledNumber
          label={t("Min energy (kcal)")}
          value={form.minCaloriesKcal}
          disabled={readOnly}
          onChange={(v) => setForm({ ...form, minCaloriesKcal: v })}
        />
        <LabeledNumber
          label={t("Max energy (kcal)")}
          value={form.maxCaloriesKcal}
          disabled={readOnly}
          onChange={(v) => setForm({ ...form, maxCaloriesKcal: v })}
        />
      </div>

      {!readOnly && (
        <button
          onClick={save}
          disabled={saving}
          className="rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? t("Saving…") : t("Save brief")}
        </button>
      )}
      {readOnly && (
        <p className="text-sm text-muted-foreground">
          {t("An approved plan is read only. Duplicate it to make changes.")}
        </p>
      )}
    </div>
  );
}

function LabeledNumber({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
      />
    </label>
  );
}

function CandidatesTab({ plan }: { plan: MealPlanDetail }) {
  const { data, isLoading } = useQuery({
    queryKey: ["meal-plan-candidates", plan.companyId, plan.sourceMenuId],
    queryFn: () =>
      mealPlansApi.candidates({
        companyId: plan.companyId,
        sourceMenuId: plan.sourceMenuId ?? undefined,
        pricingListId: plan.pricingListId ?? undefined,
      }),
  });
  const [filter, setFilter] = useState<MealComponentType | "">("");

  const rows = useMemo(() => {
    const list = (data ?? []).filter((c) => !filter || c.componentType === filter);
    return [...list].sort(
      (a, b) => Number(b.proteinPerCurrencyUnit) - Number(a.proteinPerCurrencyUnit),
    );
  }, [data, filter]);

  if (isLoading) {
    return <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        title={t("No products with nutrition data")}
        description={t("Add nutrition to catalog products so the planner can pick them.")}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as MealComponentType | "")}
          className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm"
        >
          <option value="">{t("All components")}</option>
          {COMPONENT_TYPES.map((c) => (
            <option key={c} value={c}>
              {t(c)}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {t("Sorted by protein per currency unit, the number a canteen buyer negotiates on.")}
        </p>
      </div>
      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start">{t("Product")}</th>
              <th className="px-3 py-2 text-start">{t("Component")}</th>
              <th className="px-3 py-2 text-start">{t("Price")}</th>
              <th className="px-3 py-2 text-start">{t("Protein")}</th>
              <th className="px-3 py-2 text-start">{t("Carbs")}</th>
              <th className="px-3 py-2 text-start">{t("kcal")}</th>
              <th className="px-3 py-2 text-start">{t("Protein / cost")}</th>
              <th className="px-3 py-2 text-start">{t("Allergens")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c: MealPlanCandidate) => (
              <tr key={c.productId}>
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2">
                  <StatusBadge tone="info">{t(c.componentType)}</StatusBadge>
                </td>
                <td className="px-3 py-2">
                  {c.unitPrice} {c.currency}
                </td>
                <td className="px-3 py-2">{c.proteinG} g</td>
                <td className="px-3 py-2">{c.carbsG} g</td>
                <td className="px-3 py-2">{c.caloriesKcal}</td>
                <td className="px-3 py-2 font-semibold">{c.proteinPerCurrencyUnit}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {c.allergens.length > 0 ? c.allergens.join(", ") : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
