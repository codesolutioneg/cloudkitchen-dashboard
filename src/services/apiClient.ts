// Thin typed API client. All functions match backend endpoints exactly.
// Unwraps { success, data, meta } envelope and throws ApiError on failure.

import type {
  ApiResponse,
  AuthTokens,
  DashboardMe,
  NavigationNode,
  CompanySummary,
  VerifiedDocument,
  ApprovalStatus,
  CompanyCatalogAssignment,
  Role,
  PagePermissionInput,
  Permission,
  DashboardUser,
  InviteUserInput,
  Feature,
  Module,
  FeatureGroup,
  FeatureFlag,
  DashboardPage,
  Category,
  Product,
  PricingList,
  CustomProductRequest,
  Menu,
  MenuSection,
  RuleType,
  BusinessRule,
  Calendar,
  CalendarEvent,
  Workflow,
  WorkflowStep,
  WorkflowTransition,
  WorkflowInstance,
  OrderSummary,
  OrderDetail,
  OrderPaymentInfo,
  DeliveryUser,
  DeliveryOrderView,
  ApprovalWorkflow,
  ApprovalStep,
  ApprovalRequest,
  ApprovalRequestDetail,
  AuditLog,
  NotificationTemplate,
  BackgroundJob,
  ExternalSystem,
  IntegrationMapping,
  IntegrationEvent,
  Language,
  Translation,
  GlobalSettings,
  ProductVariant,
  ProductOptionGroup,
  ProductAvailability,
  ProductTag,
  ProductMedia,
  SectionProduct,
  MenuAssignment,
  AnalyticsOverview,
  ProductNutrition,
  NutritionInput,
  MealPlan,
  MealPlanDetail,
  MealPlanDay,
  MealPlanCandidate,
  MealPlanPreview,
  MealPlanBriefInput,
  MealComponentType,
} from "@/types/api";

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "https://api.cloud-kitchen.code-solution.org";

const ACCESS_KEY = "ck.accessToken";
const REFRESH_KEY = "ck.refreshToken";

export const tokenStore = {
  get access() {
    return typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY);
  },
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
  _retry?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(new URL("/api/v1/auth/dashboard/refresh", BASE_URL), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: refresh }),
        });
        const payload = (await res.json()) as ApiResponse<AuthTokens>;
        if (!res.ok || !payload.success) return false;
        tokenStore.set(payload.data);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
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

  if (res.status === 401 && !opts._retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(path, { ...opts, _retry: true });
    tokenStore.clear();
  }

  if (res.status === 204) {
    if (!res.ok) {
      throw new ApiClientError(res.status, "unknown_error", `Request failed (${res.status})`);
    }
    return undefined as T;
  }

  const text = await res.text();
  let payload: ApiResponse<T> | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as ApiResponse<T>;
    } catch {
      /* non-json body */
    }
  }

  if (!res.ok) {
    const err =
      payload && payload.success === false
        ? payload.error
        : { code: "unknown_error", message: text || `Request failed (${res.status})` };
    throw new ApiClientError(
      res.status,
      err.code,
      err.message,
      "details" in err ? err.details : undefined,
    );
  }

  if (payload && payload.success === false) {
    const err = payload.error;
    throw new ApiClientError(
      res.status,
      err.code,
      err.message,
      "details" in err ? err.details : undefined,
    );
  }

  if (payload && payload.success === true) {
    return payload.data;
  }

  return undefined as T;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
}

async function paginated<T>(
  path: string,
  query?: RequestOptions["query"],
  retry = false,
): Promise<Paginated<T>> {
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

  if (res.status === 401 && !retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return paginated<T>(path, query, true);
    tokenStore.clear();
  }

  let payload: ApiResponse<T[]> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T[]>;
  } catch {
    /* ignore */
  }
  if (!res.ok || !payload || payload.success === false) {
    const err =
      payload && payload.success === false
        ? payload.error
        : { code: "unknown_error", message: `Request failed (${res.status})` };
    throw new ApiClientError(res.status, err.code, err.message);
  }
  const p = payload.meta.pagination ?? {
    page: 1,
    pageSize: payload.data.length,
    totalItems: payload.data.length,
  };
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
    request<CompanySummary>(`/api/v1/dashboard/companies/${id}/approve`, {
      method: "POST",
      body: { reason },
    }),
  reject: (id: string, reason?: string) =>
    request<CompanySummary>(`/api/v1/dashboard/companies/${id}/reject`, {
      method: "POST",
      body: { reason },
    }),
  verifyDocument: (id: string, attachmentId: string, verificationStatus: "verified" | "rejected") =>
    request<VerifiedDocument>(
      `/api/v1/dashboard/companies/${id}/documents/${attachmentId}/verify`,
      { method: "PATCH", body: { verificationStatus } },
    ),
  users: (id: string) => request<DashboardUser[]>(`/api/v1/dashboard/companies/${id}/users`),
  getSettings: (companyId: string) =>
    request<{ companyId: string; settings: Record<string, unknown> }>(
      `/api/v1/dashboard/settings/company/${companyId}`,
    ),
  updateSettings: (companyId: string, settings: Record<string, unknown>) =>
    request<{ companyId: string; settings: Record<string, unknown> }>(
      `/api/v1/dashboard/settings/company/${companyId}`,
      { method: "PUT", body: settings },
    ),
  getFeatures: (companyId: string) =>
    request<Array<{ id: string; featureId: string; featureCode: string; isEnabled: boolean }>>(
      `/api/v1/dashboard/companies/${companyId}/features`,
    ),
  updateFeatures: (companyId: string, body: unknown) =>
    request<Feature[]>(`/api/v1/dashboard/companies/${companyId}/features`, {
      method: "PUT",
      body,
    }),
  getModules: (companyId: string) =>
    request<Array<{ id: string; moduleId: string; moduleCode: string; isEnabled: boolean }>>(
      `/api/v1/dashboard/companies/${companyId}/modules`,
    ),
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
    request<void>(`/api/v1/dashboard/roles/${id}/page-permissions`, {
      method: "PUT",
      body: { pages },
    }),
  setApiPermissions: (
    id: string,
    permissions: Array<{ permissionId: string; effect: "allow" | "deny" }>,
  ) =>
    request<void>(`/api/v1/dashboard/roles/${id}/permissions`, {
      method: "PUT",
      body: { permissions },
    }),
  getFeatures: (roleId: string) => request<Feature[]>(`/api/v1/dashboard/roles/${roleId}/features`),
  updateFeatures: (roleId: string, body: unknown) =>
    request<Feature[]>(`/api/v1/dashboard/roles/${roleId}/features`, { method: "PUT", body }),
  getModules: (roleId: string) => request<Module[]>(`/api/v1/dashboard/roles/${roleId}/modules`),
  updateModules: (roleId: string, body: unknown) =>
    request<Module[]>(`/api/v1/dashboard/roles/${roleId}/modules`, { method: "PUT", body }),
};

