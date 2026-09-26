"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { sendChatMessage } from "@/actions/chat";
import { RetroBadge, RetroButton, retroInputClass } from "@/components/retro";
import type { ChatMessageView } from "@/services/ai/chat";
import { ChatBubble } from "./ChatBubble";
import { ASSISTANT_NAME, TuxemonAttribution, TuxemonAvatar, TuxemonFace } from "./TuxemonAssistant";

const SUGGESTIONS = [
  "What does my insurance cover?",
  "What's my deductible?",
  "Which parts look damaged?",
  "Do I need more photos?",
  "Where do I file my claim?",
  "Summarize everything that happened.",
];
const MAX_LENGTH = 1000;

type Outbox = { text: string; error: string | null };

/** Mount with key={vehicleId}: all state here belongs to one vehicle's thread. */
export function ChatThread({ vehicleId, vehicleName, initialMessages }: { vehicleId: string; vehicleName: string; initialMessages: ChatMessageView[] }) {
  const unanswered = initialMessages.at(-1)?.role === "user" ? initialMessages.at(-1) : undefined;
  const [messages, setMessages] = useState(() => (unanswered ? initialMessages.slice(0, -1) : initialMessages));
  const [outbox, setOutbox] = useState<Outbox | null>(unanswered ? { text: unanswered.content, error: "I haven't replied to this yet. Tap Retry to ask again." } : null);
  const [draft, setDraft] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    if (!messages.length && !outbox) return;
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: scrolled.current ? "smooth" : "instant" });
    scrolled.current = true;
  }, [messages, outbox]);

  const sending = outbox !== null && outbox.error === null;

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || sending) return;
    setOutbox({ text, error: null });
    setDraft((d) => (d.trim() === text ? "" : d));
    const res = await sendChatMessage(vehicleId, text).catch(() => null);
    if (res?.ok) {
      setMessages((m) => [...m, res.data.user, res.data.reply]);
      setOutbox(null);
    } else {
      setOutbox({ text, error: res?.error ?? "Couldn't reach BeCarful. Check your connection, then tap Retry." });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!outbox) send(draft);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  const empty = messages.length === 0 && !outbox;

  return (
    <section className="surface-card mx-auto -mb-8 flex h-[calc(100dvh-10.625rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-[26rem] max-w-3xl flex-col overflow-hidden md:-mb-10 md:h-[calc(100dvh-7.25rem)]">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft">
          <TuxemonFace />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg leading-tight font-semibold text-ink">{ASSISTANT_NAME}</h1>
          <p className="text-xs text-ink-soft">Your car insurance buddy</p>
        </div>
        <RetroBadge tone="accent" className="max-w-[45%] truncate max-sm:hidden">
          <span className="truncate">{vehicleName}</span>
        </RetroBadge>
      </header>

      <div ref={logRef} role="log" aria-label={`Chat about ${vehicleName}`} className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
        {empty && (
          <div className="mx-auto max-w-lg py-4 text-center">
            <TuxemonAvatar frame="front" scale={2} className="appear mx-auto" />
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink">
              Hi! I&apos;m {ASSISTANT_NAME}. Ask me anything about your {vehicleName}: your policy, the damage, or how to file a claim.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} role={m.role} text={m.content} />
        ))}
        {outbox && (
          <ChatBubble role="user" text={outbox.text}>
            {outbox.error && <span className="mt-1 text-xs font-medium text-ink-soft">Not answered yet</span>}
          </ChatBubble>
        )}
        {sending && (
          <ChatBubble role="assistant">
            <span className="flex gap-1 py-1.5" aria-hidden>
              <span className="size-2 animate-bounce rounded-full bg-ink-soft [animation-delay:-0.3s]" />
              <span className="size-2 animate-bounce rounded-full bg-ink-soft [animation-delay:-0.15s]" />
              <span className="size-2 animate-bounce rounded-full bg-ink-soft" />
            </span>
            <span className="sr-only">{ASSISTANT_NAME} is typing…</span>
          </ChatBubble>
        )}
        {outbox?.error && (
          <div role="alert" className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2">
            <p className="flex-1 text-sm text-danger">{outbox.error}</p>
            <RetroButton type="button" variant="secondary" onClick={() => send(outbox.text)} className="shrink-0">
              Retry
            </RetroButton>
          </div>
        )}
        {empty && (
          <div className="mx-auto grid max-w-lg gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="min-h-11 rounded-lg border border-border bg-panel px-3 py-2 text-left text-sm text-ink transition hover:border-accent/50 hover:bg-accent-soft"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border px-3 pt-3 pb-2">
        {!outbox && !empty && (
          <div className="-mx-3 mb-2 flex gap-2 overflow-x-auto px-3 pb-1">
            {SUGGESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="min-h-11 shrink-0 rounded-full border border-border bg-panel px-3.5 text-sm whitespace-nowrap text-ink transition hover:border-accent/50 hover:bg-accent-soft"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <form ref={formRef} onSubmit={onSubmit} className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Message {ASSISTANT_NAME}</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={MAX_LENGTH}
              placeholder={`Ask about your ${vehicleName}…`}
              enterKeyHint="send"
              className={`${retroInputClass} max-h-36 resize-none [field-sizing:content]`}
            />
          </label>
          <RetroButton type="submit" disabled={!draft.trim() || outbox !== null}>
            Send
          </RetroButton>
        </form>
        <TuxemonAttribution />
      </div>
    </section>
  );
}
