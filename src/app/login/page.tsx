"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Flame, ArrowRight, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { canSignIn } from "@/lib/auth";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";
import { logActivity } from "@/lib/audit";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    searchParams.get("error") === "not_admin"
      ? "This account isn't authorized. Only admins can sign in."
      : ""
  );
  const router = useRouter();
  const { setUser } = useAppStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (!canSignIn(profile?.role)) {
        await supabase.auth.signOut();
        setUser(null);
        setError("This account isn't authorized. Only admins can sign in.");
        setLoading(false);
        return;
      }

      if (profile) setUser(profile);
      logActivity(supabase, "sign_in", { method: "password" });
    }

    router.push(redirect);
    router.refresh();
  };

  return (
    <div className="min-h-[80vh] bg-navy flex items-center justify-center px-4">
      <PageTransition className="w-full max-w-md">
        <div className="bg-card rounded-2xl border border-border shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-coral rounded-xl mx-auto flex items-center justify-center mb-4">
              <Flame className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              WELCOME BACK
            </h1>
            <p className="text-sm text-muted mt-2">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              id="email"
              label="Email Address"
              type="email"
              placeholder="neighbor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div>
              <Input
                id="password"
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="flex justify-end mt-1.5">
                <Link
                  href="/forgot-password"
                  className="text-xs text-coral hover:text-coral-light transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-danger text-center"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              loading={loading}
              className="w-full"
              size="lg"
            >
              <LogIn className="w-4 h-4" />
              Sign In
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {/* Sign up link */}
          <p className="text-center text-sm text-muted mt-6">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-coral font-semibold hover:text-coral-light transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </PageTransition>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted">
          Loading...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
