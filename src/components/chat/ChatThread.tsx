"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { resolveChatAction, transcribeSpeech } from "@/actions/chat";
import { selectVehicle } from "@/actions/vehicles";
import { CAR_ICON, NavIcon } from "@/components/layout/BottomNav";
import { RetroBadge, RetroButton, retroInputClass } from "@/components/retro";
import type { ChatMessageView, ChatSubject } from "@/services/ai/chat";
import { ChatBubble, TypingBubble } from "./ChatBubble";
import type { Assistant } from "./assistants";
import { TuxemonAttribution, TuxemonAvatar, TuxemonFace } from "./TuxemonAssistant";
import { streamChat } from "./stream";
import { useVoice } from "./useVoice";

type Topic = "car" | "insurance";

function suggestions(topic: Topic, insurer: string | null) {
  return topic === "insurance"
    ? [
        `What does ${insurer ?? "my insurance"} cover?`,
        "What's my deductible?",
        "Is my damage covered?",
        "What isn't covered?",
        "Does my policy cover a rental car?",
        "How do I file a claim?",
      ]
    : [
        "Which parts look damaged?",
        "Do I need more photos?",
        "What should I do next?",
        "Summarize everything that happened.",
        "What does my insurance cover?",
        "Where do I file my claim?",
      ];
}

const MAX_LENGTH = 1000;
const SHIELD_ICON = ["M12 3 5 6v5c0 4.5 3 8.4 7 10 4-1.6 7-5.5 7-10V6l-7-3Z"];
const MIC_ICON = ["M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z", "M6 11a6 6 0 0 0 12 0", "M12 17v4"];
const STOP_ICON = ["M7 7h10v10H7z"];
const SPEAKER_ICON = ["M4 9v6h4l5 4V5L8 9H4Z", "M16.5 8.5a5 5 0 0 1 0 7"];

type Outbox = { text: string; error: string | null };

const ACTION_DONE = { done: "Done", failed: "Didn't work", cancelled: "Cancelled", running: "Working…", pending: "" } as const;

