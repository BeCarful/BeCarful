"use client";

import { useOptimistic, useState, useTransition } from "react";
import { chooseAssistant } from "@/actions/auth";
import { ASSISTANTS } from "./assistants";
import { TuxemonAttribution, TuxemonAvatar } from "./TuxemonAssistant";

export function AssistantPicker({ selectedId }: { selectedId: string }) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(selectedId);
  const [error, setError] = useState<string | null>(null);

  function pick(id: string) {
    setError(null);
    startTransition(async () => {
      setCurrent(id);
      const res = await chooseAssistant(id).catch(() => null);
      if (!res?.ok) setError(res?.error ?? "Couldn't save your pick. Check your connection and try again.");
    });
  }

  return (
    <fieldset aria-busy={pending || undefined}>
      <legend className="sr-only">Chat buddy</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {ASSISTANTS.map((a) => {
          const selected = a.id === current;
          return (
            <label
              key={a.id}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-1 pt-2 pb-1.5 text-sm font-medium transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${selected ? "border-accent bg-accent-soft text-accent" : "border-border bg-panel text-ink hover:bg-panel-shade"}`}
            >
              <input type="radio" name="assistant" value={a.id} checked={selected} onChange={() => pick(a.id)} className="sr-only" />
              <TuxemonAvatar frame="front" scale={1} sheet={a.sheet} decorative />
              <span className="max-w-full truncate">{a.name}</span>
            </label>
          );
        })}
      </div>
      <p role="status" className="mt-2 min-h-5 text-sm text-ink-soft">
        {pending ? "Saving…" : ""}
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <TuxemonAttribution monsters={ASSISTANTS} className="mt-2" />
    </fieldset>
  );
}
