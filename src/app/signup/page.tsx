"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Trophy,
  KeyRound,
  ArrowRight,
  Users,
  Zap,
  Medal,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";
import { logActivity } from "@/lib/audit";

const perks = [
  { icon: Users, text: "Create or join a team" },
  { icon: Zap, text: "Track scores in real time" },
  { icon: Medal, text: "Compete for neighborhood glory" },
];

function SignupForm() {
  const router = useRouter();
  const { setUser } = useAppStore();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    // Create the admin account server-side (validates the access code).
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, code }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not create your account.");
      setLoading(false);
      return;
    }

    // Account exists and is confirmed — sign in immediately.
    const supabase = createClient();
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (signInError || !signInData.user) {
      // Account was created; fall back to the login page.
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("id", signInData.user.id)
      .single();

    if (profile) setUser(profile);
    logActivity(supabase, "sign_up", { method: "access_code" });

    router.push("/setup-profile");
    router.refresh();
  };

  return (
    <div className="min-h-[80vh] bg-navy flex items-center justify-center px-4">
      <PageTransition className="w-full max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 bg-card rounded-2xl shadow-2xl overflow-hidden">
          {/* Left: Value proposition */}
          <div className="bg-gradient-to-br from-coral to-coral-dark p-8 lg:p-10 flex flex-col justify-center">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-6">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-white leading-tight mb-3">
              ORGANIZE THE
              <br />
              NEIGHBORHOOD
              <br />
              OLYMPICS
            </h2>
            <p className="text-white/80 text-sm lg:text-base mb-8 max-w-sm">
              Admin accounts run the show — set up events, record scores, and
              post announcements. You&apos;ll need an access code to sign up.
            </p>
            <ul className="space-y-3">
              {perks.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm text-white/90 font-medium">
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Form */}
          <div className="p-8 lg:p-10 flex flex-col justify-center">
            <div className="mb-6">
              <h1 className="font-display text-2xl font-bold text-foreground">
                CREATE ADMIN ACCOUNT
              </h1>
              <p className="text-sm text-muted mt-1">
                Enter your access code and choose a password
              </p>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <Input
                id="code"
                label="Access Code"
                type="password"
                placeholder="Admin access code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
              <Input
                id="email"
                label="Email Address"
                type="email"
                placeholder="neighbor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                id="password"
                label="Password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Input
                id="confirmPassword"
                label="Confirm Password"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

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
                <KeyRound className="w-4 h-4" />
                Create Account
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

            <p className="text-center text-sm text-muted mt-6">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-coral font-semibold hover:text-coral-light transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted">
          Loading...
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
