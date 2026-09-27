"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { loadChat } from "@/actions/chat";
import { isActive } from "@/components/layout/BottomNav";
import { RetroButton } from "@/components/retro";
import type { ChatMessageView, ChatSubject } from "@/services/ai/chat";
import { Chat } from "./ChatThread";
import { ASSISTANT_NAME, TuxemonAvatar } from "./TuxemonAssistant";

type Loaded = { vehicleId: string; messages: ChatMessageView[]; subjects: ChatSubject[] };

export function ChatBuddy({ vehicleId, voice }: { vehicleId: string | null; voice: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const buddy = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const hidden = !vehicleId || isActive(path, "/chat");

  if (hidden && open) setOpen(false);

  useEffect(() => {
    if (!open || !vehicleId) return;
    let live = true;
    loadChat(vehicleId).then(
      (res) => {
        if (!live) return;
        if (res.ok) setLoaded({ vehicleId, ...res.data });
        else setError(res.error);
      },
      () => live && setError("Couldn't reach BeCarful. Check your connection and try again."),
    );
    return () => {
      live = false;
    };
  }, [open, vehicleId, attempt]);

  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setLoaded(null);
    setError(null);
    requestAnimationFrame(() => buddy.current?.focus());
  }

  if (hidden) return null;

  if (!open) {
    return (
      <button
        ref={buddy}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Talk to ${ASSISTANT_NAME}`}
        aria-haspopup="dialog"
        title={`Talk to ${ASSISTANT_NAME} · sprite by tamashihoshi (Tuxemon), CC BY-SA 4.0`}
        className="buddy-wander fixed right-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 rounded-full hover:[animation-play-state:paused] focus-visible:[animation-play-state:paused] md:right-8 md:bottom-8"
      >
        <span className="buddy-bob relative block drop-shadow-[0_6px_4px_var(--shadow)]">
          <TuxemonAvatar frame="front" scale={1} decorative />
          {voice && (
            <span aria-hidden className="absolute -right-1 bottom-1 grid size-6 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_1px_2px_var(--shadow)]">
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                <path d="M12 4a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 0 0 5 0v-4A2.5 2.5 0 0 0 12 4ZM7 11a5 5 0 0 0 10 0M12 16v4" />
              </svg>
            </span>
          )}
        </span>
      </button>
    );
  }

  const frame =
    "h-[min(36rem,calc(100dvh-10.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] shadow-[0_12px_32px_var(--shadow)] md:h-[min(40rem,calc(100dvh-4rem))]";
  return (
    <div
      ref={panel}
      role="dialog"
      aria-label={`Talk to ${ASSISTANT_NAME}`}
      tabIndex={-1}
      onKeyDown={(e) => e.key === "Escape" && close()}
      className="fade-in fixed inset-x-2 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 outline-none md:inset-x-auto md:right-6 md:bottom-6 md:w-[26rem]"
    >
      {error ? (
        <div role="alert" className={`surface-card flex flex-col items-center justify-center gap-3 p-6 text-center ${frame}`}>
          <p className="text-sm text-danger">{error}</p>
          <div className="flex gap-2">
            <RetroButton
              type="button"
              onClick={() => {
                setError(null);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </RetroButton>
            <RetroButton type="button" variant="secondary" onClick={close}>
              Close
            </RetroButton>
          </div>
        </div>
      ) : (
        <Chat
          vehicleId={vehicleId!}
          messages={loaded?.vehicleId === vehicleId ? loaded.messages : null}
          subjects={loaded?.subjects ?? []}
          voice={voice}
          className={frame}
          onClose={close}
        />
      )}
    </div>
  );
}