export const permissionsApi = {
  list: async () => {
    const groups = await request<Array<{ permissions: Permission[] }>>(
      "/api/v1/dashboard/permissions",
    );
    return groups.flatMap((g) => g.permissions);
  },
};

// ================= DASHBOARD USERS =================
export const dashboardUsersApi = {
  list: (q: { page?: number; pageSize?: number } = {}) =>
    paginated<DashboardUser>("/api/v1/dashboard/users", q),
  invite: (body: InviteUserInput) =>
    request<DashboardUser>("/api/v1/dashboard/users", { method: "POST", body }),
  assignRoles: (id: string, roleIds: string[]) =>
    request<void>(`/api/v1/dashboard/users/${id}/roles`, { method: "POST", body: { roleIds } }),
  setCompanyScope: (
    id: string,
    body: { scopeType: "all" | "specific" | "companies"; companyIds?: string[] },
  ) => {
    const scopeType = body.scopeType === "companies" ? "specific" : body.scopeType;
    return request<void>(`/api/v1/dashboard/users/${id}/company-scope`, {
      method: "PUT",
      body: { scopeType, companyIds: body.companyIds },
    });
  },
};

// ================= FEATURES / MODULES =================
export const featuresApi = {
  list: () => request<Feature[]>("/api/v1/dashboard/features"),
  create: (b: Partial<Feature>) =>
    request<Feature>("/api/v1/dashboard/features", { method: "POST", body: b }),
  update: (id: string, b: Partial<Feature>) =>
    request<Feature>(`/api/v1/dashboard/features/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) => request<void>(`/api/v1/dashboard/features/${id}`, { method: "DELETE" }),
};
export const featureGroupsApi = {
  list: () => request<FeatureGroup[]>("/api/v1/dashboard/feature-groups"),
  create: (b: Partial<FeatureGroup>) =>
    request<FeatureGroup>("/api/v1/dashboard/feature-groups", { method: "POST", body: b }),
  update: (id: string, b: Partial<FeatureGroup>) =>
    request<FeatureGroup>(`/api/v1/dashboard/feature-groups/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) =>
    request<void>(`/api/v1/dashboard/feature-groups/${id}`, { method: "DELETE" }),
};
export const modulesApi = {
  list: () => request<Module[]>("/api/v1/dashboard/modules"),
  create: (b: Partial<Module>) =>
    request<Module>("/api/v1/dashboard/modules", { method: "POST", body: b }),
  update: (id: string, b: Partial<Module>) =>
    request<Module>(`/api/v1/dashboard/modules/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) => request<void>(`/api/v1/dashboard/modules/${id}`, { method: "DELETE" }),
};
export const featureFlagsApi = {
  list: () => request<FeatureFlag[]>("/api/v1/dashboard/feature-flags"),
  create: (b: Partial<FeatureFlag>) =>
    request<FeatureFlag>("/api/v1/dashboard/feature-flags", { method: "POST", body: b }),
  update: (id: string, b: Partial<FeatureFlag>) =>
    request<FeatureFlag>(`/api/v1/dashboard/feature-flags/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) =>
    request<void>(`/api/v1/dashboard/feature-flags/${id}`, { method: "DELETE" }),
};
export const dashboardPagesApi = {
  list: () => request<DashboardPage[]>("/api/v1/dashboard/dashboard-pages"),
  create: (b: Partial<DashboardPage>) =>
    request<DashboardPage>("/api/v1/dashboard/dashboard-pages", { method: "POST", body: b }),
  update: (id: string, b: Partial<DashboardPage>) =>
    request<DashboardPage>(`/api/v1/dashboard/dashboard-pages/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) =>
    request<void>(`/api/v1/dashboard/dashboard-pages/${id}`, { method: "DELETE" }),
};

// ================= CATALOG =================
export const catalogApi = {
  listCategories: () => request<Category[]>("/api/v1/dashboard/catalog/categories"),
  createCategory: (b: Partial<Category>) =>
    request<Category>("/api/v1/dashboard/catalog/categories", { method: "POST", body: b }),
  updateCategory: (id: string, b: Partial<Category>) =>
    request<Category>(`/api/v1/dashboard/catalog/categories/${id}`, { method: "PATCH", body: b }),
  deleteCategory: (id: string) =>
    request<void>(`/api/v1/dashboard/catalog/categories/${id}`, { method: "DELETE" }),

  listProducts: (
    q: { page?: number; pageSize?: number; categoryId?: string; search?: string } = {},
  ) => paginated<Product>("/api/v1/dashboard/catalog/products", q),
  getProduct: (id: string) => request<Product>(`/api/v1/dashboard/catalog/products/${id}`),
  createProduct: (b: Partial<Product>) =>
    request<Product>("/api/v1/dashboard/catalog/products", { method: "POST", body: b }),
  updateProduct: (id: string, b: Partial<Product>) =>
    request<Product>(`/api/v1/dashboard/catalog/products/${id}`, { method: "PATCH", body: b }),
  deleteProduct: (id: string) =>
    request<void>(`/api/v1/dashboard/catalog/products/${id}`, { method: "DELETE" }),
  updateProductTranslation: (
    id: string,
    lang: string,
    body: { name: string; description?: string },
  ) =>
    request<void>(`/api/v1/dashboard/catalog/products/${id}/translations/${lang}`, {
      method: "PUT",
      body,
    }),

  listPricingLists: () => request<PricingList[]>("/api/v1/dashboard/catalog/pricing-lists"),
  createPricingList: (b: Partial<PricingList>) =>
    request<PricingList>("/api/v1/dashboard/catalog/pricing-lists", { method: "POST", body: b }),
  createPrice: (body: {
    pricingListId: string;
    productId: string;
    variantId?: string;
    price: string;
    effectiveFrom?: string;
    effectiveTo?: string;
  }) => request<void>("/api/v1/dashboard/catalog/prices", { method: "POST", body }),
  assignToCompany: (body: {
    companyId: string;
    pricingListId: string;
    effectiveFrom?: string;
    effectiveTo?: string;
  }) => request<void>("/api/v1/dashboard/catalog/company-assignment", { method: "POST", body }),
  deletePricingAssignment: (assignmentId: string) =>
    request<void>(`/api/v1/dashboard/catalog/company-assignment/${assignmentId}`, {
      method: "DELETE",
    }),
  listCompanyAssignments: (q: { companyId?: string; approvalStatus?: string } = {}) =>
    request<CompanyCatalogAssignment[]>("/api/v1/dashboard/catalog/company-assignments", {
      query: q,
    }),
  listCustomProducts: (q: { status?: string; companyId?: string } = {}) =>
    request<CustomProductRequest[]>("/api/v1/dashboard/catalog/custom-products", { query: q }),
  approveCustomProduct: (id: string, body: { basePrice: number; currency?: string }) =>
    request<CustomProductRequest>(`/api/v1/dashboard/catalog/custom-products/${id}/approve`, {
      method: "POST",
      body,
    }),
  rejectCustomProduct: (id: string, body: { reason?: string } = {}) =>
    request<CustomProductRequest>(`/api/v1/dashboard/catalog/custom-products/${id}/reject`, {
      method: "POST",
      body,
    }),
};

// ================= MENUS =================
export const menusApi = {
  list: () => request<Menu[]>("/api/v1/dashboard/menus"),
  create: (b: Partial<Menu>) =>
    request<Menu>("/api/v1/dashboard/menus", { method: "POST", body: b }),
  get: (id: string) => request<Menu>(`/api/v1/dashboard/menus/${id}`),
  update: (id: string, b: Partial<Menu>) =>
    request<Menu>(`/api/v1/dashboard/menus/${id}`, { method: "PATCH", body: b }),
  setGeneral: (id: string) =>
    request<Menu>(`/api/v1/dashboard/menus/${id}/set-general`, { method: "POST" }),
  listSections: (menuId: string) =>
    request<MenuSection[]>(`/api/v1/dashboard/menus/${menuId}/sections`),
  createSection: (menuId: string, b: Partial<MenuSection>) =>
    request<MenuSection>(`/api/v1/dashboard/menus/${menuId}/sections`, { method: "POST", body: b }),
  addSectionProduct: (
    menuId: string,
    sectionId: string,
    body: { productId: string; sortOrder: number },
  ) =>
    request<void>(`/api/v1/dashboard/menus/${menuId}/sections/${sectionId}/products`, {
      method: "POST",
      body,
    }),
  listAssignments: (menuId: string) =>
    request<MenuAssignment[]>(`/api/v1/dashboard/menus/${menuId}/assignments`),
  createAssignment: (
    menuId: string,
    body: {
      scopeType: "company" | "department" | "user" | "campaign";
      scopeId: string;
      priority: number;
    },
  ) =>
    request<MenuAssignment>(`/api/v1/dashboard/menus/${menuId}/assignments`, {
      method: "POST",
      body,
    }),
};

// ================= BUSINESS RULES =================
export const rulesApi = {
  listRuleTypes: () => request<RuleType[]>("/api/v1/dashboard/rules/rule-types"),
  createRuleType: (b: Partial<RuleType>) =>
    request<RuleType>("/api/v1/dashboard/rules/rule-types", { method: "POST", body: b }),

  listBusinessRules: () => request<BusinessRule[]>("/api/v1/dashboard/rules/business-rules"),
  createBusinessRule: (b: Partial<BusinessRule>) =>
    request<BusinessRule>("/api/v1/dashboard/rules/business-rules", { method: "POST", body: b }),
  updateBusinessRule: (id: string, b: Partial<BusinessRule>) =>
    request<BusinessRule>(`/api/v1/dashboard/rules/business-rules/${id}`, {
      method: "PATCH",
      body: b,
    }),
  deleteBusinessRule: (id: string) =>
    request<void>(`/api/v1/dashboard/rules/business-rules/${id}`, { method: "DELETE" }),
  resolve: (q: { ruleTypeCode: string; companyId?: string }) =>
    request<BusinessRule>("/api/v1/dashboard/rules/business-rules/resolve", { query: q }),

  listCalendars: () => request<Calendar[]>("/api/v1/dashboard/rules/calendars"),
  createCalendar: (b: Partial<Calendar>) =>
    request<Calendar>("/api/v1/dashboard/rules/calendars", { method: "POST", body: b }),
  listEvents: (calendarId: string) =>
    request<CalendarEvent[]>(`/api/v1/dashboard/rules/calendars/${calendarId}/events`),
  createEvent: (calendarId: string, body: Partial<CalendarEvent>) =>
    request<CalendarEvent>(`/api/v1/dashboard/rules/calendars/${calendarId}/events`, {
      method: "POST",
      body,
    }),
};

// ================= WORKFLOWS =================
export const workflowsApi = {
  list: (q: { workflowType?: string } = {}) =>
    request<Workflow[]>("/api/v1/dashboard/workflows", { query: q }),
  create: (b: Partial<Workflow>) =>
    request<Workflow>("/api/v1/dashboard/workflows", { method: "POST", body: b }),
  listSteps: (id: string) => request<WorkflowStep[]>(`/api/v1/dashboard/workflows/${id}/steps`),
  createStep: (id: string, b: Partial<WorkflowStep>) =>
    request<WorkflowStep>(`/api/v1/dashboard/workflows/${id}/steps`, { method: "POST", body: b }),
  listTransitions: (id: string) =>
    request<WorkflowTransition[]>(`/api/v1/dashboard/workflows/${id}/transitions`),
  createTransition: (id: string, b: Partial<WorkflowTransition>) =>
    request<WorkflowTransition>(`/api/v1/dashboard/workflows/${id}/transitions`, {
      method: "POST",
      body: b,
    }),
  createStepAction: (stepId: string, body: unknown) =>
    request<void>(`/api/v1/dashboard/workflows/steps/${stepId}/actions`, { method: "POST", body }),
  createTransitionCondition: (transitionId: string, body: unknown) =>
    request<void>(`/api/v1/dashboard/workflows/transitions/${transitionId}/conditions`, {
      method: "POST",
      body,
    }),
  listInstances: () => request<WorkflowInstance[]>("/api/v1/dashboard/workflow-instances"),
  transitionInstance: (id: string, body: { toStepId: string; comment?: string }) =>
    request<void>(`/api/v1/dashboard/workflow-instances/${id}/transition`, {
      method: "POST",
      body,
    }),
};

// ================= ORDERS =================
export const ordersApi = {
  list: (q: { companyId?: string; statusCode?: string; page?: number; pageSize?: number } = {}) =>
    paginated<OrderSummary>("/api/v1/dashboard/orders", q),
  get: (id: string) => request<OrderDetail>(`/api/v1/dashboard/orders/${id}`),
  update: (
    id: string,
    body: {
      requestedDeliveryAt?: string;
      fulfillmentType?: "delivery" | "pickup";
      deliveryAddressId?: string | null;
    },
  ) => request<OrderDetail>(`/api/v1/dashboard/orders/${id}`, { method: "PATCH", body }),
  transition: (id: string, body: { toStepId: string; comment?: string; context?: unknown }) =>
    request<void>(`/api/v1/dashboard/orders/${id}/transitions`, { method: "POST", body }),
  addNote: (id: string, body: { note: string; isInternal?: boolean }) =>
    request<void>(`/api/v1/dashboard/orders/${id}/notes`, { method: "POST", body }),
  decideApproval: (
    id: string,
    level: number,
    body: { decision: "approved" | "rejected"; comment?: string },
  ) =>
    request<void>(`/api/v1/dashboard/orders/${id}/approvals/${level}/decide`, {
      method: "POST",
      body,
    }),
  assignDelivery: (id: string, deliveryUserId: string) =>
    request<void>(`/api/v1/dashboard/orders/${id}/assign-delivery`, {
      method: "POST",
      body: { deliveryUserId },
    }),
  awaitingPickup: (id: string) =>
    request<void>(`/api/v1/dashboard/orders/${id}/awaiting-pickup`, { method: "POST" }),
  confirmPickup: (id: string) =>
    request<void>(`/api/v1/dashboard/orders/${id}/confirm-pickup`, { method: "POST" }),
  getPayment: (id: string) => request<OrderPaymentInfo>(`/api/v1/dashboard/orders/${id}/payment`),
  approvePayment: (id: string, body: { comment?: string } = {}) =>
    request<OrderPaymentInfo>(`/api/v1/dashboard/orders/${id}/payment/approve`, {
      method: "POST",
      body,
    }),
  rejectPayment: (id: string, body: { reason?: string } = {}) =>
    request<OrderPaymentInfo>(`/api/v1/dashboard/orders/${id}/payment/reject`, {
      method: "POST",
      body,
    }),
  downloadReceipt: async (id: string) => {
    const res = await fetch(new URL(`/api/v1/dashboard/orders/${id}/receipt`, BASE_URL), {
      headers: { Authorization: `Bearer ${tokenStore.access ?? ""}` },
    });
    if (!res.ok)
      throw new ApiClientError(res.status, "receipt_download_failed", "Failed to download receipt");
    return res.blob();
  },
};

// ================= ASSISTANT =================
export const assistantApi = {
  chat: (message: string, history: Array<{ role: "user" | "assistant"; content: string }> = []) =>
    request<{ reply: string }>("/api/v1/dashboard/assistant/chat", {
      method: "POST",
      body: { message, history },
    }),
};

// ================= DELIVERY =================
export const deliveryApi = {
  users: () => request<DeliveryUser[]>("/api/v1/dashboard/delivery/users"),
  myOrders: () => request<DeliveryOrderView[]>("/api/v1/dashboard/delivery/orders"),
  depart: (id: string) =>
    request<DeliveryOrderView>(`/api/v1/dashboard/delivery/orders/${id}/depart`, {
      method: "POST",
    }),
  confirmDelivery: (id: string, qrToken: string) =>
    request<DeliveryOrderView>(`/api/v1/dashboard/delivery/orders/${id}/confirm-delivery`, {
      method: "POST",
      body: { qrToken },
    }),
  fulfillmentQr: (orderId: string) =>
    request<{ orderId: string; orderNumber: string; qrPayload: string; fulfillmentType: string }>(
      `/api/v1/dashboard/orders/${orderId}/fulfillment-qr`,
    ),
};

// ================= APPROVAL WORKFLOWS =================
export const approvalWorkflowsApi = {
  list: () => request<ApprovalWorkflow[]>("/api/v1/dashboard/approval-workflows"),
  create: (b: Partial<ApprovalWorkflow>) =>
    request<ApprovalWorkflow>("/api/v1/dashboard/approval-workflows", { method: "POST", body: b }),
  update: (id: string, b: Partial<ApprovalWorkflow>) =>
    request<ApprovalWorkflow>(`/api/v1/dashboard/approval-workflows/${id}`, {
      method: "PATCH",
      body: b,
    }),
  listSteps: (id: string) =>
    request<ApprovalStep[]>(`/api/v1/dashboard/approval-workflows/${id}/steps`),
  createStep: (id: string, b: Partial<ApprovalStep>) =>
    request<ApprovalStep>(`/api/v1/dashboard/approval-workflows/${id}/steps`, {
      method: "POST",
      body: b,
    }),
  listRequests: () => request<ApprovalRequest[]>("/api/v1/dashboard/approval-requests"),
  decide: (id: string, body: { decision: "approved" | "rejected"; comment?: string }) =>
    request<void>(`/api/v1/dashboard/approval-requests/${id}/decide`, { method: "POST", body }),
};

// ================= AUDIT / NOTIF / JOBS / INTEGRATIONS / LOCALIZATION =================
export const auditApi = {
  list: (
    q: {
      entityName?: string;
      entityId?: string;
      correlationId?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) => paginated<AuditLog>("/api/v1/dashboard/audit-logs", q),
};

export const notificationsApi = {
  list: () => request<NotificationTemplate[]>("/api/v1/dashboard/notification-templates"),
  create: (b: Partial<NotificationTemplate>) =>
    request<NotificationTemplate>("/api/v1/dashboard/notification-templates", {
      method: "POST",
      body: b,
    }),
  update: (id: string, b: Partial<NotificationTemplate>) =>
    request<NotificationTemplate>(`/api/v1/dashboard/notification-templates/${id}`, {
      method: "PATCH",
      body: b,
    }),
};

export const jobsApi = {
  list: (q: { jobType?: string; status?: string; page?: number } = {}) =>
    paginated<BackgroundJob>("/api/v1/dashboard/jobs", q),
  get: (id: string) => request<BackgroundJob>(`/api/v1/dashboard/jobs/${id}`),
  retry: (id: string) => request<void>(`/api/v1/dashboard/jobs/${id}/retry`, { method: "POST" }),
  cancel: (id: string) => request<void>(`/api/v1/dashboard/jobs/${id}/cancel`, { method: "POST" }),
};

export const integrationsApi = {
  listSystems: () => request<ExternalSystem[]>("/api/v1/dashboard/integrations/systems"),
  createSystem: (b: Partial<ExternalSystem>) =>
    request<ExternalSystem>("/api/v1/dashboard/integrations/systems", { method: "POST", body: b }),
  updateSystem: (id: string, b: Partial<ExternalSystem>) =>
    request<ExternalSystem>(`/api/v1/dashboard/integrations/systems/${id}`, {
      method: "PATCH",
      body: b,
    }),
  listMappings: (id: string) =>
    request<IntegrationMapping[]>(`/api/v1/dashboard/integrations/systems/${id}/mappings`),
  listEvents: () => request<IntegrationEvent[]>("/api/v1/dashboard/integrations/events"),
};

export const localizationApi = {
  listLanguages: () => request<Language[]>("/api/v1/dashboard/languages"),
  createLanguage: (b: Partial<Language>) =>
    request<Language>("/api/v1/dashboard/languages", { method: "POST", body: b }),
  updateLanguage: (id: string, b: Partial<Language>) =>
    request<Language>(`/api/v1/dashboard/languages/${id}`, { method: "PATCH", body: b }),
  listTranslations: (q: { entityType?: string; entityId?: string; languageCode?: string } = {}) =>
    request<Translation[]>("/api/v1/dashboard/translations", { query: q }),
  upsertTranslations: (translations: Translation[]) =>
    request<void>("/api/v1/dashboard/translations", { method: "PUT", body: { translations } }),
};

export const settingsApi = {
  getGlobal: () => request<GlobalSettings>("/api/v1/dashboard/settings/global"),
  updateGlobal: (settings: Record<string, unknown>) =>
    request<GlobalSettings>("/api/v1/dashboard/settings/global", { method: "PUT", body: settings }),
};

// ================= FILES =================
export const filesApi = {
  upload: (file: File, entityType: string, entityId: string, attachmentType: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("entityType", entityType);
    fd.append("entityId", entityId);
    fd.append("attachmentType", attachmentType);
    return request<{ id: string; url: string | null }>("/api/v1/files", {
      method: "POST",
      formData: fd,
    });
  },
};

// ================= EXTENSIONS =================

// Companies: documents list + approval submit
export const companyDocumentsApi = {
  list: (companyId: string) =>
    request<VerifiedDocument[]>(`/api/v1/dashboard/companies/${companyId}/documents`),
};

// Catalog extensions
export const catalogExtApi = {
  listVariants: (productId: string) =>
    request<ProductVariant[]>(`/api/v1/dashboard/catalog/products/${productId}/variants`),
  createVariant: (productId: string, b: Partial<ProductVariant>) =>
    request<ProductVariant>(`/api/v1/dashboard/catalog/products/${productId}/variants`, {
      method: "POST",
      body: {
        variantName: b.name ?? "",
        sku: b.sku ?? undefined,
        priceAdjustment: b.priceDelta ?? "0",
        isActive: b.isActive ?? true,
      },
    }),
  updateVariant: (productId: string, variantId: string, b: Partial<ProductVariant>) =>
    request<ProductVariant>(
      `/api/v1/dashboard/catalog/products/${productId}/variants/${variantId}`,
      { method: "PATCH", body: b },
    ),

  listOptionGroups: (productId: string) =>
    request<ProductOptionGroup[]>(`/api/v1/dashboard/catalog/products/${productId}/option-groups`),
  createOptionGroup: (productId: string, b: Partial<ProductOptionGroup>) =>
    request<ProductOptionGroup>(`/api/v1/dashboard/catalog/products/${productId}/option-groups`, {
      method: "POST",
      body: b,
    }),
  updateOptionGroup: (productId: string, groupId: string, b: Partial<ProductOptionGroup>) =>
    request<ProductOptionGroup>(
      `/api/v1/dashboard/catalog/products/${productId}/option-groups/${groupId}`,
      { method: "PATCH", body: b },
    ),

  listAvailability: (productId: string) =>
    request<ProductAvailability[]>(`/api/v1/dashboard/catalog/products/${productId}/availability`),
  createAvailability: (productId: string, b: Partial<ProductAvailability>) =>
    request<ProductAvailability>(`/api/v1/dashboard/catalog/products/${productId}/availability`, {
      method: "POST",
      body: b,
    }),
  updateAvailability: (
    productId: string,
    availabilityId: string,
    b: Partial<ProductAvailability>,
  ) =>
    request<ProductAvailability>(
      `/api/v1/dashboard/catalog/products/${productId}/availability/${availabilityId}`,
      { method: "PATCH", body: b },
    ),
  deleteAvailability: (productId: string, availabilityId: string) =>
    request<void>(
      `/api/v1/dashboard/catalog/products/${productId}/availability/${availabilityId}`,
      { method: "DELETE" },
    ),

  listTags: (productId: string) =>
    request<ProductTag[]>(`/api/v1/dashboard/catalog/products/${productId}/tags`),
  addTag: (productId: string, tag: string) =>
    request<ProductTag>(`/api/v1/dashboard/catalog/products/${productId}/tags`, {
      method: "POST",
      body: { tagName: tag },
    }),
  removeTag: (productId: string, tagId: string) =>
    request<void>(`/api/v1/dashboard/catalog/products/${productId}/tags/${tagId}`, {
      method: "DELETE",
    }),

  listMedia: (productId: string) =>
    request<ProductMedia[]>(`/api/v1/dashboard/catalog/products/${productId}/media`),
  uploadImage: (productId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ productId: string; imageUrl: string }>(
      `/api/v1/dashboard/catalog/products/${productId}/image`,
      { method: "POST", formData: fd },
    );
  },
  setImageUrl: (productId: string, imageUrl: string | null) =>
    request<{ productId: string; imageUrl: string | null }>(
      `/api/v1/dashboard/catalog/products/${productId}/image`,
      { method: "PUT", body: { imageUrl } },
    ),
  deleteMedia: (productId: string, mediaId: string) =>
    request<void>(`/api/v1/dashboard/catalog/products/${productId}/media/${mediaId}`, {
      method: "DELETE",
    }),
};

// ================= NUTRITION =================
export const nutritionApi = {
  get: (productId: string) =>
    request<ProductNutrition | null>(`/api/v1/dashboard/catalog/products/${productId}/nutrition`),
  upsert: (productId: string, body: NutritionInput) =>
    request<ProductNutrition>(`/api/v1/dashboard/catalog/products/${productId}/nutrition`, {
      method: "PUT",
      body,
    }),
  remove: (productId: string) =>
    request<void>(`/api/v1/dashboard/catalog/products/${productId}/nutrition`, {
      method: "DELETE",
    }),
};

// ================= MEAL PLANS =================
export const mealPlansApi = {
  list: (q: { companyId?: string; status?: string; page?: number; pageSize?: number } = {}) =>
    paginated<MealPlan>("/api/v1/dashboard/meal-plans", q),
  get: (id: string) => request<MealPlanDetail>(`/api/v1/dashboard/meal-plans/${id}`),
  create: (body: MealPlanBriefInput) =>
    request<MealPlan>("/api/v1/dashboard/meal-plans", { method: "POST", body }),
  update: (id: string, body: Partial<MealPlanBriefInput>) =>
    request<MealPlan>(`/api/v1/dashboard/meal-plans/${id}`, { method: "PATCH", body }),
  archive: (id: string) =>
    request<void>(`/api/v1/dashboard/meal-plans/${id}`, { method: "DELETE" }),
  generate: (id: string, keepLockedItems = true) =>
    request<MealPlanDetail>(`/api/v1/dashboard/meal-plans/${id}/generate`, {
      method: "POST",
      body: { keepLockedItems },
    }),
  approve: (id: string) =>
    request<MealPlan>(`/api/v1/dashboard/meal-plans/${id}/approve`, { method: "POST" }),
  duplicate: (id: string) =>
    request<MealPlan>(`/api/v1/dashboard/meal-plans/${id}/duplicate`, { method: "POST" }),
  preview: (body: Omit<MealPlanBriefInput, "name" | "currency">) =>
    request<MealPlanPreview>("/api/v1/dashboard/meal-plans/preview", { method: "POST", body }),
  candidates: (q: {
    companyId: string;
    sourceMenuId?: string;
    pricingListId?: string;
    componentType?: MealComponentType;
  }) => request<MealPlanCandidate[]>("/api/v1/dashboard/meal-plans/candidates", { query: q }),
  addItem: (
    planId: string,
    dayId: string,
    body: {
      productId: string;
      componentType?: MealComponentType;
      quantity?: number;
      isLocked?: boolean;
    },
  ) =>
    request<MealPlanDay>(`/api/v1/dashboard/meal-plans/${planId}/days/${dayId}/items`, {
      method: "POST",
      body,
    }),
  updateItem: (
    planId: string,
    dayId: string,
    itemId: string,
    body: { quantity?: number; isLocked?: boolean },
  ) =>
    request<MealPlanDay>(`/api/v1/dashboard/meal-plans/${planId}/days/${dayId}/items/${itemId}`, {
      method: "PATCH",
      body,
    }),
  removeItem: (planId: string, dayId: string, itemId: string) =>
    request<void>(`/api/v1/dashboard/meal-plans/${planId}/days/${dayId}/items/${itemId}`, {
      method: "DELETE",
    }),
};

// Menus extensions
export const menusExtApi = {
  update: (id: string, b: Partial<Menu>) =>
    request<Menu>(`/api/v1/dashboard/menus/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) => request<void>(`/api/v1/dashboard/menus/${id}`, { method: "DELETE" }),
  updateSection: (menuId: string, sectionId: string, b: Partial<MenuSection>) =>
    request<MenuSection>(`/api/v1/dashboard/menus/${menuId}/sections/${sectionId}`, {
      method: "PATCH",
      body: b,
    }),
  deleteSection: (menuId: string, sectionId: string) =>
    request<void>(`/api/v1/dashboard/menus/${menuId}/sections/${sectionId}`, { method: "DELETE" }),
  listSectionProducts: (menuId: string, sectionId: string) =>
    request<SectionProduct[]>(`/api/v1/dashboard/menus/${menuId}/sections/${sectionId}/products`),
  removeSectionProduct: (menuId: string, sectionId: string, productId: string) =>
    request<void>(`/api/v1/dashboard/menus/${menuId}/sections/${sectionId}/products/${productId}`, {
      method: "DELETE",
    }),
  listAssignments: (menuId: string) =>
    request<MenuAssignment[]>(`/api/v1/dashboard/menus/${menuId}/assignments`),
  deleteAssignment: (menuId: string, assignmentId: string) =>
    request<void>(`/api/v1/dashboard/menus/${menuId}/assignments/${assignmentId}`, {
      method: "DELETE",
    }),
};

