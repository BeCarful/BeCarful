"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthState } from "@/actions/auth";
import { RetroButton, RetroField } from "@/components/retro";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? login : signup, undefined);
  const isSignup = mode === "signup";
  return (
    <section className="surface-card p-6 sm:p-8">
      <h1 className="page-title">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <p className="page-description mb-6">
        {isSignup ? "Keep your cars, policies and claims in one place." : "Log in to pick up where you left off."}
      </p>
      <form action={action} className="space-y-4">
        {isSignup && <RetroField label="Name" name="name" autoComplete="name" required defaultValue={state?.fields?.name} />}
        <RetroField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state?.fields?.email}
        />
        <RetroField
          label="Password"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={isSignup ? 8 : undefined}
          required
        />
        {state?.error && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}
        <RetroButton type="submit" disabled={pending} className="w-full">
          {pending ? "Loading…" : isSignup ? "Create account" : "Log in"}
        </RetroButton>
      </form>
      <p className="mt-5 text-center text-sm text-ink-soft">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-semibold text-accent underline-offset-2 hover:underline">
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </section>
  );
}
