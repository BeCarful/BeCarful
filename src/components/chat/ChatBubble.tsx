import type { ReactNode } from "react";
import { ASSISTANT_NAME, TuxemonFace } from "./TuxemonAssistant";

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

export function ChatBubble({ role, text, children }: { role: "user" | "assistant"; text?: string; children?: ReactNode }) {
  if (role === "assistant") {
    return (
      <div className="fade-in flex items-end gap-2 pr-6">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft">
          <TuxemonFace scale={1} />
        </span>
        <div className="min-w-0 max-w-[85%] rounded-2xl rounded-bl-sm bg-panel-shade px-3.5 py-2.5 text-[15px] leading-relaxed text-ink">
          <span className="sr-only">{ASSISTANT_NAME}: </span>
          {text !== undefined && <AssistantText text={text} />}
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="fade-in ml-10 flex flex-col items-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2.5 text-[15px] leading-relaxed text-accent-ink">
        <p className="whitespace-pre-wrap break-words">
          <span className="sr-only">You: </span>
          {text}
        </p>
      </div>
      {children}
    </div>
  );
}