// Workflow extensions
export const workflowsExtApi = {
  update: (id: string, b: Partial<Workflow>) =>
    request<Workflow>(`/api/v1/dashboard/workflows/${id}`, { method: "PATCH", body: b }),
  get: (id: string) => request<Workflow>(`/api/v1/dashboard/workflows/${id}`),
  updateStep: (workflowId: string, stepId: string, b: Partial<WorkflowStep>) =>
    request<WorkflowStep>(`/api/v1/dashboard/workflows/${workflowId}/steps/${stepId}`, {
      method: "PATCH",
      body: b,
    }),
  updateTransition: (workflowId: string, transitionId: string, b: Partial<WorkflowTransition>) =>
    request<WorkflowTransition>(
      `/api/v1/dashboard/workflows/${workflowId}/transitions/${transitionId}`,
      { method: "PATCH", body: b },
    ),
  createInstance: (body: { workflowId: string; entityType: string; entityId: string }) =>
    request<WorkflowInstance>("/api/v1/dashboard/workflow-instances", { method: "POST", body }),
};

// Rules extensions
export const rulesExtApi = {
  updateRuleType: (id: string, b: Partial<RuleType>) =>
    request<RuleType>(`/api/v1/dashboard/rules/rule-types/${id}`, { method: "PATCH", body: b }),
  getCalendar: (id: string) => request<Calendar>(`/api/v1/dashboard/rules/calendars/${id}`),
  updateCalendar: (id: string, b: Partial<Calendar>) =>
    request<Calendar>(`/api/v1/dashboard/rules/calendars/${id}`, { method: "PATCH", body: b }),
  updateEvent: (calendarId: string, eventId: string, b: Partial<CalendarEvent>) =>
    request<CalendarEvent>(`/api/v1/dashboard/rules/calendars/${calendarId}/events/${eventId}`, {
      method: "PATCH",
      body: b,
    }),
};

