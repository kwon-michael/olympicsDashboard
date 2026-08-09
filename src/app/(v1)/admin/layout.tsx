"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { canAccessAdminPath } from "@/lib/auth";

// Wraps every /admin page. Its main job is the admin "view as volunteer"
// preview: when an admin turns it on, this shows a banner and keeps them inside
// the volunteer-accessible tools so the preview is faithful. Real volunteers are
// already constrained by middleware; this only affects admins previewing.
export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const viewAsVolunteer = useAppStore((s) => s.viewAsVolunteer);
  const setViewAsVolunteer = useAppStore((s) => s.setViewAsVolunteer);

  // Only admins may preview; if a non-admin somehow has the flag set, clear it.
  useEffect(() => {
    if (viewAsVolunteer && user && user.role !== "admin") {
      setViewAsVolunteer(false);
    }
  }, [viewAsVolunteer, user, setViewAsVolunteer]);

  // While previewing, bounce the admin out of any tool a volunteer can't open.
  const previewing = viewAsVolunteer && user?.role === "admin";
  useEffect(() => {
    if (previewing && !canAccessAdminPath("volunteer", pathname)) {
      router.replace("/admin");
    }
  }, [previewing, pathname, router]);

  return (
    <>
      {previewing && (
        <div className="sticky top-16 z-30 bg-amber-500/95 text-amber-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Eye className="w-4 h-4" />
              Viewing as a volunteer — you&apos;re seeing the reduced volunteer tools.
            </span>
            <button
              onClick={() => setViewAsVolunteer(false)}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-950/10 hover:bg-amber-950/20 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Exit preview
            </button>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
