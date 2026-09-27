import type { ReactNode } from "react";

export function PageHeader({ title, description, eyebrow, action }: { title: ReactNode; description?: ReactNode; eyebrow?: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-2 max-w-[65ch] text-base leading-relaxed text-ink">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}
