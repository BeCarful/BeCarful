"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { loadChat, transcribeSpeech } from "@/actions/chat";
import { NavIcon, isActive } from "@/components/layout/BottomNav";
import { RetroButton, retroInputClass } from "@/components/retro";
import type { ChatMessageView } from "@/services/ai/chat";
import type { Assistant } from "./assistants";
import { AssistantText, ChatBubble, TypingBubble } from "./ChatBubble";
import { ActionCard } from "./ChatThread";
import { streamChat } from "./stream";
import { TuxemonAttribution, TuxemonAvatar, TuxemonFace } from "./TuxemonAssistant";
import { useVoice } from "./useVoice";

type Spot = { x: number; y: number };
type Mode = "closed" | "text" | "voice";
type Talk = { status: "listening" | "hearing" | "thinking" | "done" | "error"; heard?: string; streamed?: string; reply?: ChatMessageView; error?: string };

const SPOT_KEY = "becarful:buddy-spot";
const DRAG_THRESHOLD = 6;
const OFFLINE = "Couldn't reach BeCarful. Check your connection and try again.";
const TEXT_ICON = ["M4 5h16v11H9l-5 4V5Z", "M8 9.5h8M8 12.5h5"];
const MIC_ICON = ["M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z", "M6 11a6 6 0 0 0 12 0", "M12 17v4"];
const STOP_ICON = ["M7 7h10v10H7z"];
const CLOSE_ICON = ["M6 6l12 12", "M18 6 6 18"];
const SEND_ICON = ["M4 12 20 4l-4 16-4-7-8-1Z", "m12 13 8-9"];
const iconButton = "grid size-9 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-panel-shade hover:text-ink";
const popClass = "fade-in fixed z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-panel text-ink shadow-[0_12px_32px_var(--shadow)]";

function moveTo(el: HTMLElement, x: number, y: number): Spot {
  const { width, height } = el.getBoundingClientRect();
  const spot = { x: Math.min(Math.max(x, 0), innerWidth - width), y: Math.min(Math.max(y, 0), innerHeight - height) };
  Object.assign(el.style, { left: `${spot.x}px`, top: `${spot.y}px`, right: "auto", bottom: "auto" });
  return spot;
}

function popStyle(anchor: DOMRect, width: number): CSSProperties {
  const w = Math.min(width, innerWidth - 24);
  const left = Math.min(Math.max(anchor.left + anchor.width / 2 - w / 2, 12), innerWidth - w - 12);
  return anchor.top > innerHeight - anchor.bottom
    ? { left, width: w, bottom: innerHeight - anchor.top + 8, maxHeight: Math.min(anchor.top - 16, 416) }
    : { left, width: w, top: anchor.bottom + 8, maxHeight: Math.min(innerHeight - anchor.bottom - 16, 416) };
}

function MiniChat({ vehicleId, assistant, style, onClose }: { vehicleId: string; assistant: Assistant; style: CSSProperties; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessageView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState("");
  const [outbox, setOutbox] = useState<{ text: string; error: string | null } | null>(null);
  const [streamed, setStreamed] = useState("");
  const router = useRouter();
  const log = useRef<HTMLDivElement>(null);
  const sending = outbox !== null && outbox.error === null;

  useEffect(() => {
    let live = true;
    loadChat(vehicleId).then(
      (res) => live && (res.ok ? setMessages(res.data) : setLoadError(res.error)),
      () => live && setLoadError(OFFLINE),
    );
    return () => {
      live = false;
    };
  }, [vehicleId, attempt]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages, outbox, streamed]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || sending) return;
    setOutbox({ text, error: null });
    setStreamed("");
    setDraft("");
    const res = await streamChat(vehicleId, text, setStreamed);
    setStreamed("");
    if (res.ok) {
      setMessages((m) => [...(m ?? []), res.data.user, res.data.reply]);
      setOutbox(null);
      if (res.data.navigate) router.push(res.data.navigate);
    } else {
      setOutbox({ text, error: res.error });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sending) send(draft);
  }

  return (
    <div role="dialog" aria-label={`Chat with ${assistant.name}`} style={style} className={popClass}>
      <header className="flex items-center gap-2 border-b border-border py-1 pr-1 pl-3">
        <TuxemonFace scale={1} assistant={assistant} talking={sending} />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{assistant.name}</p>
        <Link href="/chat" onClick={onClose} aria-label="Open full chat" className={iconButton}>
          <NavIcon paths={["M9 5h10v10", "M19 5 5 19"]} active={false} />
        </Link>
        <button type="button" onClick={onClose} aria-label="Close chat" className={iconButton}>
          <NavIcon paths={CLOSE_ICON} active={false} />
        </button>
      </header>
      <div ref={log} role="log" aria-label={`Chat with ${assistant.name}`} className="min-h-24 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
        {!messages && !loadError && <p className="text-sm text-ink-soft">Opening your chat…</p>}
        {loadError && (
          <div role="alert" className="flex items-center gap-2 text-sm text-danger">
            <span className="flex-1">{loadError}</span>
            <RetroButton type="button" variant="secondary" onClick={() => (setLoadError(null), setAttempt((n) => n + 1))}>
              Retry
            </RetroButton>
          </div>
        )}
        {messages?.length === 0 && !outbox && (
          <p className="text-sm text-ink-soft">Hi! I&apos;m {assistant.name}. Ask me about your car, your policy or your claim.</p>
        )}
        {messages?.map((m) => (
          <ChatBubble key={m.id} role={m.role} text={m.content} assistant={assistant} compact>
            {m.action && (
              <ActionCard vehicleId={vehicleId} message={m} onUpdate={(next) => setMessages((all) => all && all.map((x) => (x.id === next.id ? next : x)))} />
            )}
          </ChatBubble>
        ))}
        {outbox && <ChatBubble role="user" text={outbox.text} assistant={assistant} compact />}
        {sending && (streamed ? <ChatBubble role="assistant" text={streamed} assistant={assistant} compact talking /> : <TypingBubble assistant={assistant} compact />)}
        {outbox?.error && (
          <div role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            <span className="flex-1">{outbox.error}</span>
            <RetroButton type="button" variant="secondary" onClick={() => send(outbox.text)}>
              Retry
            </RetroButton>
          </div>
        )}
      </div>
      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border p-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Message {assistant.name}</span>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
            enterKeyHint="send"
            placeholder={`Message ${assistant.name}…`}
            className={retroInputClass}
          />
        </label>
        <RetroButton type="submit" aria-label="Send" disabled={!draft.trim() || sending} className="px-3">
          <NavIcon paths={SEND_ICON} active />
        </RetroButton>
      </form>
      <TuxemonAttribution monsters={[assistant]} className="px-3 pb-2" />
    </div>
  );
}

