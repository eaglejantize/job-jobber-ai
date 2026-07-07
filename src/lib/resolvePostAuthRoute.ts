export type PostAuthReasonCode =
  | "admin_bypass"
  | "setup_incomplete"
  | "active_paid"
  | "billing_required";

export type ResolvePostAuthRouteInput = {
  isSuperAdmin?: boolean | null;
  isAdminTest?: boolean | null;
  hasClient?: boolean;
  hasBusiness?: boolean;
  paymentStatus?: string | null;
  subscriptionStatus?: string | null;
  setupStatus?: string | null;
  onboardingCompletedAt?: string | null;
};

export type ResolvePostAuthRouteResult = {
  role: "super_admin" | "admin_test" | "tenant";
  setupComplete: boolean;
  subscriptionActive: boolean;
  destination: "/home" | "/settings" | "/start";
  reasonCode: PostAuthReasonCode;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isSetupComplete(input: ResolvePostAuthRouteInput): boolean {
  const status = normalize(input.setupStatus);
  return Boolean(input.onboardingCompletedAt)
    || status === "live"
    || status === "ready"
    || status === "active";
}

function hasActiveSubscription(input: ResolvePostAuthRouteInput): boolean {
  const paymentStatus = normalize(input.paymentStatus);
  const subscriptionStatus = normalize(input.subscriptionStatus);

  return paymentStatus === "active"
    || paymentStatus === "trial"
    || paymentStatus === "manual"
    || subscriptionStatus === "active"
    || subscriptionStatus === "trialing";
}

function isBillingBlocked(input: ResolvePostAuthRouteInput): boolean {
  const paymentStatus = normalize(input.paymentStatus);
  const subscriptionStatus = normalize(input.subscriptionStatus);

  return paymentStatus === "pending"
    || paymentStatus === "unpaid"
    || paymentStatus === "expired"
    || paymentStatus === "past_due"
    || paymentStatus === "canceled"
    || paymentStatus === "cancelled"
    || paymentStatus === "incomplete"
    || paymentStatus === "incomplete_expired"
    || paymentStatus === "suspended"
    || subscriptionStatus === "unpaid"
    || subscriptionStatus === "expired"
    || subscriptionStatus === "past_due"
    || subscriptionStatus === "canceled"
    || subscriptionStatus === "cancelled"
    || subscriptionStatus === "incomplete"
    || subscriptionStatus === "incomplete_expired";
}

export function resolvePostAuthRoute(
  input: ResolvePostAuthRouteInput,
): ResolvePostAuthRouteResult {
  const role = input.isSuperAdmin
    ? "super_admin"
    : input.isAdminTest
    ? "admin_test"
    : "tenant";

  const setupComplete = isSetupComplete(input);
  const subscriptionActive = hasActiveSubscription(input);
  const billingBlocked = isBillingBlocked(input);
  const hasAccountSurface = Boolean(input.hasClient || input.hasBusiness);

  if (role !== "tenant") {
    return {
      role,
      setupComplete,
      subscriptionActive,
      destination: "/home",
      reasonCode: "admin_bypass",
    };
  }

  if (billingBlocked || !hasAccountSurface) {
    return {
      role,
      setupComplete,
      subscriptionActive,
      destination: "/start",
      reasonCode: "billing_required",
    };
  }

  if (!setupComplete) {
    return {
      role,
      setupComplete,
      subscriptionActive,
      destination: "/settings",
      reasonCode: "setup_incomplete",
    };
  }

  if (subscriptionActive) {
    return {
      role,
      setupComplete,
      subscriptionActive,
      destination: "/home",
      reasonCode: "active_paid",
    };
  }

  return {
    role,
    setupComplete,
    subscriptionActive,
    destination: "/start",
    reasonCode: "billing_required",
  };
}

export function resolvePostAuthNavigationTarget(
  result: ResolvePostAuthRouteResult,
  currentPathname: string,
): "/home" | "/settings" | "/start" {
  if (result.destination !== currentPathname) {
    return result.destination;
  }

  if (result.reasonCode === "setup_incomplete") {
    return "/settings";
  }

  if (result.reasonCode === "billing_required") {
    return "/start";
  }

  return result.destination;
}