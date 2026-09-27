"use client";

import { useEffect, useRef, useState } from "react";
import { createPolicyUpload, registerPolicy, registerPolicyText, retryPolicyExtraction } from "@/actions/insurance";
import { PixelProgress, RetroButton, retroInputClass } from "@/components/retro";
import { uploadToStorage } from "@/lib/upload-client";
import type { ActionResult } from "@/types";

const STEPS = ["Uploading policy…", "Reading pages…", "Finding your coverage…", "Checking the law…", "Spotting wild Tuxemon…"];
const STEP_MS = 4000;
const MIN_TEXT = 200;
const MAX_TEXT = 60_000;

const linkClass = "min-h-11 w-full rounded-lg text-sm font-semibold text-accent underline-offset-4 hover:underline";

type Props = {
  vehicleId: string;
  providerId: string;
  policyId?: string;
  canRetry?: boolean;
  uploadLabel: string;
  onSaved?: (policyId: string) => void;
};

export function PolicyUpload({ vehicleId, providerId, policyId, canRetry = false, uploadLabel, onSaved }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const busy = step !== null && step < STEPS.length && !error;
  const textLength = text.trim().length;

  // Timer-driven steps: upload completion moves past step 0, the last step waits for the action.
  useEffect(() => {
    if (error || step === null || step === 0 || step === STEPS.length - 1) return;
    const done = step === STEPS.length;
    const t = setTimeout(() => setStep(done ? null : step + 1), done ? 1500 : STEP_MS);
    return () => clearTimeout(t);
  }, [step, error]);

  async function run(start: number, work: () => Promise<ActionResult<{ policyId: string } | undefined>>) {
    setError(null);
    setStep(start);
    try {
      const res = await work();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStep(STEPS.length);
      setPasting(false);
      setText("");
      if (res.data) onSaved?.(res.data.policyId);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    }
  }

  function uploadFile(file: File) {
    run(0, async () => {
      const contentType = file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "");
      const presigned = await createPolicyUpload(vehicleId, { contentType, size: file.size });
      if (!presigned.ok) return presigned;
      await uploadToStorage(presigned.data, file);
      setStep(1);
      return registerPolicy(vehicleId, { key: presigned.data.key, providerId, fileName: file.name, replaces: policyId });
    });
  }

  return (
    <div className="space-y-3">
      {step !== null && <PixelProgress steps={STEPS} current={step} failed={Boolean(error)} />}
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) uploadFile(file);
        }}
      />
      {!busy &&
        (pasting ? (
          <div className="space-y-3">
            <label className="block">
              <span className="field-label">Policy text</span>
              <textarea
                value={text}
                maxLength={MAX_TEXT}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the text of your policy or declarations page"
                className={`${retroInputClass} min-h-40 resize-y`}
              />
              <span className="field-hint">
                {textLength < MIN_TEXT ? `Paste at least ${MIN_TEXT} characters (${textLength} so far).` : `${textLength.toLocaleString()} characters`}
              </span>
            </label>
            <RetroButton
              className="w-full"
              disabled={textLength < MIN_TEXT}
              onClick={() => run(1, () => registerPolicyText(vehicleId, { providerId, text, replaces: policyId }))}
            >
              Read my policy
            </RetroButton>
            <button type="button" className={linkClass} onClick={() => setPasting(false)}>
              Upload a PDF instead
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {canRetry && policyId && (
              <RetroButton onClick={() => run(1, () => retryPolicyExtraction(vehicleId, policyId))}>Retry reading</RetroButton>
            )}
            {policyId ? (
              <RetroButton variant="secondary" onClick={() => fileInput.current?.click()}>
                {uploadLabel}
              </RetroButton>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) uploadFile(file);
                }}
                className={`flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition ${dragging ? "border-accent bg-accent-soft" : "border-input bg-panel-shade/60 hover:border-accent hover:bg-accent-soft"}`}
              >
                <span aria-hidden className="grid size-11 place-items-center rounded-lg bg-accent font-display text-sm font-semibold text-accent-ink">
                  PDF
                </span>
                <span className="font-semibold text-ink">{uploadLabel}</span>
                <span className="text-sm text-ink-soft">Tap to choose a file, or drop it here</span>
              </button>
            )}
            <button type="button" className={linkClass} onClick={() => setPasting(true)}>
              Paste policy text instead
            </button>
          </div>
        ))}
    </div>
  );
}
