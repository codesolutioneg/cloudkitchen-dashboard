// Complete API type definitions for Cloud Kitchen B2B Super Admin dashboard.
// All types mirror the exact backend contract at
// https://api.cloud-kitchen.code-solution.org/api/docs

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: {
    correlationId: string;
    pagination?: { page: number; pageSize: number; totalItems: number };
  };
}

export interface ApiError {
  success: false;
  error: { code: string; message: string; details?: unknown };
  meta: { correlationId: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ---------- Auth ----------
export interface LoginRequest { email: string; password: string }
export interface AuthTokens { accessToken: string; refreshToken: string }

export interface DashboardMe {
  id: string;
  fullName: string;
  email: string;
  status: string;
  department: string | null;
  mfaEnabled: boolean;
  roles: { id: string; name: string }[];
  companyScope: { scopeType: string };
}

// ---------- Navigation ----------
export interface NavigationPermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canReject: boolean;
  canExport: boolean;
  canImport: boolean;
}
export interface NavigationNode {
  id: string;
  name: string;
  route: string;
  icon: string | null;
  sortOrder: number;
  permissions: NavigationPermissions;
  children: NavigationNode[];
}

// ---------- Companies ----------
export type ApprovalStatus =
  | "pending" | "under_review" | "approved" | "rejected" | "resubmission_required";

export interface CompanySummary {
  id: string;
  legalName: string;
  tradeName: string | null;
  primaryEmail: string;
  primaryPhone: string;
  countryCode: string;
  city: string | null;
  status: string;
  approvalStatus: ApprovalStatus;
  createdAt: string;
}

export interface VerifiedDocument {
  id: string;
  companyId: string;
  attachmentType: string;
  verificationStatus: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  file: { id: string; fileName: string; mimeType: string; url: string | null };
}

// ---------- Roles & Permissions ----------
export interface Role {
  id: string;
  name: string;
  scope: string;
  isSystemRole: boolean;
  description: string | null;
  pagePermissions?: PagePermissionInput[];
}

export interface PagePermissionInput {
  pageId: string;
  canView?: boolean; canCreate?: boolean; canEdit?: boolean;
  canDelete?: boolean; canApprove?: boolean; canReject?: boolean;
  canExport?: boolean; canImport?: boolean;
}

export interface Permission {
  id: string; code: string; name: string; description?: string | null;
}

// ---------- Dashboard Users ----------
export interface DashboardUser {
  id: string;
  fullName: string;
  email: string;
  status: string;
  department: string | null;
  roles: { id: string; name: string }[];
  createdAt: string;
}
export interface InviteUserInput {
  fullName: string; email: string;
  department?: string; temporaryPassword?: string;
  roleIds?: string[];
}

export interface AnalyticsOverview {
  timezone: string;
  currency: string;
  days: number;
  companyId: string | null;
  kpis: {
    activeCompanies: number;
    ordersToday: number;
    ordersTrendPct: number;
    revenueToday: string;
    revenueTrendPct: number;
    ordersInRange: number;
    revenueInRange: string;
    deliverySharePct: number;
    pickupSharePct: number;
  };
  salesSeries: Array<{ date: string; orders: number; revenue: number }>;
  statusBreakdown: Array<{ code: string; name: string; count: number }>;
  topCompanies: Array<{
    companyId: string; legalName: string; tradeName: string | null;
    city: string | null; orderCount: number; revenue: string;
  }>;
  recentOrders: Array<{
    id: string; orderNumber: string; companyName: string;
    totalAmount: string; currency: string; fulfillmentType: string;
    statusCode: string | null; statusName: string | null; createdAt: string;
  }>;
}

// ---------- Features / Modules ----------
export interface Feature {
  id: string; code: string; name: string;
  moduleId: string | null; isGlobalDefaultEnabled: boolean;
}
export interface Module {
  id: string; code: string; name: string; audience: string; isCore: boolean;
}
export interface FeatureGroup { id: string; code: string; name: string }
export interface FeatureFlag {
  id: string; code: string; name: string; isEnabled: boolean;
}
export interface DashboardPage {
  id: string; code: string; name: string; route: string;
  parentId: string | null; sortOrder: number;
}

// ---------- Catalog ----------
export interface Category {
  id: string; parentCategoryId: string | null;
  name: string; nameAr?: string | null; slug: string;
  imageUrl?: string | null; sortOrder: number; isActive: boolean;
}
export interface Product {
  id: string; categoryId: string; sku: string | null; barcode: string | null;
  name: string; description: string | null;
  imageUrl?: string | null; prepTimeMins?: number | null;
  basePrice: string | null; currency: string;
  taxClass: string | null; isActive: boolean; visibility: string;
  sortOrder: number; erpReferenceId?: string | null; posReferenceId?: string | null;
  attributes: unknown | null;
}
export interface CustomProductRequest {
  id: string; name: string; nameAr?: string | null; description: string | null;
  basePrice: string | null; currency: string; approvalStatus: string;
  rejectionReason: string | null; companyId: string | null; orderable: boolean;
  createdAt: string;
  company?: { id: string; legalName: string; tradeName: string | null };
}
export interface ProductMedia {
  id: string; productId: string; mediaType: string;
  url: string; sortOrder: number; isPrimary: boolean;
}
export interface PricingList {
  id: string; code: string; name: string; currency: string; isActive: boolean;
}
export interface CompanyCatalogAssignment {
  /** DataTable keys rows on `id`; the assignment is identified by its company. */
  id?: string;
  companyId: string;
  companyName: string;
  tradeName: string | null;
  approvalStatus: string;
  menu: {
    assignmentId: string;
    menuId: string;
    menuName: string;
    priority: number;
    effectiveFrom: string;
    effectiveTo: string | null;
  } | null;
  pricing: {
    assignmentId: string;
    pricingListId: string;
    pricingListName: string;
    currency: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  } | null;
}

// ---------- Menus ----------
export interface Menu { id: string; name: string; menuType: string; isActive: boolean }
export interface MenuSection { id: string; menuId: string; name: string; sortOrder: number }

// ---------- Business Rules ----------
export interface RuleType {
  id: string; code: string; name: string; valueSchema: unknown | null;
}
export interface BusinessRule {
  id: string; ruleTypeId: string; scopeType: string; scopeId: string | null;
  value: unknown; priority: number; isActive: boolean;
}
export interface Calendar {
  id: string; code: string; name: string; timezone: string;
}
export interface CalendarEvent {
  id: string; calendarId: string;
  eventDate: string;
  eventType: "holiday" | "blackout" | "special_hours";
  name: string; metadata: unknown | null;
}

// ---------- Workflows ----------
export type WorkflowStepType = "initial" | "intermediate" | "final";
export interface Workflow {
  id: string; code: string; name: string; workflowType: string; isActive: boolean;
}
export interface WorkflowStep {
  id: string; workflowId: string;
  code: string; name: string; stepType: WorkflowStepType;
  slaMinutes: number | null; sortOrder: number;
}
export interface WorkflowTransition {
  id: string; workflowId: string;
  fromStepId: string | null; toStepId: string;
  triggerType: "manual" | "automatic" | "scheduled";
}
export interface WorkflowInstance {
  id: string; workflowId: string; entityType: string; entityId: string;
  currentStepId: string; currentStepCode: string; status: string;
}

// ---------- Orders ----------
export interface OrderSummary {
  id: string; orderNumber: string; companyId: string;
  currency: string; totalAmount: string;
  requestedDeliveryAt: string; fulfillmentType: "delivery" | "pickup";
  createdAt: string;
  currentStepCode: string | null; currentStepName: string | null;
}
export interface OrderItem {
  id: string; productId: string; productNameSnapshot: string;
  unitPriceSnapshot: string; quantity: number; lineTotal: string;
}
export interface OrderStatusHistory {
  statusCode: string; changedAt: string; comment: string | null;
}
export interface OrderNote {
  id: string; note: string; isInternal: boolean; createdAt: string;
}
export interface OrderApproval { approvalLevel: number; status: string }
export interface OrderPaymentInfo {
  status: string;
  proofAttachmentId: string | null;
  receiptFileId: string | null;
  rejectionReason: string | null;
}
export interface OrderDetail extends OrderSummary {
  departmentId: string | null; orderedByUserId: string;
  workflowInstanceId: string | null;
  subtotalAmount: string; discountAmount: string; taxAmount: string;
  serviceChargeAmount: string; deliveryFeeAmount: string;
  deliveryAddressId: string | null; sourceChannel: string; isBulkOrder: boolean;
  workflow: {
    instanceId: string; currentStepId: string; currentStepCode: string;
    currentStepName: string; currentStepType: string;
    enteredStepAt: string; slaDueAt: string | null;
  } | null;
  items: OrderItem[];
  statusHistory: OrderStatusHistory[];
  notes: OrderNote[];
  approvals: OrderApproval[];
  payment: OrderPaymentInfo | null;
  seriesId: string | null;
}

// ---------- Delivery ----------
export interface DeliveryUser {
  id: string; fullName: string; email: string; isAvailable: boolean;
}
export interface DeliveryOrderView {
  id: string; orderNumber: string; companyId: string; companyName: string;
  fulfillmentType: "delivery" | "pickup";
  requestedDeliveryAt: string;
  currentStepCode: string | null; currentStepName: string | null;
  assignedDeliveryUserId: string | null; assignedAt: string | null;
  deliveryAddress: {
    label: string | null; addressLine1: string | null; addressLine2: string | null;
    city: string | null; stateProvince: string | null; countryCode: string | null;
    postalCode: string | null; latitude: string | null; longitude: string | null;
    contactName: string | null; contactPhone: string | null;
  } | null;
}

// ---------- Approval Workflows ----------
export interface ApprovalWorkflow {
  id: string;
  name: string;
  entityType: string;
  companyId?: string | null;
  isActive: boolean;
  stepCount?: number;
}
export interface ApprovalStep {
  id: string; workflowId: string; stepOrder: number; name: string; approverType: string;
}
export interface ApprovalRequest {
  id: string; entityType: string; entityId: string;
  status: string; currentStepOrder: number;
}

// ---------- Audit Logs ----------
export interface AuditLog {
  id: string;
  entityName: string;
  entityId: string;
  entityTypeLabel: string;
  entityLabel: string | null;
  entityDisplay: string;
  action: string;
  oldValues: unknown;
  newValues: unknown;
  changedFields: unknown;
  changedByType: string | null;
  changedById: string | null;
  actorDisplay: string | null;
  changedAt: string;
  reason: string | null;
  source: string;
  correlationId: string;
  requestId: string | null;
}

// ---------- Notifications ----------
export interface NotificationTemplate {
  id: string; code: string; channel: string;
  subjectTemplate: string | null; bodyTemplate: string;
  languageCode: string;
}

// ---------- Jobs ----------
export interface BackgroundJob {
  id: string; jobType: string; queueName: string;
  status: string; attempts: number; createdAt: string;
}

// ---------- Integrations ----------
export interface ExternalSystem {
  id: string; code: string; name: string;
  systemType: string; baseUrl: string | null; isActive: boolean;
}
export interface IntegrationMapping {
  id: string; systemId: string; entityType: string;
  localValue: string; externalValue: string;
}
export interface IntegrationEvent {
  id: string; systemId: string; eventType: string; status: string; occurredAt: string;
}

// ---------- Localization ----------
export interface Language {
  id: string; code: string; name: string; isActive: boolean; isDefault: boolean;
}
export interface Translation {
  entityType: string; entityId: string; fieldName: string;
  languageCode: string; translatedValue: string;
}

// ---------- Settings ----------
export interface GlobalSettings {
  settings: Record<string, {
    key: string; value: unknown;
    isOverridable: boolean; description: string | null;
  }>;
}

// ---------- Extended ----------
export interface ProductVariant {
  id: string; productId: string; sku: string | null; name: string;
  priceDelta: string | null; isActive: boolean;
}
export interface ProductOptionGroup {
  id: string; productId: string; name: string; minSelect: number; maxSelect: number;
}
export interface ProductAvailability {
  id: string; productId: string; startDate: string | null; endDate: string | null;
  dayOfWeek: number | null; startTime: string | null; endTime: string | null;
}
export interface ProductTag { id: string; productId: string; tag: string }
export interface SectionProduct {
  productId: string;
  sortOrder: number;
  isFeatured?: boolean;
  product?: { id: string; name: string; sku: string | null; visibility?: string; imageUrl?: string | null };
}
export interface MenuAssignment {
  id: string;
  menuId?: string;
  scopeType: string;
  scopeId: string | null;
  priority: number;
}
export interface ApprovalRequestDetail extends ApprovalRequest {
  requestedBy: string | null; requestedAt: string;
  history: Array<{ stepOrder: number; decision: string; comment: string | null; decidedAt: string }>;
}

// ---------- Nutrition & budget meal planning ----------
export type MealComponentType =
  | "protein"
  | "carb"
  | "vegetable"
  | "salad"
  | "soup"
  | "side"
  | "drink"
  | "dessert"
  | "other";

export interface ProductNutrition {
  productId: string;
  componentType: MealComponentType;
  servingSizeG: number | null;
  caloriesKcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fiberG: string | null;
  sodiumMg: string | null;
  allergens: string[];
  ingredients: string | null;
  source: string | null;
  updatedAt: string;
}

export interface NutritionInput {
  componentType: MealComponentType;
  servingSizeG?: number | null;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number | null;
  sodiumMg?: number | null;
  allergens?: string[];
  ingredients?: string | null;
  source?: string | null;
}

export interface MealSlot {
  componentType: MealComponentType;
  quantity: number;
}

export interface MealPlanWarning {
  code: string;
  message: string;
  date?: string;
  componentType?: string;
}

export interface MealPlanItem {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string | null;
  componentType: MealComponentType;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  caloriesKcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  isLocked: boolean;
  sortOrder: number;
}

export interface MealPlanDay {
  id: string;
  planDate: string;
  sortOrder: number;
  costPerHead: string;
  totalCost: string;
  caloriesKcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  isFeasible: boolean;
  warnings: MealPlanWarning[];
  items: MealPlanItem[];
}

export interface MealPlan {
  id: string;
  companyId: string;
  companyName: string | null;
  name: string;
  description: string | null;
  status: "draft" | "generated" | "approved" | "archived";
  startDate: string;
  endDate: string;
  headcount: number;
  budgetPerMeal: string;
  currency: string;
  pricingListId: string | null;
  sourceMenuId: string | null;
  minCaloriesKcal: string | null;
  maxCaloriesKcal: string | null;
  minProteinG: string | null;
  maxProteinG: string | null;
  minCarbsG: string | null;
  maxCarbsG: string | null;
  maxFatG: string | null;
  slots: MealSlot[];
  excludeAllergens: string[];
  varietyWindowDays: number;
  generatedAt: string | null;
  isFeasible: boolean;
  warnings: MealPlanWarning[];
  totalCost: string;
  avgCostPerMeal: string;
  avgCaloriesKcal: string;
  avgProteinG: string;
  avgCarbsG: string;
  avgFatG: string;
  approvedAt: string | null;
  createdAt: string;
}

export interface MealPlanDetail extends MealPlan {
  days: MealPlanDay[];
}

export interface MealPlanCandidate {
  productId: string;
  name: string;
  categoryId: string;
  componentType: MealComponentType;
  unitPrice: string;
  currency: string;
  caloriesKcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  allergens: string[];
  proteinPerCurrencyUnit: string;
}

export interface MealPlanPreviewDay {
  date: string;
  costPerHead: number;
  totalCost: number;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isFeasible: boolean;
  warnings: MealPlanWarning[];
  items: Array<{
    productId: string;
    variantId: string | null;
    name: string;
    componentType: MealComponentType;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    caloriesKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    isLocked: boolean;
  }>;
}

export interface MealPlanPreview {
  isFeasible: boolean;
  totalCost: number;
  avgCostPerMeal: number;
  avgCaloriesKcal: number;
  avgProteinG: number;
  avgCarbsG: number;
  avgFatG: number;
  warnings: MealPlanWarning[];
  days: MealPlanPreviewDay[];
}

export interface MealPlanBriefInput {
  companyId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  headcount: number;
  budgetPerMeal: string;
  currency: string;
  pricingListId?: string | null;
  sourceMenuId?: string | null;
  slots: MealSlot[];
  excludeAllergens?: string[];
  varietyWindowDays?: number;
  minCaloriesKcal?: number | null;
  maxCaloriesKcal?: number | null;
  minProteinG?: number | null;
  maxProteinG?: number | null;
  minCarbsG?: number | null;
  maxCarbsG?: number | null;
  maxFatG?: number | null;
}
