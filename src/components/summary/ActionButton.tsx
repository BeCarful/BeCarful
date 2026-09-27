"use client";

import { useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { RetroButton } from "@/components/retro";
import type { ActionResult } from "@/types";

export function ActionButton({
  action,
  children,
  variant = "primary",
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = () =>
    start(async () => {
      try {
        const res = await action();
        setError(res.ok ? null : res.error);
      } catch (err) {
        unstable_rethrow(err);
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    });

  return (
    <div>
      <RetroButton type="button" variant={variant} disabled={pending} onClick={run} className="w-full">
        {pending ? "Saving…" : children}
      </RetroButton>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