// Approval extensions
export const approvalWorkflowsExtApi = {
  get: (id: string) => request<ApprovalWorkflow>(`/api/v1/dashboard/approval-workflows/${id}`),
  updateStep: (workflowId: string, stepId: string, b: Partial<ApprovalStep>) =>
    request<ApprovalStep>(`/api/v1/dashboard/approval-workflows/${workflowId}/steps/${stepId}`, {
      method: "PATCH",
      body: b,
    }),
  getRequest: (id: string) =>
    request<ApprovalRequestDetail>(`/api/v1/dashboard/approval-requests/${id}`),
};

// Integrations extensions
export const integrationsExtApi = {
  getSystem: (id: string) =>
    request<ExternalSystem>(`/api/v1/dashboard/integrations/systems/${id}`),
  createMapping: (systemId: string, body: Partial<IntegrationMapping>) =>
    request<IntegrationMapping>(`/api/v1/dashboard/integrations/systems/${systemId}/mappings`, {
      method: "POST",
      body,
    }),
};

// ================= BILLING (admin) =================
export interface AdminInvoice {
  id: string;
  invoiceNumber: string;
  companyId: string;
  companyName: string | null;
  status: string;
  source: string;
  periodStart: string | null;
  periodEnd: string | null;
  dueAt: string | null;
  totalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  currency: string;
  poReference: string | null;
  lines: Array<{ id: string; description: string; lineTotal: string }>;
  instalments: Array<{
    id: string;
    sequence: number;
    dueAt: string;
    amount: string;
    status: string;
  }>;
}
export interface AdminBillingTerms {
  companyId: string;
  paymentMode: string;
  netDays: number;
  creditLimit: string;
  currency: string;
  poReference: string | null;
  notes: string | null;
}