export function ChatBuddy({ vehicleId, assistant, voice }: { vehicleId: string | null; assistant: Assistant; voice: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("closed");
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [talk, setTalk] = useState<Talk | null>(null);
  const speech = useVoice();
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const turn = useRef(0);
  const spot = useRef<Spot | null>(null);
  const drag = useRef<{ dx: number; dy: number; x0: number; y0: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const hidden = !vehicleId || isActive(path, "/chat");
  const busy = talk?.status === "hearing" || talk?.status === "thinking";

  if (hidden && mode !== "closed") setMode("closed");

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (!spot.current) {
      try {
        const saved = JSON.parse(localStorage.getItem(SPOT_KEY) ?? "null");
        if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) spot.current = saved;
      } catch {}
    }
    const fit = () => {
      if (spot.current) spot.current = moveTo(el, spot.current.x, spot.current.y);
      setAnchor(el.getBoundingClientRect());
    };
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, [hidden]);

  function show(next: Mode) {
    if (mode === "closed") opener.current = document.activeElement as HTMLElement | null;
    if (root.current) setAnchor(root.current.getBoundingClientRect());
    setMode(next);
  }

  function reset() {
    turn.current++;
    speech.stop();
    speech.stopPlaying();
    setTalk(null);
  }

  function close() {
    reset();
    setMode("closed");
    requestAnimationFrame(() => opener.current?.focus());
  }

  function toggleText() {
    if (mode === "text") return close();
    reset();
    show("text");
  }

  async function talkToBuddy() {
    if (speech.recording) return speech.stop();
    reset();
    const id = turn.current;
    const stale = () => turn.current !== id;
    show("voice");
    setTalk({ status: "listening" });
    const error = await speech.record(async (audio) => {
      if (stale()) return;
      if (!audio) return setTalk({ status: "error", error: "I didn't hear anything. Tap the mic and try again." });
      setTalk({ status: "hearing" });
      const form = new FormData();
      form.append("audio", audio);
      const heard = await transcribeSpeech(form).catch(() => null);
      if (stale()) return;
      if (!heard?.ok) return setTalk({ status: "error", error: heard?.error ?? OFFLINE });
      setTalk({ status: "thinking", heard: heard.data });
      const res = await streamChat(vehicleId!, heard.data, (streamed) => {
        if (!stale()) setTalk({ status: "thinking", heard: heard.data, streamed });
      });
      if (stale()) return;
      if (!res.ok) return setTalk({ status: "error", heard: heard.data, error: res.error });
      setTalk({ status: "done", heard: heard.data, reply: res.data.reply });
      speech.play(res.data.reply.id, assistant.id);
      if (res.data.navigate) router.push(res.data.navigate);
    });
    if (error && !stale()) setTalk({ status: "error", error });
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    dragged.current = false;
    if (e.button !== 0 || !root.current) return;
    e.preventDefault();
    const r = root.current.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || !root.current || (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < DRAG_THRESHOLD)) return;
    d.moved = true;
    spot.current = moveTo(root.current, e.clientX - d.dx, e.clientY - d.dy);
    if (mode !== "closed") setAnchor(root.current.getBoundingClientRect());
  }

  function onPointerUp() {
    dragged.current = drag.current?.moved ?? false;
    drag.current = null;
    if (!dragged.current) return;
    try {
      localStorage.setItem(SPOT_KEY, JSON.stringify(spot.current));
    } catch {}
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && mode !== "closed") close();
  }

  if (hidden) return null;

  const round = "grid size-11 place-items-center rounded-full border shadow-[0_2px_6px_var(--shadow)] transition disabled:opacity-55";
  const reply = talk?.reply;
  return (
    <div onKeyDown={onKeyDown}>
      <div ref={root} className="fixed right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[45] flex flex-col items-center md:right-6 md:bottom-6">
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
          onClick={() => {
            if (dragged.current) dragged.current = false;
            else toggleText();
          }}
          aria-label={`Chat with ${assistant.name}`}
          title={`${assistant.name} (drag to move) · sprite by ${assistant.author} (Tuxemon), ${assistant.license}`}
          className="cursor-grab touch-none rounded-full select-none active:cursor-grabbing"
        >
          <span className="buddy-bob block drop-shadow-[0_6px_4px_var(--shadow)]">
            <TuxemonAvatar frame="front" scale={1} sheet={assistant.sheet} decorative />
          </span>
        </button>
        <div className="-mt-1 flex gap-1.5">
          <button
            type="button"
            onClick={toggleText}
            aria-label={`Type to ${assistant.name}`}
            aria-expanded={mode === "text"}
            className={`${round} ${mode === "text" ? "border-accent bg-accent text-accent-ink" : "border-border bg-panel text-ink hover:bg-panel-shade"}`}
          >
            <NavIcon paths={TEXT_ICON} active={mode === "text"} />
          </button>
          {voice && (
            <button
              type="button"
              onClick={talkToBuddy}
              disabled={busy}
              aria-label={speech.recording ? "Stop and send" : `Talk to ${assistant.name}`}
              aria-pressed={speech.recording}
              className={`${round} ${speech.recording ? "pulse-ring border-danger bg-danger text-white" : "border-border bg-panel text-ink hover:bg-panel-shade"}`}
            >
              <NavIcon paths={speech.recording ? STOP_ICON : MIC_ICON} active />
            </button>
          )}
        </div>
      </div>

      {mode === "text" && anchor && vehicleId && (
        <MiniChat key={vehicleId} vehicleId={vehicleId} assistant={assistant} style={popStyle(anchor, 320)} onClose={close} />
      )}

      {mode === "voice" && anchor && talk && (
        <div role="dialog" aria-label={`Talking to ${assistant.name}`} style={popStyle(anchor, 280)} className={`${popClass} p-3 text-[15px] leading-relaxed`}>
          <div className="flex min-h-0 items-start gap-2">
            <div role="status" className="min-h-0 min-w-0 flex-1 overflow-y-auto">
              {talk.heard && <p className="mb-1 text-xs text-ink-soft">You: “{talk.heard}”</p>}
              {talk.status === "listening" && (
                <p className="flex items-center gap-2">
                  <span aria-hidden className="pulse-ring size-2.5 shrink-0 rounded-full bg-danger" />
                  Listening… I&apos;ll send it when you pause.
                </p>
              )}
              {talk.status === "hearing" && <p className="text-ink-soft">Got it…</p>}
              {talk.status === "thinking" && (talk.streamed ? <AssistantText text={talk.streamed} /> : <p className="text-ink-soft">Thinking…</p>)}
              {talk.status === "done" && reply && <AssistantText text={reply.content} />}
              {talk.status === "error" && <p className="text-danger">{talk.error}</p>}
              {speech.playError && <p className="mt-1 text-sm text-danger">{speech.playError}</p>}
            </div>
            <button type="button" onClick={close} aria-label="Close" className={`${iconButton} -mt-1 -mr-1`}>
              <NavIcon paths={CLOSE_ICON} active={false} />
            </button>
          </div>
          {talk.status === "done" && reply && (
            <>
              {reply.action && vehicleId && (
                <ActionCard vehicleId={vehicleId} message={reply} onUpdate={(next) => setTalk((t) => t && { ...t, reply: next })} />
              )}
              <button
                type="button"
                onClick={() => (speech.playing === reply.id ? speech.stopPlaying() : speech.play(reply.id, assistant.id))}
                className="mt-1 flex min-h-11 items-center gap-1 self-start text-xs font-semibold text-accent hover:underline"
              >
                <NavIcon paths={speech.playing === reply.id ? STOP_ICON : ["M8 5v14l11-7L8 5Z"]} active={false} />
                {speech.playing === reply.id ? "Stop" : "Play again"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
