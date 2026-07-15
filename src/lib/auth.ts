import type { UserRole } from "@/lib/types";

// Roles permitted to sign in and use the authenticated app. Everyone else
// (e.g. participants) may create an account, but cannot sign in.
export const SIGN_IN_ROLES: UserRole[] = ["admin"];

export function canSignIn(role: UserRole | null | undefined): boolean {
  return !!role && SIGN_IN_ROLES.includes(role);
}

// The activity/audit logs are restricted to a single owner account, not every
// admin. Compared case-insensitively.
export const AUDIT_LOG_EMAIL = "kwon.mike90@gmail.com";

export function canViewAuditLog(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === AUDIT_LOG_EMAIL;
}
