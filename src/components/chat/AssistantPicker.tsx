"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { chooseAssistant } from "@/actions/auth";
import { ASSISTANTS, type Assistant } from "./assistants";
import { TuxemonAttribution, TuxemonAvatar } from "./TuxemonAssistant";

export function AssistantPicker({ selectedId, voice }: { selectedId: string; voice: boolean }) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(selectedId);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => player.current?.pause(), []);

  function hear(a: Assistant) {
    player.current?.pause();
    if (playing === a.id) return setPlaying(null);
    if (!player.current) {
      const audio = new Audio();
      audio.onended = () => setPlaying(null);
      audio.onerror = () => {
        setPlaying(null);
        setError("Couldn't play that voice. Try again in a moment.");
      };
      player.current = audio;
    }
    setError(null);
    setPlaying(a.id);
    player.current.src = `/chat/speak?sample=${a.id}&v=${a.voice.id}-${a.voice.speed}`;
    player.current.play().catch(() => setPlaying(null));
  }

  function pick(id: string) {
    setError(null);
    startTransition(async () => {
      setCurrent(id);
      const res = await chooseAssistant(id).catch(() => null);
      if (!res?.ok) setError(res?.error ?? "Couldn't save your pick. Check your connection and try again.");
    });
  }

  return (
    <fieldset aria-busy={pending || undefined}>
      <legend className="sr-only">Chat buddy</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {ASSISTANTS.map((a) => {
          const selected = a.id === current;
          return (
            <div
              key={a.id}
              className={`flex flex-col overflow-hidden rounded-lg border text-sm font-medium transition ${selected ? "border-accent bg-accent-soft text-accent" : "border-border bg-panel text-ink"}`}
            >
              <label
                className={`flex cursor-pointer flex-col items-center gap-1 px-1 pt-2 pb-1.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent ${selected ? "" : "hover:bg-panel-shade"}`}
              >
                <input type="radio" name="assistant" value={a.id} checked={selected} onChange={() => pick(a.id)} className="sr-only" />
                <TuxemonAvatar frame="front" scale={1} sheet={a.sheet} decorative />
                <span className="max-w-full truncate">{a.name}</span>
              </label>
              {voice && (
                <button
                  type="button"
                  onClick={() => hear(a)}
                  aria-label={playing === a.id ? `Stop ${a.name}'s voice` : `Hear ${a.name}'s voice (${a.voice.name})`}
                  className="flex min-h-9 items-center justify-center gap-1 border-t border-border text-xs font-semibold text-accent transition hover:bg-accent-soft"
                >
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
                    <path d={playing === a.id ? "M7 7h10v10H7z" : "M8 5v14l11-7L8 5Z"} />
                  </svg>
                  {a.voice.name}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p role="status" className="mt-2 min-h-5 text-sm text-ink-soft">
        {pending ? "Saving…" : ""}
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <TuxemonAttribution monsters={ASSISTANTS} className="mt-2" />
    </fieldset>
  );
}
