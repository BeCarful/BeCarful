"use client";

import { useActionState, useId, useRef, useState } from "react";
import { createVehicle, type VehicleFormState } from "@/actions/vehicles";
import { RetroButton, RetroField } from "@/components/retro";
import { CAR_MODELS } from "@/services/vehicles/car-models";

const FIELDS = [
  { name: "color", label: "Color", placeholder: "Silver", required: true },
  { name: "licensePlate", label: "License plate", placeholder: "ABC1234", required: true },
  { name: "state", label: "State", placeholder: "TX", maxLength: 2, required: true },
  { name: "vin", label: "VIN (optional)", placeholder: "17 characters", maxLength: 17 },
] as const;

const SPANS: Record<(typeof FIELDS)[number]["name"], string> = { color: "col-span-3", licensePlate: "col-span-4", state: "col-span-4", vin: "col-span-8" };

const CARS = [...CAR_MODELS]
  .sort((a, b) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`))
  .map((m) => ({ id: m.id, name: `${m.year} ${m.make} ${m.model}`, label: `${m.make} ${m.model}`, year: m.year }));

export function VehicleForm() {
  const [state, action, pending] = useActionState<VehicleFormState, FormData>(createVehicle, undefined);
  return (
    <section className="surface-card max-w-2xl">
      <div aria-hidden className="pixel-scene flex h-28 items-end overflow-hidden rounded-t-xl border-b border-border pl-[8%]">
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel art scaled with nearest-neighbour */}
        <img src="/scenery/car.svg" alt="" width={192} height={88} className="pixelated mb-3 drop-shadow-[2px_3px_0_rgb(30_43_57/0.24)]" />
      </div>
      <form action={action} className="grid grid-cols-8 gap-4 p-5 sm:p-6">
        <div className="col-span-5">
          <CarPicker initialId={state?.values?.modelId} error={state?.fieldErrors?.modelId} />
        </div>
        {FIELDS.map((f) => (
          <RetroField
            key={f.name}
            className={SPANS[f.name]}
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
          <p role="alert" className="col-span-8 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}
        <RetroButton type="submit" disabled={pending} className="col-span-8 mt-1">
          {pending ? "Saving…" : "Add to garage"}
        </RetroButton>
      </form>
    </section>
  );
}

function CarPicker({ initialId, error }: { initialId?: string; error?: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState(CARS.find((c) => c.id === initialId)?.name ?? "");
  const [modelId, setModelId] = useState(initialId ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const terms = modelId ? [] : query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = CARS.filter((c) => terms.every((t) => c.name.toLowerCase().includes(t)));

  function highlight(i: number) {
    setActive(i);
    list.current?.children[i]?.scrollIntoView({ block: "nearest" });
  }

  function pick(car: (typeof CARS)[number]) {
    setQuery(car.name);
    setModelId(car.id);
    setOpen(false);
    input.current?.setCustomValidity("");
  }

  function show() {
    setOpen(true);
    const i = modelId ? Math.max(0, CARS.findIndex((c) => c.id === modelId)) : 0;
    setActive(i);
    requestAnimationFrame(() => list.current?.children[i]?.scrollIntoView({ block: "nearest" }));
  }

  return (
    <>
      <label htmlFor={id} className="field-label">
        Your car
      </label>
      <div className="relative">
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${id}-${matches[active].id}` : undefined}
          aria-invalid={Boolean(error) || undefined}
          required
          autoComplete="off"
          placeholder="e.g. Peugeot"
          className="field-input pr-9"
          value={query}
          onFocus={show}
          onClick={() => !open && show()}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            const car = CARS.find((c) => c.name.toLowerCase() === e.target.value.trim().toLowerCase());
            setQuery(e.target.value);
            setModelId(car?.id ?? "");
            setOpen(true);
            highlight(0);
            e.target.setCustomValidity(car || !e.target.value ? "" : "Pick a car from the list");
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (!open) return show();
              const step = e.key === "ArrowDown" ? 1 : -1;
              highlight((active + step + matches.length) % Math.max(matches.length, 1));
            } else if (e.key === "Enter" && open && matches[active]) {
              e.preventDefault();
              pick(matches[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={`pointer-events-none absolute top-1/2 right-2.5 size-5 -translate-y-1/2 fill-none stroke-muted stroke-[1.75] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
        {open && (
          <ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            aria-label="Car models"
            onMouseDown={(e) => e.preventDefault()}
            className="fade-in absolute inset-x-0 top-full z-20 mt-1.5 max-h-64 overflow-y-auto overscroll-contain rounded-lg border border-border bg-panel p-1 shadow-[0_8px_24px_var(--shadow)]"
          >
            {matches.map((c, i) => (
              <li
                key={c.id}
                id={`${id}-${c.id}`}
                role="option"
                aria-selected={c.id === modelId}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(c)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-base transition-colors ${i === active ? "bg-accent-soft text-ink" : "text-ink-soft"}`}
              >
                <span className={c.id === modelId ? "font-medium text-ink" : ""}>{c.label}</span>
                <span className="flex items-center gap-2 text-sm text-muted tabular-nums">
                  {c.year}
                  {c.id === modelId && <span className="text-accent">✓</span>}
                </span>
              </li>
            ))}
            {matches.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">No match. Try a make like Toyota or BMW.</li>}
          </ul>
        )}
      </div>
      <input type="hidden" name="modelId" value={modelId} />
      {error ? (
        <span className="mt-1 block text-sm text-danger">{error}</span>
      ) : (
        <span className="field-hint">Demo: pick a car from the list. Cars without their own 3D model borrow a similar one to mark damage on.</span>
      )}
    </>
  );
}
