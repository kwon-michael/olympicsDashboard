import type { UserRole } from "@/lib/types";

// Roles permitted to sign in and use the authenticated app. Everyone else
// (e.g. participants) may create an account, but cannot sign in. Volunteers
// sign in but only reach a limited slice of the admin tools (see below).
export const SIGN_IN_ROLES: UserRole[] = ["admin", "volunteer"];

export function canSignIn(role: UserRole | null | undefined): boolean {
  return !!role && SIGN_IN_ROLES.includes(role);
}

// Admin tools a volunteer is allowed to open. Volunteers help run these three
// live events; everything else under /admin (scores, roster, schedule, players,
// logs) stays admin-only.
export const VOLUNTEER_ADMIN_PATHS = [
  "/admin/solo",
  "/admin/team-events",
  "/admin/tug-of-war",
  "/admin/dodgeball",
];

// Whether a role may open a given /admin path. Admins get everything; the
// volunteer landing page (/admin itself) plus the three event tools are the
// only paths open to volunteers.
export function canAccessAdminPath(
  role: UserRole | null | undefined,
  pathname: string
): boolean {
  if (role === "admin") return true;
  if (role === "volunteer") {
    if (pathname === "/admin" || pathname === "/admin/") return true;
    return VOLUNTEER_ADMIN_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );
  }
  return false;
}

// The activity/audit logs are restricted to a single owner account, not every
// admin. Compared case-insensitively.
export const AUDIT_LOG_EMAIL = "kwon.mike90@gmail.com";

export function canViewAuditLog(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === AUDIT_LOG_EMAIL;
}