export const billingApi = {
  listInvoices: (q: { companyId?: string; status?: string } = {}) =>
    request<AdminInvoice[]>("/api/v1/dashboard/invoices", { query: q }),
  getInvoice: (id: string) => request<AdminInvoice>(`/api/v1/dashboard/invoices/${id}`),
  getTerms: (companyId: string) =>
    request<AdminBillingTerms>(`/api/v1/dashboard/companies/${companyId}/billing-terms`),
  setTerms: (companyId: string, body: Partial<AdminBillingTerms>) =>
    request<AdminBillingTerms>(`/api/v1/dashboard/companies/${companyId}/billing-terms`, {
      method: "PUT",
      body,
    }),
  generateInvoice: (
    companyId: string,
    body: { periodStart: string; periodEnd: string; issue?: boolean },
  ) =>
    request<AdminInvoice>(`/api/v1/dashboard/companies/${companyId}/invoices`, {
      method: "POST",
      body,
    }),
  recordPayment: (invoiceId: string, amount: string) =>
    request<AdminInvoice>(`/api/v1/dashboard/invoices/${invoiceId}/payments`, {
      method: "POST",
      body: { amount },
    }),
  decideInstalment: (instalmentId: string, decision: "approved" | "rejected", reason?: string) =>
    request<AdminInvoice>(`/api/v1/dashboard/instalments/${instalmentId}/decide`, {
      method: "POST",
      body: { decision, reason },
    }),
  planInstalments: (
    planId: string,
    body: { count: number; firstDueDate: string; everyDays?: number },
  ) =>
    request<AdminInvoice>(`/api/v1/dashboard/meal-plans/${planId}/instalments`, {
      method: "POST",
      body,
    }),
  markOverdue: () =>
    request<{ invoicesMarked: number; instalmentsMarked: number }>(
      "/api/v1/dashboard/billing/mark-overdue",
      { method: "POST" },
    ),
};

