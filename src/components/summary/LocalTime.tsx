"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export const useIsClient = () => useSyncExternalStore(subscribe, () => true, () => false);

export function LocalTime({ iso, withTime = false }: { iso: string; withTime?: boolean }) {
  const isClient = useIsClient();
  const opts: Intl.DateTimeFormatOptions = withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" };
  return <time dateTime={iso}>{isClient ? new Date(iso).toLocaleString(undefined, opts) : null}</time>;
}
