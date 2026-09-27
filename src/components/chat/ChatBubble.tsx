import type { ReactNode } from "react";
import type { Assistant } from "./assistants";
import { TuxemonFace } from "./TuxemonAssistant";

/** Plain text only: paragraphs plus "- " bullet lists. Never renders HTML from the model. */
export function AssistantText({ text }: { text: string }) {
  const lines = text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={blocks.length} className="list-disc space-y-1 pl-5">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  for (const line of lines) {
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (bullet) bullets.push(bullet[1]);
    else {
      flush();
      blocks.push(<p key={blocks.length}>{line}</p>);
    }
  }
  flush();
  return <div className="space-y-2 break-words">{blocks}</div>;
}

export function ChatBubble({
  role,
  text,
  assistant,
  compact = false,
  children,
}: {
  role: "user" | "assistant";
  text?: string;
  assistant: Assistant;
  compact?: boolean;
  children?: ReactNode;
}) {
  const size = compact ? "px-3 py-2 text-sm" : "px-3.5 py-2.5 text-[15px]";
  if (role === "assistant") {
    return (
      <div className={`fade-in flex items-end gap-2 ${compact ? "" : "pr-6"}`}>
        {!compact && (
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft">
            <TuxemonFace scale={1} assistant={assistant} />
          </span>
        )}
        <div className={`min-w-0 rounded-2xl rounded-bl-sm bg-panel-shade leading-relaxed text-ink ${compact ? "max-w-[90%]" : "max-w-[85%]"} ${size}`}>
          <span className="sr-only">{assistant.name}: </span>
          {text !== undefined && <AssistantText text={text} />}
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className={`fade-in flex flex-col items-end ${compact ? "ml-6" : "ml-10"}`}>
      <div className={`max-w-[85%] rounded-2xl rounded-br-sm bg-accent leading-relaxed text-accent-ink ${size}`}>
        <p className="whitespace-pre-wrap break-words">
          <span className="sr-only">You: </span>
          {text}
        </p>
      </div>
      {children}
    </div>
  );
}

export function TypingBubble({ assistant, compact }: { assistant: Assistant; compact?: boolean }) {
  return (
    <ChatBubble role="assistant" assistant={assistant} compact={compact}>
      <span className="flex gap-1 py-1.5" aria-hidden>
        <span className="size-2 animate-bounce rounded-full bg-ink-soft [animation-delay:-0.3s]" />
        <span className="size-2 animate-bounce rounded-full bg-ink-soft [animation-delay:-0.15s]" />
        <span className="size-2 animate-bounce rounded-full bg-ink-soft" />
      </span>
      <span className="sr-only">{assistant.name} is typing…</span>
    </ChatBubble>
  );
}
