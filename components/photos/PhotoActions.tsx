"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createPhotoUpload, registerPhoto, type PhotoResult } from "@/actions/photos";
import { PixelProgress, RetroButton, RetroLinkButton } from "@/components/retro";
import { uploadToS3 } from "@/lib/upload-client";
import type { PhotoSource } from "@/types";
import { AnalysisSummary } from "./AnalysisSummary";
import { CloseButton, FullScreenDialog, SHEET_CLASS } from "./FullScreenDialog";
import { PixelIcon, type PixelIconName } from "./PixelIcon";

const STEPS = ["Uploading evidence…", "Inspecting vehicle…", "Identifying visible damage…", "Mapping vehicle components…", "Updating your car…"];
const STEP_MS = 1800;
const ACTION_CLASS = "w-full min-h-24 flex-col px-2! py-3! text-sm";

function TileIcon({ name, primary = false }: { name: PixelIconName; primary?: boolean }) {
  return (
    <span className={`grid size-10 place-items-center rounded-lg ${primary ? "bg-accent-ink/15" : "bg-accent-soft text-accent"}`}>
      <PixelIcon name={name} className="size-6" />
    </span>
  );
}

type Location = { latitude: number; longitude: number; accuracy: number } | null;
type Picked = { file: File; preview: string; source: PhotoSource; capturedAt?: string };
type Phase = { name: "review" } | { name: "processing"; step: number; error?: string } | { name: "done"; result: PhotoResult };

function requestLocation(): Promise<Location> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    // getCurrentPosition's timeout doesn't count time spent on the permission prompt.
    const giveUp = setTimeout(() => resolve(null), 10_000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(giveUp);
        resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy });
      },
      () => {
        clearTimeout(giveUp);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 60_000 },
    );
  });
}

