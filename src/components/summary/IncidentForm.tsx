"use client";

import { useState, useTransition, type FormEvent } from "react";
import { unstable_rethrow } from "next/navigation";
import { updateIncidentInfo } from "@/actions/incidents";
import { RetroButton, RetroField, retroInputClass } from "@/components/retro";
import { INCIDENT_TYPES, type ActionResult, type IncidentType } from "@/types";
import { useIsClient } from "./LocalTime";

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

type Props = {
  vehicleId: string;
  now: string;
  initial: { type: IncidentType | null; occurredAt: string | null; location: string; notes: string };
};

export function IncidentForm({ vehicleId, now, initial }: Props) {
  const isClient = useIsClient();
  const [type, setType] = useState(initial.type);
  const [when, setWhen] = useState<string | null>(null);
  const [location, setLocation] = useState(initial.location);
  const [notes, setNotes] = useState(initial.notes);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const whenValue = when ?? (isClient ? toLocalInput(new Date(initial.occurredAt ?? now)) : "");

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const occurredAt = new Date(whenValue);
    if (!type) return setResult({ ok: false, error: "Pick what happened." });
    if (Number.isNaN(occurredAt.getTime())) return setResult({ ok: false, error: "Pick when it happened." });
    start(async () => {
      try {
        setResult(await updateIncidentInfo(vehicleId, { type, occurredAt: occurredAt.toISOString(), location, notes }));
      } catch (err) {
        unstable_rethrow(err);
        setResult({ ok: false, error: "Couldn't reach the server. Check your connection and try again." });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset>
        <legend className="field-label">What happened</legend>
        <div className="flex flex-wrap gap-2">
          {INCIDENT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={`min-h-11 rounded-full border px-4 text-sm font-medium capitalize transition ${type === t ? "border-accent bg-accent-soft text-accent" : "border-border bg-panel text-ink hover:bg-panel-shade"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <RetroField
          label="When"
          type="datetime-local"
          required
          value={whenValue}
          onChange={(e) => setWhen(e.target.value)}
        />

        <RetroField
          label="Where"
          required
          minLength={2}
          maxLength={200}
          autoComplete="street-address"
          placeholder="5th St & Main, Austin TX"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <label className="block">
        <span className="field-label">Notes (optional)</span>
        <textarea
          rows={3}
          maxLength={2000}
          placeholder="Anything the insurer should know"
          className={retroInputClass}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <RetroButton type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save details"}
      </RetroButton>
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>
          {result.ok ? "Saved. Your to-do list is up to date." : result.error}
        </p>
      )}
    </form>
  );
}
