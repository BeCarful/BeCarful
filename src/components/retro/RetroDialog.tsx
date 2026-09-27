import type { ReactNode } from "react";

/** RPG-style text box (not a modal). */
export function RetroDialog({ speaker, avatar, children, className = "" }: { speaker?: string; avatar?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`surface-card relative flex gap-3 p-4 ${className}`}>
      {avatar && <div className="shrink-0">{avatar}</div>}
      <div className="min-w-0 flex-1">
        {speaker && <p className="mb-1 font-display text-sm font-semibold text-accent">{speaker}</p>}
        <div className="text-[15px] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
