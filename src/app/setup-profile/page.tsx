"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Flame, User, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";

export default function SetupProfilePage() {
  const router = useRouter();
  const { setUser } = useAppStore();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst || !trimmedLast) {
      setError("Both fields are required.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      setError("Session expired. Please sign in again.");
      setLoading(false);
      return;
    }

    const displayName = `${trimmedFirst} ${trimmedLast}`;

    const { error: updateError } = await supabase
      .from("users")
      .update({
        first_name: trimmedFirst,
        last_name: trimmedLast,
        display_name: displayName,
        profile_completed: true,
      })
      .eq("id", authUser.id);

    if (updateError) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (profile) setUser(profile);

    router.push("/dashboard");
  };

  return (
    <div className="min-h-[80vh] bg-navy flex items-center justify-center px-4">
      <PageTransition className="w-full max-w-md">
        <div className="bg-card rounded-2xl border border-border shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-coral rounded-xl mx-auto flex items-center justify-center mb-4">
              <User className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              COMPLETE YOUR PROFILE
            </h1>
            <p className="text-sm text-muted mt-2">
              Tell us your name so your teammates can find you
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="firstName"
              label="First Name"
              type="text"
              placeholder="Michael"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
              required
            />
            <Input
              id="lastName"
              label="Last Name"
              type="text"
              placeholder="Jordan"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
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
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </PageTransition>
    </div>
  );
}
