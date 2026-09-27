"use client";

import { useEffect, useRef, useState } from "react";
import { createPhotoUpload, registerPhoto, type PhotoResult } from "@/actions/photos";
import { PixelProgress, RetroButton, RetroLinkButton } from "@/components/retro";
import { uploadToStorage } from "@/lib/upload-client";
import { AnalysisSummary } from "./AnalysisSummary";
import { CloseButton, FullScreenDialog, SHEET_CLASS } from "./FullScreenDialog";
import { PixelIcon, type PixelIconName } from "./PixelIcon";

const STEPS = ["Uploading evidence…", "Inspecting vehicle…", "Identifying visible damage…", "Mapping vehicle components…", "Updating your car…"];
const STEP_MS = 1800;
const ACTION_CLASS = "w-full min-h-24 flex-col px-2! py-3! text-sm";
const CAMERA_BUTTON_ID = "take-photo";
const NO_CAMERA = "This browser can't open the camera. Open BeCarful in Safari or Chrome on your phone.";
const BLOCKED = "Camera access is blocked. Allow the camera for this site in your browser settings, then tap Try again.";
const CAMERA_FAILED = "We couldn't start the camera. Close other apps using it, then tap Try again.";

export function openCamera() {
  document.getElementById(CAMERA_BUTTON_ID)?.click();
}

function TileIcon({ name, primary = false }: { name: PixelIconName; primary?: boolean }) {
  return (
    <span className={`grid size-10 place-items-center rounded-lg ${primary ? "bg-accent-ink/15" : "bg-accent-soft text-accent"}`}>
      <PixelIcon name={name} className="size-6" />
    </span>
  );
}

type Location = { latitude: number; longitude: number; accuracy: number } | null;
type Picked = { file: File; preview: string; capturedAt: string };
type Camera = { status: "starting" | "live" } | { status: "error"; error: string };
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
  return (
    <>
      <div id="photo-actions" className="grid scroll-mt-24 grid-cols-2 gap-3">
        <RetroButton type="button" onClick={openCamera} className={ACTION_CLASS} icon={<TileIcon name="camera" primary />}>
          Take Photo
        </RetroButton>
        <RetroLinkButton href="/insurance" variant="secondary" className={ACTION_CLASS} icon={<TileIcon name="policy" />}>
          {hasPolicy ? "Insurance" : "Add Insurance"}
        </RetroLinkButton>
      </div>
      <PhotoCapture vehicleId={vehicleId} />
    </>
  );
}

