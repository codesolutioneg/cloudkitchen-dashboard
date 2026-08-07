const SKIP_KEYS = new Set([
  "id",
  "created_at",
  "updated_at",
  "created_by_type",
  "created_by_id",
  "updated_by_type",
  "updated_by_id",
  "version",
  "is_deleted",
  "deleted_at",
  "correlation_id",
  "request_id",
]);

const LABELS: Record<string, string> = {
  name: "الاسم",
  legal_name: "الاسم القانوني",
  trade_name: "الاسم التجاري",
  email: "البريد",
  status: "الحالة",
  approval_status: "حالة الاعتماد",
  base_price: "السعر",
  total_amount: "الإجمالي",
  tax_amount: "الضريبة",
  quantity: "الكمية",
  is_active: "نشط",
  image_url: "رابط الصورة",
  order_number: "رقم الطلب",
  primary_phone: "الهاتف",
  fulfillment_type: "طريقة الاستلام",
};

function isObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function formatVal(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "نعم" : "لا";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      try {
        return new Date(v).toLocaleString("ar-EG");
      } catch {
        return v;
      }
    }
    return v.length > 80 ? `${v.slice(0, 77)}…` : v;
  }
  return JSON.stringify(v);
}

export type AuditChangeRow = { field: string; before: string; after: string };

export function buildAuditChanges(
  oldValues: unknown,
  newValues: unknown,
  changedFields: unknown,
): AuditChangeRow[] {
  const oldObj = isObject(oldValues) ? oldValues : {};
  const newObj = isObject(newValues) ? newValues : {};
  const keys =
    Array.isArray(changedFields) && changedFields.length
      ? changedFields.map(String)
      : [...new Set([...Object.keys(oldObj), ...Object.keys(newObj)])];

  const rows: AuditChangeRow[] = [];
  for (const key of keys) {
    if (SKIP_KEYS.has(key)) continue;
    const before = oldObj[key];
    const after = newObj[key];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    rows.push({
      field: LABELS[key] ?? key,
      before: formatVal(before),
      after: formatVal(after),
    });
  }
  return rows;
}