/** A write the agent proposed. Nothing changes until the user taps Confirm. */
export function ActionCard({ vehicleId, message, onUpdate }: { vehicleId: string; message: ChatMessageView; onUpdate: (m: ChatMessageView) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = message.action!;

  async function resolve(approve: boolean) {
    setBusy(true);
    setError(null);
    const res = await resolveChatAction(vehicleId, message.id, approve).catch(() => null);
    setBusy(false);
    if (res?.ok) onUpdate(res.data);
    else setError(res?.error ?? "Couldn't reach BeCarful. Check your connection and try again.");
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-panel p-3">
      <p className="text-sm font-semibold text-ink">{action.label}</p>
      {action.status === "pending" ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <RetroButton type="button" disabled={busy} onClick={() => resolve(true)}>
            {busy ? "Working…" : "Confirm"}
          </RetroButton>
          <RetroButton type="button" variant="secondary" disabled={busy} onClick={() => resolve(false)}>
            Cancel
          </RetroButton>
        </div>
      ) : (
        <p className={`mt-1 text-sm ${action.status === "failed" ? "text-danger" : "text-ink-soft"}`} role="status">
          {action.status === "failed" ? (action.result ?? ACTION_DONE.failed) : ACTION_DONE[action.status]}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function SubjectChip({
  selected,
  icon,
  label,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  icon: readonly string[];
  label?: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-11 max-w-56 items-center gap-1.5 px-3 text-sm font-medium transition disabled:opacity-55 ${selected ? "bg-accent text-accent-ink" : "bg-panel text-ink hover:bg-accent-soft"}`}
    >
      <NavIcon paths={icon} active={selected} />
      <span className="truncate">{children}</span>
    </button>
  );
}

type Props = {
  vehicleId: string;
  assistant: Assistant;
  subjects: ChatSubject[];
  voice: boolean;
};

export function Chat({ messages, ...props }: Props & { messages: ChatMessageView[] }) {
  const [topic, setTopic] = useState<Topic>("car");
  const [switching, startTransition] = useTransition();

  function choose(id: string, next: Topic) {
    setTopic(next);
    if (id !== props.vehicleId) startTransition(() => selectVehicle(id));
  }

  return <ChatThread key={props.vehicleId} {...props} initialMessages={messages} topic={topic} switching={switching} onChoose={choose} />;
}

/** Mount with key={vehicleId}: all state here belongs to one vehicle's thread. */
function ChatThread({
  vehicleId,
  assistant,
  subjects,
  voice,
  initialMessages,
  topic,
  switching,
  onChoose,
}: Props & { initialMessages: ChatMessageView[]; topic: Topic; switching: boolean; onChoose: (vehicleId: string, topic: Topic) => void }) {
  const unanswered = initialMessages.at(-1)?.role === "user" ? initialMessages.at(-1) : undefined;
  const [messages, setMessages] = useState(() => (unanswered ? initialMessages.slice(0, -1) : initialMessages));
  const [outbox, setOutbox] = useState<Outbox | null>(unanswered ? { text: unanswered.content, error: "I haven't replied to this yet. Tap Retry to ask again." } : null);
  const [draft, setDraft] = useState("");
  const [streamed, setStreamed] = useState("");
  const [hearing, setHearing] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const speech = useVoice();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  const subject = subjects.find((s) => s.id === vehicleId) ?? { id: vehicleId, title: "car", insurer: null };
  const about = topic === "insurance" && subject.insurer ? `${subject.insurer} policy` : subject.title;
  const questions = suggestions(topic, subject.insurer);
  const choosable = subjects.length > 1 || subjects.some((s) => s.insurer);
  const chips = [subject, ...subjects.filter((s) => s.id !== vehicleId)];

  useEffect(() => {
    if (!messages.length && !outbox) return;
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: scrolled.current ? "smooth" : "instant" });
    scrolled.current = true;
  }, [messages, outbox]);

  const sending = outbox !== null && outbox.error === null;
  const busy = sending || hearing || speech.recording;

  async function send(raw: string, spoken = false) {
    const text = raw.trim();
    if (!text || sending) return;
    setVoiceNote(null);
    setOutbox({ text, error: null });
    setStreamed("");
    setDraft((d) => (d.trim() === text ? "" : d));
    const res = await streamChat(vehicleId, text, setStreamed);
    setStreamed("");
    if (res.ok) {
      const stale = (x: ChatMessageView): ChatMessageView => (x.action?.status === "pending" ? { ...x, action: { ...x.action, status: "cancelled" } } : x);
      setMessages((m) => [...m.map(stale), res.data.user, res.data.reply]);
      setOutbox(null);
      if (spoken) speech.play(res.data.reply.id, assistant.id);
      if (res.data.navigate) router.push(res.data.navigate);
    } else {
      setOutbox({ text, error: res.error });
    }
  }

  async function talk() {
    if (speech.recording) return speech.stop();
    setVoiceNote(null);
    const error = await speech.record(async (audio) => {
      if (!audio) return setVoiceNote("I didn't hear anything. Tap the mic and try again.");
      setHearing(true);
      const form = new FormData();
      form.append("audio", audio);
      const res = await transcribeSpeech(form).catch(() => null);
      setHearing(false);
      if (res?.ok) send(res.data, true);
      else setVoiceNote(res?.error ?? "Couldn't reach BeCarful. Check your connection and try again.");
    });
    if (error) setVoiceNote(error);
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
  const voiceStatus = speech.recording ? "Listening… I'll send it when you pause, or tap ■." : hearing ? "Got it, writing that down…" : (voiceNote ?? speech.playError);
  return (
    <section className="surface-card mx-auto -mb-8 flex h-[calc(100dvh-10.625rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-[26rem] max-w-3xl flex-col overflow-hidden md:-mb-10 md:h-[calc(100dvh-7.25rem)]">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft">
          <TuxemonFace assistant={assistant} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg leading-tight font-semibold text-ink">{assistant.name}</h1>
          <p className="truncate text-xs text-ink-soft">Chatting about your {about}</p>
        </div>
        <RetroBadge tone="accent" className="max-w-[45%] truncate max-sm:hidden">
          <span className="truncate">{subject.title}</span>
        </RetroBadge>
      </header>

      <div
        ref={logRef}
        role="log"
        aria-label={`Chat about ${subject.title}`}
        className={`flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 transition ${switching ? "opacity-50" : ""}`}
      >
        {empty && (
          <div className="mx-auto max-w-lg py-4 text-center">
            <TuxemonAvatar frame="front" scale={2} sheet={assistant.sheet} label={assistant.name} className="tux-wild mx-auto" />
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink">
              Hi! I&apos;m {assistant.name}.{" "}
              {topic === "insurance" && subject.insurer
                ? `Ask me about your ${subject.insurer} policy for the ${subject.title}: coverage, deductibles or filing a claim.`
                : `Ask me anything about your ${subject.title}: your policy, the damage, or how to file a claim.`}
            </p>
            {voice && (
              <RetroButton type="button" onClick={talk} disabled={busy && !speech.recording} className="mt-4" icon={<NavIcon paths={speech.recording ? STOP_ICON : MIC_ICON} active />}>
                {speech.recording ? "Stop and send" : "Tap to talk"}
              </RetroButton>
            )}
          </div>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} role={m.role} text={m.content} assistant={assistant}>
            {voice && m.role === "assistant" && (
              <button
                type="button"
                onClick={() => (speech.playing === m.id ? speech.stopPlaying() : speech.play(m.id, assistant.id))}
                className="-mb-2 flex min-h-11 items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                <NavIcon paths={speech.playing === m.id ? STOP_ICON : SPEAKER_ICON} active={false} />
                {speech.playing === m.id ? "Stop" : "Listen"}
              </button>
            )}
            {m.action && (
              <ActionCard vehicleId={vehicleId} message={m} onUpdate={(next) => setMessages((all) => all.map((x) => (x.id === next.id ? next : x)))} />
            )}
          </ChatBubble>
        ))}
        {outbox && (
          <ChatBubble role="user" text={outbox.text} assistant={assistant}>
            {outbox.error && <span className="mt-1 text-xs font-medium text-ink-soft">Not answered yet</span>}
          </ChatBubble>
        )}
        {sending && (streamed ? <ChatBubble role="assistant" text={streamed} assistant={assistant} talking /> : <TypingBubble assistant={assistant} />)}
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
            {questions.map((q) => (
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
            {questions.map((q) => (
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
        {choosable && (
          <div
            role="group"
            aria-label="Chat about"
            aria-busy={switching || undefined}
            className={`-mx-3 mb-2 flex items-center gap-2 overflow-x-auto px-3 pb-1 ${switching ? "animate-pulse" : ""}`}
          >
            <span className="shrink-0 text-xs font-semibold text-ink-soft">About</span>
            {chips.map((s) => (
              <div key={s.id} className="flex shrink-0 divide-x divide-border overflow-hidden rounded-full border border-border">
                <SubjectChip selected={s.id === vehicleId && topic === "car"} icon={CAR_ICON} disabled={busy || switching} onClick={() => onChoose(s.id, "car")}>
                  {s.title}
                </SubjectChip>
                {s.insurer && (
                  <SubjectChip
                    selected={s.id === vehicleId && topic === "insurance"}
                    icon={SHIELD_ICON}
                    label={`${s.insurer} policy for the ${s.title}`}
                    disabled={busy || switching}
                    onClick={() => onChoose(s.id, "insurance")}
                  >
                    {s.insurer}
                  </SubjectChip>
                )}
              </div>
            ))}
          </div>
        )}
        {voiceStatus && (
          <p role="status" className={`mb-2 flex items-center gap-2 text-sm ${busy ? "text-ink-soft" : "text-danger"}`}>
            {speech.recording && <span aria-hidden className="pulse-ring size-2.5 shrink-0 rounded-full bg-danger" />}
            {voiceStatus}
          </p>
        )}
        <form ref={formRef} onSubmit={onSubmit} className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Message {assistant.name}</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={MAX_LENGTH}
              placeholder={`Message ${assistant.name}…`}
              enterKeyHint="send"
              className={`${retroInputClass} max-h-36 resize-none [field-sizing:content]`}
            />
          </label>
          {voice && (
            <RetroButton
              type="button"
              variant={speech.recording ? "danger" : "secondary"}
              onClick={talk}
              disabled={!speech.recording && (busy || outbox !== null)}
              aria-label={speech.recording ? "Stop and send" : `Talk to ${assistant.name}`}
              className={`px-3 ${speech.recording ? "pulse-ring" : ""}`}
            >
              <NavIcon paths={speech.recording ? STOP_ICON : MIC_ICON} active />
            </RetroButton>
          )}
          <RetroButton type="submit" disabled={!draft.trim() || outbox !== null || speech.recording || hearing}>
            Send
          </RetroButton>
        </form>
        <TuxemonAttribution monsters={[assistant]} />
      </div>
    </section>
  );
}