// ================= COSTING =================
export interface Ingredient {
  id: string;
  sku: string | null;
  name: string;
  dimension: string;
  baseUom: string;
  purchasePrice: string;
  purchaseQty: string;
  purchaseUom: string;
  currency: string;
  yieldPercent: string;
  costPerBaseUnit: string;
  isActive: boolean;
  supplierName?: string | null;
  categoryName?: string | null;
}
export interface RecipeLine {
  id: string;
  ingredientId: string | null;
  ingredientName: string | null;
  subRecipeId: string | null;
  subRecipeName: string | null;
  quantity: string;
  uom: string;
  isOptional: boolean;
  lineCost: string | null;
}
export interface Recipe {
  id: string;
  name: string;
  recipeType: string;
  status: string;
  productId: string | null;
  productName: string | null;
  yieldQty: string;
  yieldUom: string;
  lines: RecipeLine[];
}
export interface ProductCostRow {
  /** DataTable keys rows on `id`; a cost row is identified by product and variant. */
  id?: string;
  productId: string;
  productName: string | null;
  variantName: string | null;
  currency: string;
  foodCost: string;
  packagingCost: string;
  totalCost: string;
  sellingPrice: string | null;
  marginValue: string | null;
  marginPercent: string | null;
  isCosted: boolean;
  costStatus: string;
}
export interface CostingSummary {
  sellableProducts: number;
  costedProducts: number;
  coveragePercent: string;
  byStatus: Record<string, number>;
}

