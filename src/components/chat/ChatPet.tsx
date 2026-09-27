"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { resolveChatAction, sendChatMessage } from "@/actions/chat";
import { RetroButton } from "@/components/retro";
import type { ChatMessageView } from "@/services/ai/chat";
import { AssistantText } from "./ChatBubble";
import { ASSISTANT_NAME, TuxemonAttribution, TuxemonAvatar } from "./TuxemonAssistant";

const POS_KEY = "becarful-pet-pos";
const PET_W = 128;
const PET_H = 186;
const MAX_LENGTH = 1000;

type Pos = { x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function clampPos(p: Pos): Pos {
  const margin = 8;
  return {
    x: clamp(p.x, margin, Math.max(margin, window.innerWidth - PET_W - margin)),
    y: clamp(p.y, margin, Math.max(margin, window.innerHeight - PET_H - margin)),
  };
}

function defaultPos(): Pos {
  const phone = window.innerWidth < 768;
  return clampPos({
    x: window.innerWidth - PET_W - 16,
    y: window.innerHeight - PET_H - (phone ? 104 : 24),
  });
}

function readPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Pos>;
    if (typeof p.x !== "number" || typeof p.y !== "number" || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    return { x: p.x, y: p.y };
  } catch {
    return null;
  }
}

function savePos(p: Pos) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

