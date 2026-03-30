"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Trophy,
  Users,
  LayoutDashboard,
  BookOpen,
  Megaphone,
  Menu,
  X,
  Shield,
  LogIn,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import type { User } from "@/lib/types";

const publicLinks = [
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/rules", label: "Rules", icon: BookOpen },
];

const authLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const adminLinks = [
  { href: "/admin", label: "Admin", icon: Shield },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, sidebarOpen, toggleSidebar, setSidebarOpen } = useAppStore();

  const allLinks = [
    ...publicLinks,
    ...(user ? authLinks : []),
    ...(user?.role === "admin" ? adminLinks : []),
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
                <span className="font-display text-lg text-white font-bold tracking-wide">
                  NEIGHBORHOOD
                </span>
                <span className="font-display text-lg text-gold font-bold tracking-wide ml-1">
                  OLYMPICS
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {allLinks.map((link) => {
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

            {/* Auth Button + Mobile Menu */}
            <div className="flex items-center gap-3">
              {user ? (
                <Link
                  href="/dashboard"
                  className="hidden md:flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-full bg-coral flex items-center justify-center text-xs font-bold text-white"
                  >
                    {user.display_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <span>{user.display_name}</span>
                </Link>
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
        links={allLinks}
        pathname={pathname}
        user={user}
      />
    </>
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
        <div className="p-6 pt-20 flex flex-col gap-2">
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

          <div className="border-t border-white/10 mt-4 pt-4">
            {user ? (
              <div className="flex items-center gap-3 px-4 py-2 text-white/80">
                <div className="w-10 h-10 rounded-full bg-coral flex items-center justify-center text-sm font-bold text-white">
                  {user.display_name?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {user.display_name}
                  </p>
                  <p className="text-xs text-white/50">{user.email}</p>
                </div>
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
