// Thin typed API client. All functions match backend endpoints exactly.
// Unwraps { success, data, meta } envelope and throws ApiError on failure.

import type {
  ApiResponse, AuthTokens, DashboardMe, NavigationNode,
  CompanySummary, VerifiedDocument, ApprovalStatus,
  Role, PagePermissionInput, Permission,
  DashboardUser, InviteUserInput,
  Feature, Module, FeatureGroup, FeatureFlag, DashboardPage,
  Category, Product, PricingList,
  Menu, MenuSection,
  RuleType, BusinessRule, Calendar, CalendarEvent,
  Workflow, WorkflowStep, WorkflowTransition, WorkflowInstance,
  OrderSummary, OrderDetail,
  DeliveryUser, DeliveryOrderView,
  ApprovalWorkflow, ApprovalStep, ApprovalRequest,
  AuditLog, NotificationTemplate, BackgroundJob,
  ExternalSystem, IntegrationMapping, IntegrationEvent,
  Language, Translation, GlobalSettings,
} from "@/types/api";

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "https://api.cloud-kitchen.code-solution.org";

const ACCESS_KEY = "ck.accessToken";
const REFRESH_KEY = "ck.refreshToken";

export const tokenStore = {
  get access() { return typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY); },
  get refresh() { return typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY); },
  set(tokens: AuthTokens) {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiClientError extends Error {
  code: string;
  details?: unknown;
  status: number;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  formData?: FormData;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(path, BASE_URL);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {};
  if (opts.body !== undefined && !opts.formData) headers["Content-Type"] = "application/json";
  const token = tokenStore.access;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers,
    body: opts.formData ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });

  let payload: ApiResponse<T> | null = null;
  try { payload = (await res.json()) as ApiResponse<T>; } catch { /* ignore */ }

  if (!res.ok || !payload || payload.success === false) {
    const err = payload && payload.success === false ? payload.error : {
      code: "unknown_error",
      message: `Request failed (${res.status})`,
    };
    throw new ApiClientError(res.status, err.code, err.message, "details" in err ? err.details : undefined);
  }
  return payload.data;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
}