export const costingApi = {
  listIngredients: (q: { search?: string; page?: number; pageSize?: number } = {}) =>
    paginated<Ingredient>("/api/v1/dashboard/costing/ingredients", q),
  createIngredient: (b: Record<string, unknown>) =>
    request<Ingredient>("/api/v1/dashboard/costing/ingredients", { method: "POST", body: b }),
  updateIngredient: (id: string, b: Record<string, unknown>) =>
    request<Ingredient>(`/api/v1/dashboard/costing/ingredients/${id}`, {
      method: "PATCH",
      body: b,
    }),
  deleteIngredient: (id: string) =>
    request<void>(`/api/v1/dashboard/costing/ingredients/${id}`, { method: "DELETE" }),
  history: (id: string) =>
    request<
      Array<{
        id: string;
        changedAt: string;
        oldPurchasePrice: string | null;
        newPurchasePrice: string;
        changePercent: string | null;
        changeReason: string;
      }>
    >(`/api/v1/dashboard/costing/ingredients/${id}/history`),
  bulkPrice: (body: {
    reason?: string;
    items: Array<{ ingredientId: string; purchasePrice: string }>;
  }) =>
    request<{ applied: number; productsRecosted: number }>(
      "/api/v1/dashboard/costing/ingredients/bulk-price",
      { method: "POST", body },
    ),
  listSuppliers: () =>
    request<Array<{ id: string; name: string }>>("/api/v1/dashboard/costing/suppliers"),
  createSupplier: (b: { name: string }) =>
    request<{ id: string; name: string }>("/api/v1/dashboard/costing/suppliers", {
      method: "POST",
      body: b,
    }),
  listRecipes: (q: { status?: string; productId?: string } = {}) =>
    request<Recipe[]>("/api/v1/dashboard/costing/recipes", { query: q }),
  getRecipe: (id: string) => request<Recipe>(`/api/v1/dashboard/costing/recipes/${id}`),
  createRecipe: (b: Record<string, unknown>) =>
    request<Recipe>("/api/v1/dashboard/costing/recipes", { method: "POST", body: b }),
  setRecipeStatus: (id: string, status: string) =>
    request<Recipe>(`/api/v1/dashboard/costing/recipes/${id}/status`, {
      method: "POST",
      body: { status },
    }),
  replaceLines: (id: string, lines: unknown[]) =>
    request<Recipe>(`/api/v1/dashboard/costing/recipes/${id}/lines`, {
      method: "PUT",
      body: { lines },
    }),
  listProductCosts: (q: { page?: number; pageSize?: number; costStatus?: string } = {}) =>
    paginated<ProductCostRow>("/api/v1/dashboard/costing/products", q),
  summary: () => request<CostingSummary>("/api/v1/dashboard/costing/summary"),
  recostAll: () =>
    request<{ updated: number; costed: number }>("/api/v1/dashboard/costing/recost", {
      method: "POST",
    }),
};