/** Draggable Propellercat. The Ask button uses the same vehicle chat as the Chat page. Hidden there, where the full thread is already open. */
export function ChatPet({ vehicleId, vehicleName }: { vehicleId: string; vehicleName: string }) {
  const path = usePathname();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const posRef = useRef<Pos | null>(null);
  const dragRef = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<ChatMessageView | null>(null);
  const [resolving, setResolving] = useState(false);

  function place(next: Pos, save: boolean) {
    const p = clampPos(next);
    posRef.current = p;
    setPos(p);
    if (save) savePos(p);
  }

  useEffect(() => {
    const start = clampPos(readPos() ?? defaultPos());
    posRef.current = start;
    setPos(start);
    const onResize = () => {
      if (!posRef.current) return;
      const next = clampPos(posRef.current);
      posRef.current = next;
      setPos(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onDoc(e: globalThis.PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (path === "/chat" || !pos) return null;

  const sending = pending !== null;
  const spaceAbove = pos.y;
  const spaceBelow = window.innerHeight - pos.y - PET_H;
  const panelAbove = spaceAbove > spaceBelow;
  const alignEnd = pos.x + PET_W / 2 > window.innerWidth / 2;
  const panelMax = Math.min(384, Math.max(180, (panelAbove ? spaceAbove : spaceBelow) - 12));

  function onGripDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const origin = posRef.current;
    if (!origin) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: origin.x, oy: origin.y, moved: false };
  }

  function onGripMove(e: PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    setDragging(true);
    place({ x: d.ox + dx, y: d.oy + dy }, false);
  }

  function onGripUp(e: PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (d.moved && posRef.current) savePos(posRef.current);
  }

  function onGripKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 48 : 16;
    const cur = posRef.current;
    if (!cur) return;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    place({ x: cur.x + d[0], y: cur.y + d[1] }, true);
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || sending) return;
    setDraft("");
    setError(null);
    setPending(text);
    const res = await sendChatMessage(vehicleId, text).catch(() => null);
    setPending(null);
    if (res?.ok) setReply(res.data.reply);
    else {
      setDraft(text);
      setError(res?.error ?? "Couldn't reach BeCarful. Check your connection, then tap Retry.");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sending) void send(draft);
  }

  function onInputKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  async function resolve(approve: boolean) {
    if (!reply?.action || resolving) return;
    setResolving(true);
    setError(null);
    const res = await resolveChatAction(vehicleId, reply.id, approve).catch(() => null);
    setResolving(false);
    if (res?.ok) setReply(res.data);
    else setError(res?.error ?? "Couldn't reach BeCarful. Check your connection and try again.");
  }

  return (
    <div ref={rootRef} className="fixed z-50" style={{ left: pos.x, top: pos.y, width: PET_W }}>
      {open && (
        <section
          id={panelId}
          aria-label={`Ask ${ASSISTANT_NAME}`}
          style={{
            maxHeight: panelMax,
            left: alignEnd ? undefined : pos.x,
            right: alignEnd ? Math.max(8, window.innerWidth - (pos.x + PET_W)) : undefined,
            top: panelAbove ? undefined : pos.y + PET_H + 8,
            bottom: panelAbove ? window.innerHeight - pos.y + 8 : undefined,
          }}
          className="surface-card fixed z-50 flex w-[min(19rem,calc(100dvw-1rem))] flex-col overflow-hidden"
        >
          <header className="flex items-center gap-2 border-b border-border px-3 py-2">
            <p className="min-w-0 flex-1 truncate font-display text-base font-semibold text-ink">{ASSISTANT_NAME}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="grid size-11 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-panel-shade hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </header>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3 text-[15px] leading-relaxed text-ink">
            {pending && <p className="text-ink-soft">{pending}</p>}
            {sending && (
              <p className="flex items-center gap-1 text-ink-soft" role="status">
                <span className="size-1.5 animate-bounce rounded-full bg-ink-soft [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-ink-soft [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-ink-soft" />
                <span className="sr-only">{ASSISTANT_NAME} is typing</span>
              </p>
            )}
            {!pending && !reply && (
              <p>Hi! Ask me about your {vehicleName}: the policy, the damage, or what to do next.</p>
            )}
            {reply && <AssistantText text={reply.content} />}
            {reply?.action && reply.action.status === "pending" && (
              <div className="rounded-lg border border-border bg-panel-shade p-2">
                <p className="text-sm font-semibold">{reply.action.label}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <RetroButton type="button" disabled={resolving} onClick={() => void resolve(true)}>
                    {resolving ? "Working…" : "Confirm"}
                  </RetroButton>
                  <RetroButton type="button" variant="secondary" disabled={resolving} onClick={() => void resolve(false)}>
                    Cancel
                  </RetroButton>
                </div>
              </div>
            )}
            {reply?.action && reply.action.status !== "pending" && (
              <p className={`text-sm ${reply.action.status === "failed" ? "text-danger" : "text-ink-soft"}`} role="status">
                {reply.action.status === "failed" ? (reply.action.result ?? "Didn't work") : reply.action.status === "cancelled" ? "Cancelled" : "Done"}
              </p>
            )}
            {error && (
              <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-2.5 py-2">
                <p className="text-sm text-danger">{error}</p>
                {draft && (
                  <RetroButton type="button" variant="secondary" className="mt-2" onClick={() => void send(draft)}>
                    Retry
                  </RetroButton>
                )}
              </div>
            )}
            <TuxemonAttribution />
          </div>
          <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-border px-3 py-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Message {ASSISTANT_NAME}</span>
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onInputKey}
                rows={1}
                maxLength={MAX_LENGTH}
                placeholder={`Ask about your ${vehicleName}…`}
                enterKeyHint="send"
                className="field-input max-h-24 resize-none [field-sizing:content]"
              />
            </label>
            <RetroButton type="submit" disabled={!draft.trim() || sending} className="shrink-0 px-3">
              Send
            </RetroButton>
          </form>
          <p className="border-t border-border px-3 py-2 text-right">
            <Link href="/chat" className="text-xs font-semibold text-accent underline-offset-2 hover:underline">
              Open chat
            </Link>
          </p>
        </section>
      )}

      <div className="flex flex-col items-center">
        <div
          tabIndex={0}
          role="group"
          aria-label={`${ASSISTANT_NAME}. Drag to move, or press the arrow keys.`}
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          onPointerCancel={onGripUp}
          onKeyDown={onGripKey}
          className={`relative cursor-grab touch-none outline-none focus-visible:rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
            dragging ? "cursor-grabbing" : ""
          }`}
        >
          <div className={dragging ? "relative z-10" : "pet-bob relative z-10"}>
            {sending && (
              <span aria-hidden className="absolute -top-1 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-full border border-border bg-panel px-2 py-1 shadow-[0_6px_16px_rgb(0_0_0/0.12)]">
                <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-accent" />
              </span>
            )}
            <TuxemonAvatar frame="front" scale={2} decorative />
          </div>
          <span aria-hidden className="absolute bottom-1 left-1/2 h-2.5 w-14 -translate-x-1/2 rounded-full bg-ink/20 blur-[1px]" />
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className={`-mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold shadow-[0_8px_20px_rgb(0_0_0/0.16)] transition ${
            open ? "border-accent bg-accent text-accent-ink" : "border-border bg-panel text-ink hover:border-accent/50"
          }`}
        >
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 6.5h14v9H8.5L5 18.5v-12Z" />
            <path d="M8.5 10.5h7M8.5 13h4" />
          </svg>
          Ask
        </button>
      </div>
    </div>
  );
}
