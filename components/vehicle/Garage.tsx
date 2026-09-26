import type { ReactNode } from "react";

/** Top-down pixel parking bay. Day/night comes from the theme tokens. */
export function Garage({ badge, footer, children }: { badge?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label="Your car" className="surface-card overflow-hidden">
      <div className="pixel-scene [--horizon:60%]">
        {badge && <div className="absolute left-3 top-3 z-10">{badge}</div>}
        {children}
      </div>
      {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
    </section>
  );
}
