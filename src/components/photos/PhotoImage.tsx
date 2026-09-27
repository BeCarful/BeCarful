"use client";

import { useState } from "react";
import { getPhotoViewUrl } from "@/actions/photos";

/**
 * Private S3 image. Keeps its first presigned URL (so re-renders don't re-download),
 * and asks for a fresh one once if it expires.
 */
export function PhotoImage({
  vehicleId,
  photoId,
  src,
  alt,
  className = "",
  style,
}: {
  vehicleId: string;
  photoId: string;
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [url, setUrl] = useState(src);
  const [state, setState] = useState<"ok" | "refreshed" | "broken">("ok");

  async function onError() {
    if (state !== "ok") return setState("broken");
    setState("refreshed");
    const res = await getPhotoViewUrl(vehicleId, photoId).catch(() => null);
    if (res?.ok) setUrl(res.data);
    else setState("broken");
  }

  if (state === "broken") {
    return (
      <span role="img" aria-label={alt} className={`grid place-items-center bg-panel-shade p-1 text-center text-xs text-ink-soft ${className}`}>
        Photo unavailable. Refresh to retry.
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URLs, not optimizable by next/image
  return <img src={url} alt={alt} className={className} style={style} loading="lazy" decoding="async" onError={onError} />;
}
