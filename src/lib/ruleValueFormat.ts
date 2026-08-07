import type { RuleType } from "@/types/api";

export function cleanRuleTypeName(name: string) {
  return name.replace(/\s+\d{10,}$/, "").trim();
}

export function formatRuleValue(value: unknown, ruleType?: RuleType | null): string {
  if (value == null) return "—";
  if (typeof value !== "object" || Array.isArray(value)) return String(value);
  const v = value as Record<string, unknown>;
  const code = ruleType?.code ?? "";

  if (code === "min_order_qty" || v.minQty != null) {
    return `الحد الأدنى للكمية: ${v.minQty ?? v.quantity ?? v.value}`;
  }
  if (code === "max_order_qty" || v.maxQty != null) {
    return `الحد الأقصى للكمية: ${v.maxQty ?? v.quantity ?? v.value}`;
  }
  if (code === "min_daily_order_amount" || v.amount != null || v.minAmount != null) {
    const amount = v.amount ?? v.minAmount ?? v.value;
    const currency = v.currency ?? "EGP";
    return `الحد الأدنى للطلب اليومي: ${amount} ${currency}`;
  }
  if (code === "min_notice_hours" || v.hours != null || v.minHours != null) {
    return `إشعار مسبق: ${v.hours ?? v.minHours ?? v.value} ساعة`;
  }
  if (code === "vat_rate" && v.rate != null) return `ضريبة القيمة المضافة: ${v.rate}%`;
  if (code === "delivery_fee" && (v.amount != null || v.fee != null)) {
    return `رسوم التوصيل: ${v.amount ?? v.fee} ${v.currency ?? "EGP"}`;
  }
  if (v.enabled != null) return v.enabled ? "مفعّل" : "معطّل";
  return JSON.stringify(value);
}

export const RULE_PRESETS: Array<{
  code: string;
  labelKey: string;
  defaultValue: Record<string, unknown>;
  hintKey: string;
}> = [
  {
    code: "min_daily_order_amount",
    labelKey: "rulePreset.minDailyAmount",
    defaultValue: { amount: 1000, currency: "EGP" },
    hintKey: "rulePreset.minDailyAmountHint",
  },
  {
    code: "min_order_qty",
    labelKey: "rulePreset.minQty",
    defaultValue: { minQty: 5 },
    hintKey: "rulePreset.minQtyHint",
  },
  {
    code: "delivery_fee",
    labelKey: "rulePreset.deliveryFee",
    defaultValue: { amount: 50, currency: "EGP" },
    hintKey: "rulePreset.deliveryFeeHint",
  },
];
