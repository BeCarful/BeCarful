"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/types";
import { RetroButton } from "./RetroButton";

export function RemoveButton({ action, title, warning }: { action: () => Promise<ActionResult>; title: string; warning: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <RetroButton type="button" variant="ghost" className="shrink-0 text-danger" onClick={() => setConfirming(true)} aria-label={`Remove ${title}`}>
        Remove
      </RetroButton>
    );
  }

  return (
    <div className="basis-full space-y-2 rounded-lg bg-danger-soft p-3" role="alert">
      <p className="text-sm">
        Remove <strong>{title}</strong>? {warning}
      </p>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      <div className="flex gap-2">
        <RetroButton type="button" variant="secondary" className="flex-1" disabled={pending} onClick={() => (setConfirming(false), setError(null))}>
          Cancel
        </RetroButton>
        <RetroButton
          type="button"
          variant="danger"
          className="flex-1"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await action();
              if (!res.ok) setError(res.error);
            })
          }
        >
          {pending ? "Removing…" : "Remove"}
        </RetroButton>
      </div>
    </div>
  );
}