async function paginated<T>(path: string, query?: RequestOptions["query"]): Promise<Paginated<T>> {
  const url = new URL(path, BASE_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const token = tokenStore.access;
  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  let payload: ApiResponse<T[]> | null = null;
  try { payload = (await res.json()) as ApiResponse<T[]>; } catch { /* ignore */ }
  if (!res.ok || !payload || payload.success === false) {
    const err = payload && payload.success === false ? payload.error : { code: "unknown_error", message: `Request failed (${res.status})` };
    throw new ApiClientError(res.status, err.code, err.message);
  }
  const p = payload.meta.pagination ?? { page: 1, pageSize: payload.data.length, totalItems: payload.data.length };
  return { items: payload.data, page: p.page, pageSize: p.pageSize, totalItems: p.totalItems };
}

// ================= AUTH =================
export const authApi = {
  login: (body: { email: string; password: string }) =>
    request<AuthTokens>("/api/v1/auth/dashboard/login", { method: "POST", body }),
  me: () => request<DashboardMe>("/api/v1/auth/dashboard/me"),
  logout: (refreshToken: string) =>
    request<void>("/api/v1/auth/dashboard/logout", { method: "POST", body: { refreshToken } }),
  navigation: () => request<NavigationNode[]>("/api/v1/me/navigation"),
};

// ================= COMPANIES =================
export const companiesApi = {
  list: (q: { approvalStatus?: ApprovalStatus; page?: number; pageSize?: number } = {}) =>
    paginated<CompanySummary>("/api/v1/dashboard/companies", q),
  get: (id: string) => request<CompanySummary>(`/api/v1/dashboard/companies/${id}`),
  approve: (id: string, reason?: string) =>
    request<CompanySummary>(`/api/v1/dashboard/companies/${id}/approve`, { method: "POST", body: { reason } }),
  reject: (id: string, reason?: string) =>
    request<CompanySummary>(`/api/v1/dashboard/companies/${id}/reject`, { method: "POST", body: { reason } }),
  verifyDocument: (id: string, attachmentId: string, verificationStatus: "verified" | "rejected") =>
    request<VerifiedDocument>(
      `/api/v1/dashboard/companies/${id}/documents/${attachmentId}/verify`,
      { method: "PATCH", body: { verificationStatus } },
    ),
  users: (id: string) => request<DashboardUser[]>(`/api/v1/dashboard/companies/${id}/users`),
  getSettings: (companyId: string) => request<GlobalSettings>(`/api/v1/dashboard/settings/company/${companyId}`),
  updateSettings: (companyId: string, body: unknown) =>
    request<GlobalSettings>(`/api/v1/dashboard/settings/company/${companyId}`, { method: "PUT", body }),
  getFeatures: (companyId: string) => request<Feature[]>(`/api/v1/dashboard/companies/${companyId}/features`),
  updateFeatures: (companyId: string, body: unknown) =>
    request<Feature[]>(`/api/v1/dashboard/companies/${companyId}/features`, { method: "PUT", body }),
  getModules: (companyId: string) => request<Module[]>(`/api/v1/dashboard/companies/${companyId}/modules`),
  updateModules: (companyId: string, body: unknown) =>
    request<Module[]>(`/api/v1/dashboard/companies/${companyId}/modules`, { method: "PUT", body }),
};

// ================= ROLES =================
export const rolesApi = {
  list: () => request<Role[]>("/api/v1/dashboard/roles"),
  get: (id: string) => request<Role>(`/api/v1/dashboard/roles/${id}`),
  create: (body: { name: string; description?: string; isSystemRole?: boolean }) =>
    request<Role>("/api/v1/dashboard/roles", { method: "POST", body }),
  update: (id: string, body: Partial<Role>) =>
    request<Role>(`/api/v1/dashboard/roles/${id}`, { method: "PATCH", body }),
  setPagePermissions: (id: string, pages: PagePermissionInput[]) =>
    request<void>(`/api/v1/dashboard/roles/${id}/page-permissions`, { method: "PUT", body: { pages } }),
  setApiPermissions: (id: string, permissions: Array<{ permissionId: string; effect: "allow" | "deny" }>) =>
    request<void>(`/api/v1/dashboard/roles/${id}/permissions`, { method: "PUT", body: { permissions } }),
  getFeatures: (roleId: string) => request<Feature[]>(`/api/v1/dashboard/roles/${roleId}/features`),
  updateFeatures: (roleId: string, body: unknown) =>
    request<Feature[]>(`/api/v1/dashboard/roles/${roleId}/features`, { method: "PUT", body }),
  getModules: (roleId: string) => request<Module[]>(`/api/v1/dashboard/roles/${roleId}/modules`),
  updateModules: (roleId: string, body: unknown) =>
    request<Module[]>(`/api/v1/dashboard/roles/${roleId}/modules`, { method: "PUT", body }),
};

export const permissionsApi = {
  list: () => request<Permission[]>("/api/v1/dashboard/permissions"),
};

// ================= DASHBOARD USERS =================
export const dashboardUsersApi = {
  list: (q: { page?: number; pageSize?: number } = {}) =>
    paginated<DashboardUser>("/api/v1/dashboard/users", q),
  invite: (body: InviteUserInput) =>
    request<DashboardUser>("/api/v1/dashboard/users", { method: "POST", body }),
  assignRoles: (id: string, roleIds: string[]) =>
    request<void>(`/api/v1/dashboard/users/${id}/roles`, { method: "POST", body: { roleIds } }),
  setCompanyScope: (id: string, body: { scopeType: "all" | "companies"; companyIds?: string[] }) =>
    request<void>(`/api/v1/dashboard/users/${id}/company-scope`, { method: "PUT", body }),
};

// ================= FEATURES / MODULES =================
export const featuresApi = {
  list: () => request<Feature[]>("/api/v1/dashboard/features"),
  create: (b: Partial<Feature>) => request<Feature>("/api/v1/dashboard/features", { method: "POST", body: b }),
  update: (id: string, b: Partial<Feature>) => request<Feature>(`/api/v1/dashboard/features/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) => request<void>(`/api/v1/dashboard/features/${id}`, { method: "DELETE" }),
};
export const featureGroupsApi = {
  list: () => request<FeatureGroup[]>("/api/v1/dashboard/feature-groups"),
  create: (b: Partial<FeatureGroup>) => request<FeatureGroup>("/api/v1/dashboard/feature-groups", { method: "POST", body: b }),
  update: (id: string, b: Partial<FeatureGroup>) => request<FeatureGroup>(`/api/v1/dashboard/feature-groups/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) => request<void>(`/api/v1/dashboard/feature-groups/${id}`, { method: "DELETE" }),
};
export const modulesApi = {
  list: () => request<Module[]>("/api/v1/dashboard/modules"),
  create: (b: Partial<Module>) => request<Module>("/api/v1/dashboard/modules", { method: "POST", body: b }),
  update: (id: string, b: Partial<Module>) => request<Module>(`/api/v1/dashboard/modules/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) => request<void>(`/api/v1/dashboard/modules/${id}`, { method: "DELETE" }),
};
export const featureFlagsApi = {
  list: () => request<FeatureFlag[]>("/api/v1/dashboard/feature-flags"),
  create: (b: Partial<FeatureFlag>) => request<FeatureFlag>("/api/v1/dashboard/feature-flags", { method: "POST", body: b }),
  update: (id: string, b: Partial<FeatureFlag>) => request<FeatureFlag>(`/api/v1/dashboard/feature-flags/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) => request<void>(`/api/v1/dashboard/feature-flags/${id}`, { method: "DELETE" }),
};
export const dashboardPagesApi = {
  list: () => request<DashboardPage[]>("/api/v1/dashboard/dashboard-pages"),
  create: (b: Partial<DashboardPage>) => request<DashboardPage>("/api/v1/dashboard/dashboard-pages", { method: "POST", body: b }),
  update: (id: string, b: Partial<DashboardPage>) => request<DashboardPage>(`/api/v1/dashboard/dashboard-pages/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) => request<void>(`/api/v1/dashboard/dashboard-pages/${id}`, { method: "DELETE" }),
};

// ================= CATALOG =================
export const catalogApi = {
  listCategories: () => request<Category[]>("/api/v1/dashboard/catalog/categories"),
  createCategory: (b: Partial<Category>) => request<Category>("/api/v1/dashboard/catalog/categories", { method: "POST", body: b }),
  updateCategory: (id: string, b: Partial<Category>) => request<Category>(`/api/v1/dashboard/catalog/categories/${id}`, { method: "PATCH", body: b }),
  deleteCategory: (id: string) => request<void>(`/api/v1/dashboard/catalog/categories/${id}`, { method: "DELETE" }),

  listProducts: (q: { page?: number; pageSize?: number; categoryId?: string } = {}) =>
    paginated<Product>("/api/v1/dashboard/catalog/products", q),
  getProduct: (id: string) => request<Product>(`/api/v1/dashboard/catalog/products/${id}`),
  createProduct: (b: Partial<Product>) => request<Product>("/api/v1/dashboard/catalog/products", { method: "POST", body: b }),
  updateProduct: (id: string, b: Partial<Product>) => request<Product>(`/api/v1/dashboard/catalog/products/${id}`, { method: "PATCH", body: b }),
  deleteProduct: (id: string) => request<void>(`/api/v1/dashboard/catalog/products/${id}`, { method: "DELETE" }),
  updateProductTranslation: (id: string, lang: string, body: { name: string; description?: string }) =>
    request<void>(`/api/v1/dashboard/catalog/products/${id}/translations/${lang}`, { method: "PUT", body }),

  listPricingLists: () => request<PricingList[]>("/api/v1/dashboard/catalog/pricing-lists"),
  createPricingList: (b: Partial<PricingList>) => request<PricingList>("/api/v1/dashboard/catalog/pricing-lists", { method: "POST", body: b }),
  createPrice: (body: { pricingListId: string; productId: string; variantId?: string; price: string; effectiveFrom?: string; effectiveTo?: string }) =>
    request<void>("/api/v1/dashboard/catalog/prices", { method: "POST", body }),
  assignToCompany: (body: { companyId: string; pricingListId: string; effectiveFrom?: string; effectiveTo?: string }) =>
    request<void>("/api/v1/dashboard/catalog/company-assignment", { method: "POST", body }),
};

// ================= MENUS =================
export const menusApi = {
  list: () => request<Menu[]>("/api/v1/dashboard/menus"),
  create: (b: Partial<Menu>) => request<Menu>("/api/v1/dashboard/menus", { method: "POST", body: b }),
  get: (id: string) => request<Menu>(`/api/v1/dashboard/menus/${id}`),
  listSections: (menuId: string) => request<MenuSection[]>(`/api/v1/dashboard/menus/${menuId}/sections`),
  createSection: (menuId: string, b: Partial<MenuSection>) =>
    request<MenuSection>(`/api/v1/dashboard/menus/${menuId}/sections`, { method: "POST", body: b }),
  addSectionProduct: (menuId: string, sectionId: string, body: { productId: string; sortOrder: number }) =>
    request<void>(`/api/v1/dashboard/menus/${menuId}/sections/${sectionId}/products`, { method: "POST", body }),
  listAssignments: (menuId: string) => request<unknown[]>(`/api/v1/dashboard/menus/${menuId}/assignments`),
  createAssignment: (menuId: string, body: { scopeType: "company" | "global"; scopeId?: string; priority: number }) =>
    request<void>(`/api/v1/dashboard/menus/${menuId}/assignments`, { method: "POST", body }),
};

// ================= BUSINESS RULES =================
export const rulesApi = {
  listRuleTypes: () => request<RuleType[]>("/api/v1/dashboard/rules/rule-types"),
  createRuleType: (b: Partial<RuleType>) => request<RuleType>("/api/v1/dashboard/rules/rule-types", { method: "POST", body: b }),

  listBusinessRules: () => request<BusinessRule[]>("/api/v1/dashboard/rules/business-rules"),
  createBusinessRule: (b: Partial<BusinessRule>) => request<BusinessRule>("/api/v1/dashboard/rules/business-rules", { method: "POST", body: b }),
  updateBusinessRule: (id: string, b: Partial<BusinessRule>) => request<BusinessRule>(`/api/v1/dashboard/rules/business-rules/${id}`, { method: "PATCH", body: b }),
  deleteBusinessRule: (id: string) => request<void>(`/api/v1/dashboard/rules/business-rules/${id}`, { method: "DELETE" }),
  resolve: (q: { ruleTypeCode: string; companyId?: string }) =>
    request<BusinessRule>("/api/v1/dashboard/rules/business-rules/resolve", { query: q }),

  listCalendars: () => request<Calendar[]>("/api/v1/dashboard/rules/calendars"),
  createCalendar: (b: Partial<Calendar>) => request<Calendar>("/api/v1/dashboard/rules/calendars", { method: "POST", body: b }),
  listEvents: (calendarId: string) => request<CalendarEvent[]>(`/api/v1/dashboard/rules/calendars/${calendarId}/events`),
  createEvent: (calendarId: string, body: Partial<CalendarEvent>) =>
    request<CalendarEvent>(`/api/v1/dashboard/rules/calendars/${calendarId}/events`, { method: "POST", body }),
};

// ================= WORKFLOWS =================
export const workflowsApi = {
  list: (q: { workflowType?: string } = {}) => request<Workflow[]>("/api/v1/dashboard/workflows", { query: q }),
  create: (b: Partial<Workflow>) => request<Workflow>("/api/v1/dashboard/workflows", { method: "POST", body: b }),
  listSteps: (id: string) => request<WorkflowStep[]>(`/api/v1/dashboard/workflows/${id}/steps`),
  createStep: (id: string, b: Partial<WorkflowStep>) => request<WorkflowStep>(`/api/v1/dashboard/workflows/${id}/steps`, { method: "POST", body: b }),
  listTransitions: (id: string) => request<WorkflowTransition[]>(`/api/v1/dashboard/workflows/${id}/transitions`),
  createTransition: (id: string, b: Partial<WorkflowTransition>) =>
    request<WorkflowTransition>(`/api/v1/dashboard/workflows/${id}/transitions`, { method: "POST", body: b }),
  createStepAction: (stepId: string, body: unknown) =>
    request<void>(`/api/v1/dashboard/workflows/steps/${stepId}/actions`, { method: "POST", body }),
  createTransitionCondition: (transitionId: string, body: unknown) =>
    request<void>(`/api/v1/dashboard/workflows/transitions/${transitionId}/conditions`, { method: "POST", body }),
  listInstances: () => request<WorkflowInstance[]>("/api/v1/dashboard/workflow-instances"),
  transitionInstance: (id: string, body: { toStepId: string; comment?: string }) =>
    request<void>(`/api/v1/dashboard/workflow-instances/${id}/transition`, { method: "POST", body }),
};

// ================= ORDERS =================
export const ordersApi = {
  list: (q: { companyId?: string; statusCode?: string; page?: number; pageSize?: number } = {}) =>
    paginated<OrderSummary>("/api/v1/dashboard/orders", q),
  get: (id: string) => request<OrderDetail>(`/api/v1/dashboard/orders/${id}`),
  transition: (id: string, body: { toStepId: string; comment?: string; context?: unknown }) =>
    request<void>(`/api/v1/dashboard/orders/${id}/transitions`, { method: "POST", body }),
  addNote: (id: string, body: { note: string; isInternal?: boolean }) =>
    request<void>(`/api/v1/dashboard/orders/${id}/notes`, { method: "POST", body }),
  decideApproval: (id: string, level: number, body: { decision: "approved" | "rejected"; comment?: string }) =>
    request<void>(`/api/v1/dashboard/orders/${id}/approvals/${level}/decide`, { method: "POST", body }),
  assignDelivery: (id: string, deliveryUserId: string) =>
    request<void>(`/api/v1/dashboard/orders/${id}/assign-delivery`, { method: "POST", body: { deliveryUserId } }),
  awaitingPickup: (id: string) =>
    request<void>(`/api/v1/dashboard/orders/${id}/awaiting-pickup`, { method: "POST" }),
  confirmPickup: (id: string) =>
    request<void>(`/api/v1/dashboard/orders/${id}/confirm-pickup`, { method: "POST" }),
};

// ================= DELIVERY =================
export const deliveryApi = {
  users: () => request<DeliveryUser[]>("/api/v1/dashboard/delivery/users"),
  myOrders: () => request<DeliveryOrderView[]>("/api/v1/dashboard/delivery/orders"),
  depart: (id: string) => request<void>(`/api/v1/dashboard/delivery/orders/${id}/depart`, { method: "POST" }),
  confirmDelivery: (id: string, qrToken: string) =>
    request<void>(`/api/v1/dashboard/delivery/orders/${id}/confirm-delivery`, { method: "POST", body: { qrToken } }),
};

// ================= APPROVAL WORKFLOWS =================
export const approvalWorkflowsApi = {
  list: () => request<ApprovalWorkflow[]>("/api/v1/dashboard/approval-workflows"),
  create: (b: Partial<ApprovalWorkflow>) => request<ApprovalWorkflow>("/api/v1/dashboard/approval-workflows", { method: "POST", body: b }),
  update: (id: string, b: Partial<ApprovalWorkflow>) => request<ApprovalWorkflow>(`/api/v1/dashboard/approval-workflows/${id}`, { method: "PATCH", body: b }),
  listSteps: (id: string) => request<ApprovalStep[]>(`/api/v1/dashboard/approval-workflows/${id}/steps`),
  createStep: (id: string, b: Partial<ApprovalStep>) => request<ApprovalStep>(`/api/v1/dashboard/approval-workflows/${id}/steps`, { method: "POST", body: b }),
  listRequests: () => request<ApprovalRequest[]>("/api/v1/dashboard/approval-requests"),
  decide: (id: string, body: { decision: "approved" | "rejected"; comment?: string }) =>
    request<void>(`/api/v1/dashboard/approval-requests/${id}/decide`, { method: "POST", body }),
};

// ================= AUDIT / NOTIF / JOBS / INTEGRATIONS / LOCALIZATION =================
export const auditApi = {
  list: (q: { entityType?: string; entityId?: string; page?: number; pageSize?: number } = {}) =>
    paginated<AuditLog>("/api/v1/dashboard/audit-logs", q),
};

export const notificationsApi = {
  list: () => request<NotificationTemplate[]>("/api/v1/dashboard/notification-templates"),
  create: (b: Partial<NotificationTemplate>) => request<NotificationTemplate>("/api/v1/dashboard/notification-templates", { method: "POST", body: b }),
  update: (id: string, b: Partial<NotificationTemplate>) =>
    request<NotificationTemplate>(`/api/v1/dashboard/notification-templates/${id}`, { method: "PATCH", body: b }),
};

export const jobsApi = {
  list: (q: { jobType?: string; status?: string; page?: number } = {}) => paginated<BackgroundJob>("/api/v1/dashboard/jobs", q),
  get: (id: string) => request<BackgroundJob>(`/api/v1/dashboard/jobs/${id}`),
  retry: (id: string) => request<void>(`/api/v1/dashboard/jobs/${id}/retry`, { method: "POST" }),
  cancel: (id: string) => request<void>(`/api/v1/dashboard/jobs/${id}/cancel`, { method: "POST" }),
};

export const integrationsApi = {
  listSystems: () => request<ExternalSystem[]>("/api/v1/dashboard/integrations/systems"),
  createSystem: (b: Partial<ExternalSystem>) => request<ExternalSystem>("/api/v1/dashboard/integrations/systems", { method: "POST", body: b }),
  updateSystem: (id: string, b: Partial<ExternalSystem>) =>
    request<ExternalSystem>(`/api/v1/dashboard/integrations/systems/${id}`, { method: "PATCH", body: b }),
  listMappings: (id: string) => request<IntegrationMapping[]>(`/api/v1/dashboard/integrations/systems/${id}/mappings`),
  listEvents: () => request<IntegrationEvent[]>("/api/v1/dashboard/integrations/events"),
};

export const localizationApi = {
  listLanguages: () => request<Language[]>("/api/v1/dashboard/languages"),
  createLanguage: (b: Partial<Language>) => request<Language>("/api/v1/dashboard/languages", { method: "POST", body: b }),
  updateLanguage: (id: string, b: Partial<Language>) => request<Language>(`/api/v1/dashboard/languages/${id}`, { method: "PATCH", body: b }),
  listTranslations: (q: { entityType?: string; entityId?: string; languageCode?: string } = {}) =>
    request<Translation[]>("/api/v1/dashboard/translations", { query: q }),
  upsertTranslations: (translations: Translation[]) =>
    request<void>("/api/v1/dashboard/translations", { method: "PUT", body: { translations } }),
};

export const settingsApi = {
  getGlobal: () => request<GlobalSettings>("/api/v1/dashboard/settings/global"),
  updateGlobal: (body: unknown) => request<GlobalSettings>("/api/v1/dashboard/settings/global", { method: "PUT", body }),
};

// ================= FILES =================
export const filesApi = {
  upload: (file: File, entityType: string, entityId: string, attachmentType: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("entityType", entityType);
    fd.append("entityId", entityId);
    fd.append("attachmentType", attachmentType);
    return request<{ id: string; url: string | null }>("/api/v1/files", { method: "POST", formData: fd });
  },
};
