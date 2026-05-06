"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Trophy,
  Mail,
  ArrowRight,
  CheckCircle,
  Users,
  Zap,
  Medal,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";

const perks = [
  { icon: Users, text: "Create or join a team" },
  { icon: Zap, text: "Track scores in real time" },
  { icon: Medal, text: "Compete for neighborhood glory" },
];

function SignupForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    // Send OTP to verify email. After clicking the link, user is redirected
    // to /set-password where they'll create their password.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=/set-password`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  const handleGoogleSignup = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=/dashboard`,
      },
    });
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
              JOIN THE
              <br />
              NEIGHBORHOOD
              <br />
              OLYMPICS
            </h2>
            <p className="text-white/80 text-sm lg:text-base mb-8 max-w-sm">
              Sign up to form teams, compete in events, and claim your spot on
              the leaderboard.
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
            {sent ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
                <h2 className="font-display text-xl font-bold text-foreground mb-2">
                  CHECK YOUR EMAIL
                </h2>
                <p className="text-sm text-muted">
                  We sent a verification link to{" "}
                  <span className="font-semibold text-foreground">{email}</span>.
                  Click the link to continue setting up your account.
                </p>
                <button
                  onClick={() => setSent(false)}
                  className="mt-6 text-sm text-coral hover:text-coral-light transition-colors"
                >
                  Use a different email
                </button>
              </motion.div>
            ) : (
              <>
                <div className="mb-6">
                  <h1 className="font-display text-2xl font-bold text-foreground">
                    CREATE YOUR ACCOUNT
                  </h1>
                  <p className="text-sm text-muted mt-1">
                    Enter your email to get started
                  </p>
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                  <Input
                    id="email"
                    label="Email Address"
                    type="email"
                    placeholder="neighbor@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    error={error}
                  />
                  <Button
                    type="submit"
                    loading={loading}
                    className="w-full"
                    size="lg"
                  >
                    <Mail className="w-4 h-4" />
                    Verify Email
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 border-t border-border" />
                  <span className="text-xs text-muted uppercase tracking-wider">
                    or
                  </span>
                  <div className="flex-1 border-t border-border" />
                </div>

                {/* OAuth */}
                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={handleGoogleSignup}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign up with Google
                </Button>

                <p className="text-center text-sm text-muted mt-6">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="text-coral font-semibold hover:text-coral-light transition-colors"
                  >
                    Sign in
                  </Link>
                </p>
              </>
            )}
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
