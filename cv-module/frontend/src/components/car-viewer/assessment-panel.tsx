"use client";

import Image from "next/image";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  AssessmentApi,
  AssessmentPollTimeoutError,
  claimExportFileName,
  MAX_PHOTOS,
  MIN_PHOTOS,
  pollClaimUntilTerminal,
  serializeClaimExport,
  type ClaimExportV1,
  type ClaimResponse,
  validatePhoto,
} from "@/lib/assessment/assessment-api";

import styles from "./assessment-panel.module.css";

type SelectedPhoto = {
  id: number;
  file: File;
  previewUrl: string;
};

type ResultTab = "assessment" | "raw";

type AssessmentPanelProps = {
  api?: AssessmentApi;
  onAssessmentStarted: () => void;
  onAssessmentReady: (bundle: ClaimExportV1) => void;
};

const STATUS_LABELS: Readonly<Record<string, string>> = {
  idle: "Choose 1–12 photos. Front, rear, left, and right views give better coverage.",
  uploading: "Uploading photos…",
  queued: "Queued for analysis…",
  preprocessing: "Checking and normalizing photos…",
  assessing: "Gemini is assessing visible damage…",
  completed: "Assessment completed.",
  needs_human_review: "Assessment completed and requires human review.",
  needs_more_photos: "More vehicle views are required.",
  failed: "Assessment failed.",
  timed_out: "Assessment is still running.",
};

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : "Unexpected assessment error";
}

