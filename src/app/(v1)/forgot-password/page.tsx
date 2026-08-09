"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?redirect=/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] bg-navy flex items-center justify-center px-4">
      <PageTransition className="w-full max-w-md">
        <div className="bg-card rounded-2xl border border-border shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-navy rounded-xl mx-auto flex items-center justify-center mb-4">
              <Mail className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              FORGOT PASSWORD
            </h1>
            <p className="text-sm text-muted mt-2">
              Enter your email and we&apos;ll send you a link to reset your
              password
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
                We sent a password reset link to{" "}
                <span className="font-semibold text-foreground">{email}</span>.
                Click the link to set a new password.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-6 text-sm text-coral hover:text-coral-light transition-colors"
              >
                Try a different email
              </button>
            </motion.div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  Send Reset Link
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </PageTransition>
    </div>
  );
}