export function PhotoActions({ vehicleId, hasPolicy }: { vehicleId: string; hasPolicy: boolean }) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const location = useRef<Promise<Location>>(Promise.resolve(null));
  const uploadedKey = useRef<string | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "review" });
  const [locationStatus, setLocationStatus] = useState<"pending" | "recorded" | "unavailable">("pending");

  function takePhoto() {
    setLocationStatus("pending");
    location.current = requestLocation().then((loc) => {
      setLocationStatus(loc ? "recorded" : "unavailable");
      return loc;
    });
    cameraInput.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>, source: PhotoSource) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (picked) URL.revokeObjectURL(picked.preview);
    uploadedKey.current = null;
    setPicked({ file, preview: URL.createObjectURL(file), source, capturedAt: source === "camera" ? new Date().toISOString() : undefined });
    setPhase({ name: "review" });
  }

  function close() {
    if (picked) URL.revokeObjectURL(picked.preview);
    setPicked(null);
  }

  function pickAgain(source: PhotoSource) {
    // The modal makes the file inputs inert; leave it synchronously so the picker can open.
    flushSync(close);
    if (source === "camera") takePhoto();
    else uploadInput.current?.click();
  }

  const fail = (error: string) => setPhase((p) => ({ name: "processing", step: p.name === "processing" ? p.step : 0, error }));

  async function submit() {
    if (!picked) return;
    const { file, source, capturedAt } = picked;
    setPhase({ name: "processing", step: 0 });
    let uploading = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      let key = uploadedKey.current;
      if (!key) {
        const up = await createPhotoUpload(vehicleId, { contentType: file.type, size: file.size });
        if (!up.ok) return fail(up.error);
        await uploadToS3(up.data, file);
        key = uploadedKey.current = up.data.key;
      }
      uploading = false;
      setPhase({ name: "processing", step: 1 });
      timer = setInterval(
        () => setPhase((p) => (p.name === "processing" && !p.error && p.step < STEPS.length - 2 ? { ...p, step: p.step + 1 } : p)),
        STEP_MS,
      );
      const loc = source === "camera" ? await location.current : null;
      const res = await registerPhoto(
        vehicleId,
        source === "camera"
          ? { key, source, capturedAt, ...(loc && { latitude: loc.latitude, longitude: loc.longitude, locationAccuracy: loc.accuracy }) }
          : { key, source },
      );
      if (!res.ok) return fail(res.error);
      setPhase({ name: "processing", step: STEPS.length - 1 });
      await new Promise((r) => setTimeout(r, 700));
      setPhase({ name: "done", result: res.data });
    } catch {
      fail(
        uploading
          ? "Upload failed. Check your connection and tap Retry."
          : "Network problem. Your photo is uploaded. Check your connection and tap Retry.",
      );
    } finally {
      clearInterval(timer);
    }
  }

  const busy = phase.name === "processing" && !phase.error;
  const title = phase.name === "review" ? "Review photo" : phase.name === "processing" ? "Checking damage" : "Results";

  return (
    <>
      <div id="photo-actions" className="grid scroll-mt-24 grid-cols-2 gap-3 sm:grid-cols-3">
        <RetroButton type="button" onClick={takePhoto} className={ACTION_CLASS} icon={<TileIcon name="camera" primary />}>
          Take Photo
        </RetroButton>
        <RetroButton
          type="button"
          variant="secondary"
          onClick={() => uploadInput.current?.click()}
          className={ACTION_CLASS}
          icon={<TileIcon name="upload" />}
        >
          Upload Photo
        </RetroButton>
        <RetroLinkButton
          href="/insurance"
          variant="secondary"
          className={`col-span-2 min-h-16! flex-row! sm:col-span-1 sm:min-h-24! sm:flex-col! ${ACTION_CLASS}`}
          icon={<TileIcon name="policy" />}
        >
          {hasPolicy ? "Insurance" : "Add Insurance"}
        </RetroLinkButton>
      </div>
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e, "camera")} />
      <input ref={uploadInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onFile(e, "upload")} />

      {picked && (
        <FullScreenDialog label={title} onClose={close} canClose={!busy}>
          <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <h2 className="font-display text-lg font-semibold">{title}</h2>
            <CloseButton onClick={close} disabled={busy} />
          </div>
          <div className="min-h-0 flex-1 px-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img
              src={picked.preview}
              alt="Photo to review"
              className={`size-full rounded-lg object-contain transition-opacity ${phase.name === "review" ? "" : "opacity-50"}`}
            />
          </div>

          <div className={`${SHEET_CLASS} mt-3 max-h-[55dvh] space-y-4`}>
            {phase.name === "review" && (
              <>
                {picked.source === "camera" ? (
                  <p className={`flex items-center gap-2 text-sm ${locationStatus === "pending" ? "animate-pulse" : ""}`}>
                    <PixelIcon name="pin" className={`size-4 shrink-0 ${locationStatus === "recorded" ? "text-ok" : "text-muted"}`} />
                    {locationStatus === "pending"
                      ? "Getting location…"
                      : locationStatus === "recorded"
                        ? "Location recorded"
                        : "Location unavailable. You can still use this photo."}
                  </p>
                ) : (
                  <p className="text-sm text-ink-soft">Uploaded photo. We won&apos;t record a capture time or location for it.</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <RetroButton type="button" variant="secondary" onClick={() => pickAgain(picked.source)}>
                    {picked.source === "camera" ? "Retake" : "Choose another"}
                  </RetroButton>
                  <RetroButton type="button" onClick={submit}>
                    Use photo
                  </RetroButton>
                </div>
              </>
            )}

            {phase.name === "processing" && (
              <>
                <PixelProgress steps={STEPS} current={phase.step} failed={Boolean(phase.error)} />
                {phase.error && (
                  <>
                    <p role="alert" className="text-sm text-danger">
                      {phase.error}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <RetroButton type="button" variant="secondary" onClick={() => pickAgain(picked.source)}>
                        New photo
                      </RetroButton>
                      <RetroButton type="button" onClick={submit}>
                        Retry
                      </RetroButton>
                    </div>
                  </>
                )}
              </>
            )}

            {phase.name === "done" && (
              <>
                <AnalysisSummary analysis={phase.result.analysis} failed={!phase.result.analysis} onRetry={submit} />
                <div className="grid grid-cols-2 gap-3">
                  <RetroButton type="button" variant="secondary" onClick={() => pickAgain(picked.source)}>
                    Add another
                  </RetroButton>
                  <RetroButton
                    type="button"
                    onClick={() => {
                      close();
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    See my car
                  </RetroButton>
                </div>
              </>
            )}
          </div>
        </FullScreenDialog>
      )}
    </>
  );
}
