import { describe, expect, it } from "vitest";
import {
  resolvePostAuthNavigationTarget,
  resolvePostAuthRoute,
} from "@/lib/resolvePostAuthRoute";

describe("resolvePostAuthRoute", () => {
  it("bypasses billing for super admin", () => {
    const result = resolvePostAuthRoute({
      isSuperAdmin: true,
      hasClient: true,
      hasBusiness: true,
      paymentStatus: "pending",
      setupStatus: "Not Started",
    });

    expect(result.role).toBe("super_admin");
    expect(result.destination).toBe("/home");
    expect(result.reasonCode).toBe("admin_bypass");
  });

  it("routes setup-incomplete tenants to settings", () => {
    const result = resolvePostAuthRoute({
      hasClient: true,
      hasBusiness: true,
      paymentStatus: "active",
      subscriptionStatus: "active",
      setupStatus: "Setup In Progress",
    });

    expect(result.destination).toBe("/settings");
    expect(result.reasonCode).toBe("setup_incomplete");
  });

  it("routes active paid tenants to home", () => {
    const result = resolvePostAuthRoute({
      hasClient: true,
      hasBusiness: true,
      paymentStatus: "active",
      subscriptionStatus: "active",
      setupStatus: "Live",
    });

    expect(result.destination).toBe("/home");
    expect(result.reasonCode).toBe("active_paid");
  });

  it("routes unpaid tenants to start", () => {
    const result = resolvePostAuthRoute({
      hasClient: true,
      hasBusiness: false,
      paymentStatus: "expired",
      subscriptionStatus: "past_due",
      setupStatus: "Ready",
    });

    expect(result.destination).toBe("/start");
    expect(result.reasonCode).toBe("billing_required");
  });

  it("uses the fallback target when a billing route would no-op", () => {
    const result = resolvePostAuthRoute({
      hasClient: false,
      hasBusiness: false,
      paymentStatus: null,
      subscriptionStatus: null,
      setupStatus: null,
    });

    expect(resolvePostAuthNavigationTarget(result, "/start")).toBe("/start");
  });
});