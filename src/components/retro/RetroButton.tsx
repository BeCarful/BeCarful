import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink shadow-[inset_0_-3px_0_rgb(0_0_0/0.18)] hover:bg-accent-hover",
  secondary: "border border-border bg-panel text-ink hover:border-muted hover:bg-panel-shade",
  danger: "bg-danger text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.18)] hover:brightness-110 dark:text-[#1b0b0b]",
  ghost: "text-ink hover:bg-panel-shade",
};

export function retroButtonClass(variant: Variant = "primary", className = "") {
  return `inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-lg px-4 py-2 text-center text-base font-semibold leading-tight transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:active:translate-y-0 ${variants[variant]} ${className}`;
}

type Common = { variant?: Variant; icon?: ReactNode };

export function RetroButton({ variant, icon, className, children, ...rest }: ComponentProps<"button"> & Common) {
  return (
    <button className={retroButtonClass(variant, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function RetroLinkButton({ variant, icon, className, children, ...rest }: ComponentProps<typeof Link> & Common) {
  return (
    <Link className={retroButtonClass(variant, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
