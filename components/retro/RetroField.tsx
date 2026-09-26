import type { ComponentProps } from "react";

export const retroInputClass = "field-input";

export function RetroField({ label, error, hint, className = "", ...input }: ComponentProps<"input"> & { label: string; error?: string; hint?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}</span>
      <input className={retroInputClass} aria-invalid={Boolean(error) || undefined} {...input} />
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="mt-1 block text-sm text-danger">{error}</span>}
    </label>
  );
}
