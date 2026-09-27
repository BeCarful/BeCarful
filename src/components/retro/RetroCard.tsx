import type { ComponentProps, ReactNode } from "react";

export function RetroCard({ title, action, className = "", children, ...rest }: Omit<ComponentProps<"section">, "title"> & { title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`surface-card p-5 ${className}`} {...rest}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
