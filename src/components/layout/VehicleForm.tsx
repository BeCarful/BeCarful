"use client";

import { useActionState } from "react";
import { createVehicle, type VehicleFormState } from "@/actions/vehicles";
import { RetroButton, RetroField } from "@/components/retro";
import { CAR_MODELS } from "@/services/vehicles/car-models";

const FIELDS = [
  { name: "color", label: "Color", placeholder: "Silver", required: true },
  { name: "licensePlate", label: "License plate", placeholder: "ABC1234", required: true },
  { name: "state", label: "State", placeholder: "TX", maxLength: 2, required: true },
  { name: "vin", label: "VIN (optional)", placeholder: "17 characters", maxLength: 17 },
] as const;

export function VehicleForm() {
  const [state, action, pending] = useActionState<VehicleFormState, FormData>(createVehicle, undefined);
  return (
    <section className="surface-card max-w-2xl overflow-hidden">
      <div aria-hidden className="pixel-scene flex h-28 items-end border-b border-border pl-[8%]">
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel art scaled with nearest-neighbour */}
        <img src="/scenery/car.svg" alt="" width={192} height={88} className="pixelated mb-3 drop-shadow-[2px_3px_0_rgb(30_43_57/0.24)]" />
      </div>
      <form action={action} className="grid grid-cols-2 gap-4 p-5 sm:p-6">
        <fieldset className="col-span-2">
          <legend className="field-label">Your car</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {CAR_MODELS.map((m) => (
              <label
                key={m.id}
                className="flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border border-border bg-panel px-4 py-3 transition hover:border-muted has-checked:border-accent has-checked:ring-2 has-checked:ring-accent"
              >
                <input
                  type="radio"
                  name="modelId"
                  value={m.id}
                  required
                  defaultChecked={(state?.values?.modelId ?? CAR_MODELS[0].id) === m.id}
                  className="size-5 shrink-0 accent-accent"
                />
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {m.make} {m.model}
                  </span>
                  <span className="block text-sm text-ink-soft">{m.year}</span>
                </span>
              </label>
            ))}
          </div>
          {state?.fieldErrors?.modelId ? (
            <span className="mt-1 block text-sm text-danger">{state.fieldErrors.modelId}</span>
          ) : (
            <span className="field-hint">Demo: pick one of these cars. It&apos;s the 3D model you&apos;ll mark damage on.</span>
          )}
        </fieldset>
        {FIELDS.map((f) => (
          <RetroField
            key={f.name}
            className={f.name === "vin" || f.name === "color" ? "col-span-2" : ""}
            label={f.label}
            name={f.name}
            placeholder={f.placeholder}
            maxLength={"maxLength" in f ? f.maxLength : undefined}
            required={"required" in f}
            autoCapitalize={f.name === "state" || f.name === "licensePlate" || f.name === "vin" ? "characters" : undefined}
            defaultValue={state?.values?.[f.name]}
            error={state?.fieldErrors?.[f.name]}
          />
        ))}
        {state?.error && (
          <p role="alert" className="col-span-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}
        <RetroButton type="submit" disabled={pending} className="col-span-2 mt-1">
          {pending ? "Saving…" : "Add to garage"}
        </RetroButton>
      </form>
    </section>
  );
}
