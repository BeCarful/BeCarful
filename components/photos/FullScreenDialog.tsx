"use client";

import type { ReactNode } from "react";

/** Native modal <dialog>: focus trap, Escape and inert background for free. */
export function FullScreenDialog({
  label,
  onClose,
  canClose = true,
  onKeyDown,
  children,
}: {
  label: string;
  onClose: () => void;
  canClose?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDialogElement>) => void;
  children: ReactNode;
}) {
  return (
    <dialog
      ref={(el) => {
        if (el && !el.open) el.showModal();
      }}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        if (canClose) onClose();
      }}
      onKeyDown={onKeyDown}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col overflow-hidden overscroll-contain border-0 bg-neutral-950 p-0 text-white backdrop:bg-black/80 open:flex"
    >
      {children}
    </dialog>
  );
}

export function CloseButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Close"
      className="grid size-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}

export const SHEET_CLASS =
  "mx-auto w-full max-w-lg overflow-y-auto rounded-t-2xl bg-panel p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-[0_-8px_24px_rgb(0_0_0/0.35)] md:mb-6 md:rounded-2xl md:pb-5";
