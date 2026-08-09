"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, ArrowRight, CheckCircle, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Sign out so user re-authenticates with new password
    await supabase.auth.signOut();
    setSuccess(true);
  };

  return (
    <div className="min-h-[80vh] bg-navy flex items-center justify-center px-4">
      <PageTransition className="w-full max-w-md">
        <div className="bg-card rounded-2xl border border-border shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-navy rounded-xl mx-auto flex items-center justify-center mb-4">
              <KeyRound className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              RESET PASSWORD
            </h1>
            <p className="text-sm text-muted mt-2">
              Choose a new password for your account
            </p>
          </div>

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
              <h2 className="font-display text-xl font-bold text-foreground mb-2">
                PASSWORD UPDATED
              </h2>
              <p className="text-sm text-muted mb-6">
                Your password has been reset. Sign in with your new password.
              </p>
              <Button
                onClick={() => router.push("/login")}
                className="w-full"
                size="lg"
              >
                Go to Sign In
                <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="password"
                label="New Password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
              <Input
                id="confirmPassword"
                label="Confirm New Password"
                type="password"
                placeholder="Re-enter your new password"
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
                <Lock className="w-4 h-4" />
                Reset Password
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          )}
        </div>
      </PageTransition>
    </div>
  );
}