export function PhotoCapture({ vehicleId, exitHref }: { vehicleId: string; exitHref?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const cameraWanted = useRef(false);
  const location = useRef<Promise<Location>>(Promise.resolve(null));
  const uploadedKey = useRef<string | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "review" });
  const [locationStatus, setLocationStatus] = useState<"pending" | "recorded" | "unavailable">("pending");

  function startLocation() {
    setLocationStatus("pending");
    location.current = requestLocation().then((loc) => {
      setLocationStatus(loc ? "recorded" : "unavailable");
      return loc;
    });
  }

  function stopStream() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  useEffect(() => stopStream, []);

  useEffect(() => {
    if (camera?.status === "live" && video.current) video.current.srcObject = stream.current;
  }, [camera]);

  async function startCamera() {
    cameraWanted.current = true;
    setCamera({ status: "starting" });
    if (!navigator.mediaDevices?.getUserMedia) return setCamera({ status: "error", error: NO_CAMERA });
    try {
      stopStream();
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (!cameraWanted.current) return s.getTracks().forEach((t) => t.stop());
      stream.current = s;
      setCamera({ status: "live" });
    } catch (err) {
      setCamera({ status: "error", error: err instanceof DOMException && err.name === "NotAllowedError" ? BLOCKED : CAMERA_FAILED });
    }
  }

  function takeNew() {
    if (picked) URL.revokeObjectURL(picked.preview);
    setPicked(null);
    startLocation();
    startCamera();
  }

  function shoot() {
    const v = video.current;
    if (!v?.videoWidth) return;
    const capturedAt = new Date().toISOString();
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return setCamera({ status: "error", error: CAMERA_FAILED });
        cameraWanted.current = false;
        stopStream();
        setCamera(null);
        uploadedKey.current = null;
        setPicked({ file: new File([blob], "photo.jpg", { type: "image/jpeg" }), preview: URL.createObjectURL(blob), capturedAt });
        setPhase({ name: "review" });
      },
      "image/jpeg",
      0.9,
    );
  }

  function close() {
    cameraWanted.current = false;
    stopStream();
    setCamera(null);
    if (picked) URL.revokeObjectURL(picked.preview);
    setPicked(null);
  }

  const fail = (error: string) => setPhase((p) => ({ name: "processing", step: p.name === "processing" ? p.step : 0, error }));

  async function submit() {
    if (!picked) return;
    const { file, capturedAt } = picked;
    setPhase({ name: "processing", step: 0 });
    let uploading = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      let key = uploadedKey.current;
      if (!key) {
        const up = await createPhotoUpload(vehicleId, { contentType: file.type, size: file.size });
        if (!up.ok) return fail(up.error);
        await uploadToStorage(up.data, file);
        key = uploadedKey.current = up.data.key;
      }
      uploading = false;
      setPhase({ name: "processing", step: 1 });
      timer = setInterval(
        () => setPhase((p) => (p.name === "processing" && !p.error && p.step < STEPS.length - 2 ? { ...p, step: p.step + 1 } : p)),
        STEP_MS,
      );
      const loc = await location.current;
      const res = await registerPhoto(vehicleId, {
        key,
        source: "camera",
        capturedAt,
        ...(loc && { latitude: loc.latitude, longitude: loc.longitude, locationAccuracy: loc.accuracy }),
      });
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
  const title = camera ? "Take photo" : phase.name === "review" ? "Review photo" : phase.name === "processing" ? "Checking damage" : "Results";

  return (
    <>
      <button id={CAMERA_BUTTON_ID} type="button" hidden onClick={takeNew} />

      {(camera || picked) && (
        <FullScreenDialog label={title} onClose={close} canClose={!busy}>
          <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <h2 className="font-display text-lg font-semibold">{title}</h2>
            <CloseButton onClick={close} disabled={busy} />
          </div>
          {camera ? (
            <>
              <div className="relative min-h-0 flex-1 px-4">
                {camera.status === "error" ? (
                  <div className="grid size-full place-items-center text-center">
                    <div className="max-w-sm space-y-4">
                      <p role="alert">{camera.error}</p>
                      <RetroButton type="button" onClick={startCamera}>
                        Try again
                      </RetroButton>
                    </div>
                  </div>
                ) : (
                  <video
                    ref={video}
                    autoPlay
                    playsInline
                    muted
                    aria-label="Camera preview"
                    className="size-full rounded-lg bg-black object-contain"
                  />
                )}
                {camera.status === "starting" && <p className="absolute inset-0 grid animate-pulse place-items-center text-sm">Starting camera…</p>}
              </div>
              {camera.status !== "error" && (
                <div className="flex justify-center pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                  <button
                    type="button"
                    onClick={shoot}
                    disabled={camera.status !== "live"}
                    aria-label="Take photo"
                    className="grid size-20 place-items-center rounded-full border-4 border-white transition active:scale-95 disabled:opacity-40"
                  >
                    <span className="size-14 rounded-full bg-white" />
                  </button>
                </div>
              )}
            </>
          ) : (
            picked && (
              <>
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
                      <p className={`flex items-center gap-2 text-sm ${locationStatus === "pending" ? "animate-pulse" : ""}`}>
                        <PixelIcon name="pin" className={`size-4 shrink-0 ${locationStatus === "recorded" ? "text-ok" : "text-muted"}`} />
                        {locationStatus === "pending"
                          ? "Getting location…"
                          : locationStatus === "recorded"
                            ? "Location recorded"
                            : "Location unavailable. You can still use this photo."}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <RetroButton type="button" variant="secondary" onClick={takeNew}>
                          Retake
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
                            <RetroButton type="button" variant="secondary" onClick={takeNew}>
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
                        <RetroButton type="button" variant="secondary" onClick={takeNew}>
                          Add another
                        </RetroButton>
                        {exitHref ? (
                          <RetroLinkButton href={exitHref} onClick={close}>
                            See my car
                          </RetroLinkButton>
                        ) : (
                          <RetroButton
                            type="button"
                            onClick={() => {
                              close();
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            See my car
                          </RetroButton>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            )
          )}
        </FullScreenDialog>
      )}
    </>
  );
}
