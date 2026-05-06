"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Users,
  LayoutDashboard,
  BookOpen,
  Clock,
  Menu,
  X,
  Shield,
  LogIn,
  LogOut,
  Flame,
  ChevronDown,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store";
import type { User } from "@/lib/types";

const publicLinks = [
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/rules", label: "Rules", icon: BookOpen },
  { href: "/schedule", label: "Schedule", icon: Clock },
];

const authLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, sidebarOpen, toggleSidebar, setSidebarOpen } = useAppStore();

  const navLinks = [
    ...publicLinks,
    ...(user ? authLinks : []),
  ];

  return (
    <>
      <nav className="sticky top-0 z-40 bg-navy/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 bg-coral rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="font-display text-lg font-bold tracking-wide">
                  <span className="text-white">CASUAL</span>
                  <span className="text-coral">YMPICS</span>
                </span>
                <span className="text-[10px] text-gold align-super font-semibold">
                  TM
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                const Icon = link.icon;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "text-white"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                    {isActive && (
                      <motion.div
                        layoutId="navbar-indicator"
                        className="absolute inset-0 bg-white/10 rounded-lg -z-10"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Profile Dropdown + Mobile Menu */}
            <div className="flex items-center gap-3">
              {user ? (
                <ProfileDropdown user={user} />
              ) : (
                <Link
                  href="/login"
                  className="hidden md:flex items-center gap-2 bg-coral hover:bg-coral-light text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </Link>
              )}

              <button
                onClick={toggleSidebar}
                className="md:hidden p-2 text-white/80 hover:text-white"
              >
                {sidebarOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar */}
      <AnimatedSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        links={navLinks}
        pathname={pathname}
        user={user}
      />
    </>
  );
}

function ProfileDropdown({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const setUser = useAppStore((s) => s.setUser);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        close();
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, close]);

  const initials = getInitials(user.display_name || user.email);

  const handleSignOut = async () => {
    close();
    setUser(null);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div ref={dropdownRef} className="relative hidden md:block">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors",
          open ? "bg-white/10" : "hover:bg-white/5"
        )}
      >
        <div className="w-8 h-8 rounded-full bg-coral flex items-center justify-center text-xs font-bold text-white">
          {initials}
        </div>
        <span className="text-sm text-white/80 max-w-[120px] truncate">
          {user.display_name}
        </span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-white/50 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-64 bg-card rounded-xl border border-border shadow-xl overflow-hidden"
          >
            {/* User info header */}
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground truncate">
                {user.display_name}
              </p>
              <p className="text-xs text-muted truncate">{user.email}</p>
            </div>

            {/* Menu items */}
            <div className="py-1">
              <DropdownLink
                href="/dashboard"
                icon={LayoutDashboard}
                label="Dashboard"
                onClick={close}
              />

              {user.role === "admin" && (
                <DropdownLink
                  href="/admin"
                  icon={Shield}
                  label="Admin Dashboard"
                  onClick={close}
                />
              )}
            </div>

            {/* Sign out */}
            <div className="border-t border-border py-1">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-danger hover:bg-danger/5 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DropdownLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-navy/5 transition-colors"
    >
      <Icon className="w-4 h-4 text-muted" />
      {label}
    </Link>
  );
}

function AnimatedSidebar({
  isOpen,
  onClose,
  links,
  pathname,
  user,
}: {
  isOpen: boolean;
  onClose: () => void;
  links: { href: string; label: string; icon: React.ElementType }[];
  pathname: string;
  user: User | null;
}) {
  const router = useRouter();
  const setUser = useAppStore((s) => s.setUser);

  const handleSignOut = async () => {
    onClose();
    setUser(null);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: isOpen ? 0 : "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed top-0 right-0 bottom-0 w-72 bg-navy z-50 md:hidden shadow-2xl"
      >
        <div className="p-6 pt-20 flex flex-col h-full">
          <div className="flex flex-col gap-2 flex-1">
            {links.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-coral text-white"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </Link>
              );
            })}

            {user?.role === "admin" && (
              <Link
                href="/admin"
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  pathname.startsWith("/admin")
                    ? "bg-coral text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
              >
                <Shield className="w-5 h-5" />
                Admin Dashboard
              </Link>
            )}
          </div>

          {/* Bottom section */}
          <div className="border-t border-white/10 pt-4 pb-6">
            {user ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-4 py-2">
                  <div className="w-10 h-10 rounded-full bg-coral flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {getInitials(user.display_name || user.email)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {user.display_name}
                    </p>
                    <p className="text-xs text-white/50 truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-danger hover:bg-white/5 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 bg-coral text-white rounded-lg text-sm font-semibold"
              >
                <LogIn className="w-5 h-5" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
