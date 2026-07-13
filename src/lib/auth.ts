import type { UserRole } from "@/lib/types";

// Roles permitted to sign in and use the authenticated app. Everyone else
// (e.g. participants) may create an account, but cannot sign in.
export const SIGN_IN_ROLES: UserRole[] = ["admin"];

export function canSignIn(role: UserRole | null | undefined): boolean {
  return !!role && SIGN_IN_ROLES.includes(role);
}
