"use client";

import { useActionState, useState } from "react";
import { createVehicle, type VehicleFormState } from "@/actions/vehicles";
import { RetroButton, RetroField } from "@/components/retro";
import { CAR_MODELS } from "@/services/vehicles/car-models";

const FIELDS = [
  { name: "color", label: "Color", placeholder: "Silver", required: true },
  { name: "licensePlate", label: "License plate", placeholder: "ABC1234", required: true },
  { name: "state", label: "State", placeholder: "TX", maxLength: 2, required: true },
  { name: "vin", label: "VIN (optional)", placeholder: "17 characters", maxLength: 17 },
] as const;

const CARS = CAR_MODELS.map((m) => ({ id: m.id, name: `${m.year} ${m.make} ${m.model}` }));

export function VehicleForm() {
  const [state, action, pending] = useActionState<VehicleFormState, FormData>(createVehicle, undefined);
  const [modelId, setModelId] = useState(state?.values?.modelId ?? "");
  return (
    <section className="surface-card max-w-2xl overflow-hidden">
      <div aria-hidden className="pixel-scene flex h-28 items-end border-b border-border pl-[8%]">
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel art scaled with nearest-neighbour */}
        <img src="/scenery/car.svg" alt="" width={192} height={88} className="pixelated mb-3 drop-shadow-[2px_3px_0_rgb(30_43_57/0.24)]" />
      </div>
      <form action={action} className="grid grid-cols-2 gap-4 p-5 sm:p-6">
        <label className="col-span-2 block">
          <span className="field-label">Your car</span>
          <input
            list="car-models"
            required
            autoComplete="off"
            placeholder="Start typing, e.g. Peugeot"
            className="field-select"
            defaultValue={CARS.find((c) => c.id === state?.values?.modelId)?.name}
            aria-invalid={Boolean(state?.fieldErrors?.modelId) || undefined}
            onChange={(e) => {
              const car = CARS.find((c) => c.name.toLowerCase() === e.target.value.trim().toLowerCase());
              setModelId(car?.id ?? "");
              e.target.setCustomValidity(car || !e.target.value ? "" : "Pick a car from the list");
            }}
          />
          <datalist id="car-models">
            {CARS.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          <input type="hidden" name="modelId" value={modelId} />
          {state?.fieldErrors?.modelId ? (
            <span className="mt-1 block text-sm text-danger">{state.fieldErrors.modelId}</span>
          ) : (
            <span className="field-hint">Demo: pick a car from the list. It&apos;s the 3D model you&apos;ll mark damage on.</span>
          )}
        </label>
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
