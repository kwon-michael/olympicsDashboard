"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Flame, Mail, ArrowRight, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
      },
    });
  };

  return (
    <div className="min-h-[80vh] bg-navy flex items-center justify-center px-4">
      <PageTransition className="w-full max-w-md">
        <div className="bg-card rounded-2xl border border-border shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-coral rounded-xl mx-auto flex items-center justify-center mb-4">
              <Flame className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              JOIN THE GAMES
            </h1>
            <p className="text-sm text-muted mt-2">
              Sign in to create teams, track scores, and compete
            </p>
          </div>

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
                We sent a magic link to{" "}
                <span className="font-semibold text-foreground">{email}</span>.
                Click the link to sign in.
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
              {/* Magic Link Form */}
              <form onSubmit={handleMagicLink} className="space-y-4">
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
                  Send Magic Link
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
                onClick={handleGoogleLogin}
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
                Continue with Google
              </Button>

              {/* Spectator note */}
              <p className="text-center text-xs text-muted mt-6">
                Just watching? The{" "}
                <a href="/leaderboard" className="text-coral hover:text-coral-light">
                  leaderboard
                </a>{" "}
                and{" "}
                <a href="/rules" className="text-coral hover:text-coral-light">
                  rules
                </a>{" "}
                are available without an account.
              </p>
            </>
          )}
        </div>
      </PageTransition>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