export function AssessmentPanel({
  api: providedApi,
  onAssessmentStarted,
  onAssessmentReady,
}: AssessmentPanelProps) {
  const defaultApi = useMemo(() => new AssessmentApi(), []);
  const api = providedApi ?? defaultApi;
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const selectedRef = useRef<SelectedPhoto[]>([]);
  const nextPhotoId = useRef(1);
  const [selected, setSelected] = useState<SelectedPhoto[]>([]);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [bundle, setBundle] = useState<ClaimExportV1 | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>("assessment");

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      for (const photo of selectedRef.current) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
  }, []);

  const totalPhotoCount = uploadedCount + selected.length;
  const isAddingToExistingClaim = status === "needs_more_photos";
  const canAnalyze =
    !isBusy &&
    selected.length > 0 &&
    totalPhotoCount <= MAX_PHOTOS &&
    (isAddingToExistingClaim || totalPhotoCount >= MIN_PHOTOS);

  const choosePhotos = () => inputRef.current?.click();

  const addPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = [...(input.files ?? [])];
    input.value = "";
    if (files.length === 0) {
      return;
    }

    const availableSlots = MAX_PHOTOS - totalPhotoCount;
    const accepted: SelectedPhoto[] = [];
    const errors: string[] = [];
    for (const file of files) {
      const validationError = validatePhoto(file);
      if (validationError) {
        errors.push(validationError);
      } else if (accepted.length >= availableSlots) {
        errors.push(`A claim can contain at most ${MAX_PHOTOS} photos.`);
      } else {
        accepted.push({
          id: nextPhotoId.current++,
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
    }
    setSelected((current) => [...current, ...accepted]);
    setError(errors.length > 0 ? errors.join(" ") : null);
  };

  const removePhoto = (id: number) => {
    setSelected((current) => {
      const removed = current.find((photo) => photo.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return current.filter((photo) => photo.id !== id);
    });
  };

  const receiveTerminalClaim = async (
    terminal: ClaimResponse,
    activeClaimId: string,
    controller: AbortController,
  ) => {
    setStatus(terminal.status);
    if (terminal.status === "failed") {
      throw new Error(
        terminal.failure_code
          ? `Assessment failed: ${terminal.failure_code}`
          : "Assessment failed without an error code.",
      );
    }
    if (terminal.status === "deleted") {
      throw new Error("The claim was deleted before assessment completed.");
    }
    const exported = await api.getExport(activeClaimId, controller.signal);
    setBundle(exported);
    setUploadedCount(exported.source_images.length);
    setRunId(exported.analysis_run_id);
    onAssessmentReady(exported);
  };

  const waitForAssessment = async (
    activeClaimId: string,
    controller: AbortController,
  ) => {
    const terminal = await pollClaimUntilTerminal(api, activeClaimId, {
      signal: controller.signal,
      onStatus: (claim) => {
        setStatus(claim.status);
        setUploadedCount(claim.image_count);
        if (claim.active_run_id) {
          setRunId(claim.active_run_id);
        }
      },
    });
    await receiveTerminalClaim(terminal, activeClaimId, controller);
  };

  const analyze = async () => {
    if (!canAnalyze) {
      setError(
        totalPhotoCount < MIN_PHOTOS
          ? `Select at least ${MIN_PHOTOS} photos before analysis.`
          : "Select at least one additional photo.",
      );
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsBusy(true);
    setError(null);
    setBundle(null);
    setStatus("uploading");
    onAssessmentStarted();

    try {
      let activeClaimId = claimId;
      if (!activeClaimId) {
        const claim = await api.createClaim(controller.signal);
        activeClaimId = claim.claim_id;
        setClaimId(activeClaimId);
        setUploadedCount(claim.image_count);
      }

      for (const photo of [...selected]) {
        await api.uploadPhoto(activeClaimId, photo.file, controller.signal);
        setUploadedCount((count) => count + 1);
        setSelected((current) =>
          current.filter((item) => item.id !== photo.id),
        );
        URL.revokeObjectURL(photo.previewUrl);
      }

      const submission = await api.submitClaim(
        activeClaimId,
        controller.signal,
      );
      setRunId(submission.analysis_run_id);
      setStatus(submission.claim_status);
      await waitForAssessment(activeClaimId, controller);
    } catch (reason) {
      if (controller.signal.aborted) {
        return;
      }
      if (reason instanceof AssessmentPollTimeoutError) {
        setStatus("timed_out");
      }
      setError(errorMessage(reason));
    } finally {
      if (!controller.signal.aborted) {
        setIsBusy(false);
      }
    }
  };

  const retryStatus = async () => {
    if (!claimId) {
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsBusy(true);
    setError(null);
    try {
      await waitForAssessment(claimId, controller);
    } catch (reason) {
      if (!controller.signal.aborted) {
        setStatus(
          reason instanceof AssessmentPollTimeoutError ? "timed_out" : "failed",
        );
        setError(errorMessage(reason));
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsBusy(false);
      }
    }
  };

  const downloadJson = () => {
    if (!bundle) {
      return;
    }
    const blob = new Blob([serializeClaimExport(bundle)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = claimExportFileName(bundle);
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const jsonValue =
    resultTab === "assessment" ? bundle?.assessment : bundle?.raw_gemini;
  const missingViews = bundle?.assessment.coverage.missing ?? [];

  return (
    <aside className={styles.panel} aria-label="Vehicle photo assessment">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Assess vehicle photos</h2>
          <p className={styles.description}>
            {STATUS_LABELS[status] ?? status}
          </p>
        </div>
        {isBusy && <span className={styles.spinner} aria-label="Working" />}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        multiple
        hidden
        onChange={addPhotos}
      />

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={isBusy || totalPhotoCount >= MAX_PHOTOS}
          onClick={choosePhotos}
        >
          Select photos
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={!canAnalyze}
          onClick={analyze}
        >
          {status === "needs_more_photos"
            ? "Upload and reassess"
            : "Upload and assess"}
        </button>
      </div>

      <p className={styles.count}>
        {totalPhotoCount} of {MAX_PHOTOS} photos · 20 MiB maximum each
      </p>

      {selected.length > 0 && (
        <ul className={styles.photoList} aria-label="Selected photos">
          {selected.map((photo) => (
            <li key={photo.id} className={styles.photoRow}>
              <Image
                className={styles.thumbnail}
                src={photo.previewUrl}
                width={64}
                height={48}
                unoptimized
                alt=""
              />
              <span className={styles.photoName}>
                {photo.file.name}
                <small>{formatBytes(photo.file.size)}</small>
              </span>
              <button
                type="button"
                className={styles.removeButton}
                disabled={isBusy}
                aria-label={`Remove ${photo.file.name}`}
                onClick={() => removePhoto(photo.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {claimId && (
        <dl className={styles.identifiers}>
          <div>
            <dt>Claim</dt>
            <dd>{claimId}</dd>
          </div>
          {runId && (
            <div>
              <dt>Run</dt>
              <dd>{runId}</dd>
            </div>
          )}
        </dl>
      )}

      {missingViews.length > 0 && (
        <p className={styles.notice}>
          Coverage suggestion: add {missingViews.join(", ")} photos for a more
          complete assessment. The current result uses the photos you provided.
        </p>
      )}

      {error && (
        <div className={styles.error} role="alert">
          {error}
          {status === "timed_out" && (
            <button type="button" disabled={isBusy} onClick={retryStatus}>
              Check status again
            </button>
          )}
        </div>
      )}

      {bundle && (
        <section className={styles.results} aria-label="Gemini JSON result">
          <div className={styles.resultActions}>
            <div
              className={styles.tabs}
              role="tablist"
              aria-label="JSON result type"
            >
              <button
                type="button"
                role="tab"
                aria-selected={resultTab === "assessment"}
                onClick={() => setResultTab("assessment")}
              >
                Validated assessment
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={resultTab === "raw"}
                onClick={() => setResultTab("raw")}
              >
                Raw Gemini
              </button>
            </div>
            <button
              type="button"
              className={styles.downloadButton}
              onClick={downloadJson}
            >
              Download JSON
            </button>
          </div>
          <pre className={styles.json}>
            {JSON.stringify(jsonValue, null, 2)}
          </pre>
        </section>
      )}
    </aside>
  );
}