// ================= PRODUCTION =================
export interface ProductionLine {
  productId: string;
  productName: string;
  variantName: string | null;
  categoryName: string | null;
  componentType: string | null;
  confirmedQty: number;
  unconfirmedQty: number;
  producedQty: number;
  plannedQty: number;
  orderCount: number;
  companyCount: number;
  prepTimeMins: number | null;
  lineSubtotal: string;
  lineCost: string | null;
}
export interface ProductionDay {
  date: string;
  orderCount: number;
  companyCount: number;
  totalPortions: number;
  estimatedPrepMinutes: number;
  currency: string;
  currencyMismatch: boolean;
  subtotal: string;
  cost: string | null;
  costedPortions: number;
  uncostedPortions: number;
  costCoveragePercent: string;
  lines: ProductionLine[];
}
export interface ProductionCompanyGroup {
  companyId: string;
  companyName: string;
  orderCount: number;
  portions: number;
  total: string;
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string | null;
    fulfillmentType: string;
    items: Array<{ name: string; quantity: number }>;
  }>;
}
export interface ProductionPlanSummary {
  id: string;
  date: string;
  status: string;
  snapshotVersion: number;
  orderCount: number;
  companyCount: number;
  totalPortions: number;
  lockedAt: string;
}

export const productionApi = {
  day: (date: string) => request<ProductionDay>(`/api/v1/dashboard/production/day/${date}`),
  byCompany: (date: string) =>
    request<ProductionCompanyGroup[]>(`/api/v1/dashboard/production/day/${date}/by-company`),
  listPlans: (q: { from?: string; to?: string } = {}) =>
    request<ProductionPlanSummary[]>("/api/v1/dashboard/production/plans", { query: q }),
  getPlan: (id: string) =>
    request<ProductionDay & { id: string; status: string; snapshotVersion: number }>(
      `/api/v1/dashboard/production/plans/${id}`,
    ),
  lockDay: (date: string) =>
    request<{ id: string; snapshotVersion: number }>("/api/v1/dashboard/production/plans", {
      method: "POST",
      body: { date },
    }),
  setStatus: (id: string, status: string) =>
    request<{ id: string; status: string }>(`/api/v1/dashboard/production/plans/${id}/status`, {
      method: "POST",
      body: { status },
    }),
};

// Files extensions
export const filesExtApi = {
  downloadUrl: (fileId: string) => `${BASE_URL}/api/v1/files/${fileId}`,
  fetchBlob: async (fileId: string) => {
    const res = await fetch(new URL(`/api/v1/files/${fileId}`, BASE_URL), {
      headers: { Authorization: `Bearer ${tokenStore.access ?? ""}` },
    });
    if (!res.ok)
      throw new ApiClientError(res.status, "file_download_failed", "Failed to download file");
    return res.blob();
  },
  deleteAttachment: (attachmentId: string) =>
    request<void>(`/api/v1/files/attachments/${attachmentId}`, { method: "DELETE" }),
};

// ================= ANALYTICS =================
export const analyticsApi = {
  overview: (q: { days?: number; companyId?: string } = {}) =>
    request<AnalyticsOverview>("/api/v1/dashboard/analytics/overview", { query: q }),
};
