/** Fixed system values shown as dropdowns — do not free-type these in the UI. */

export const DEPARTMENTS = [
  { value: "Operations", labelKey: "Operations" },
  { value: "Kitchen", labelKey: "Kitchen" },
  { value: "Logistics", labelKey: "Logistics" },
  { value: "Finance", labelKey: "Finance" },
  { value: "Sales", labelKey: "Sales" },
  { value: "Support", labelKey: "Support" },
  { value: "Management", labelKey: "Management" },
] as const;

export const NOTIFICATION_CHANNELS = [
  { value: "in_app", labelKey: "In-app" },
  { value: "push", labelKey: "Push" },
  { value: "email", labelKey: "Email" },
  { value: "sms", labelKey: "SMS" },
] as const;

export const LANGUAGES = [
  { value: "ar", labelKey: "Arabic" },
  { value: "en", labelKey: "English" },
] as const;

/** Platform currency — Egypt only for this deployment. */
export const CURRENCIES = [
  { value: "EGP", labelKey: "EGP" },
] as const;

export const PLATFORM_CURRENCY = "EGP" as const;

export const MENU_TYPES = [
  { value: "general", labelKey: "General" },
  { value: "corporate", labelKey: "Corporate" },
  { value: "event", labelKey: "Event" },
] as const;

export const WORKFLOW_TYPES = [
  { value: "order", labelKey: "Order" },
  { value: "approval", labelKey: "Approval" },
  { value: "onboarding", labelKey: "Onboarding" },
] as const;

export const APPROVAL_ENTITY_TYPES = [
  { value: "order", labelKey: "Order" },
  { value: "company", labelKey: "Company" },
] as const;

export const FULFILLMENT_TYPES = [
  { value: "delivery", labelKey: "Delivery" },
  { value: "pickup", labelKey: "Pickup" },
] as const;

export const RULE_SCOPES = [
  { value: "platform", labelKey: "Platform (all companies)" },
  { value: "company", labelKey: "Company" },
] as const;

export const TIMEZONES = [
  { value: "Asia/Riyadh", labelKey: "Asia/Riyadh" },
  { value: "Asia/Dubai", labelKey: "Asia/Dubai" },
  { value: "Africa/Cairo", labelKey: "Africa/Cairo" },
  { value: "UTC", labelKey: "UTC" },
] as const;

export const DOCUMENT_TYPES = [
  { value: "commercial_registration", labelKey: "Commercial registration" },
  { value: "vat_certificate", labelKey: "VAT certificate" },
  { value: "bank_letter", labelKey: "Bank letter" },
  { value: "id_card", labelKey: "ID card" },
  { value: "other", labelKey: "Other" },
] as const;

export const TEMPLATE_PRESETS = [
  { value: "order_confirmation", labelKey: "Order confirmation" },
  { value: "order_ready", labelKey: "Order ready" },
  { value: "order_out_for_delivery", labelKey: "Out for delivery" },
  { value: "order_delivered", labelKey: "Order delivered" },
  { value: "order_cancelled", labelKey: "Order cancelled" },
] as const;

export function optionsFrom(
  list: ReadonlyArray<{ value: string; labelKey: string }>,
  translate: (key: string) => string,
) {
  return list.map((item) => ({ value: item.value, label: translate(item.labelKey) }));
}
