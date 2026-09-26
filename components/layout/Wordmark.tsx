import Link from "next/link";

const CAR = "M2 5h1V3h1V2h4v1h1v2h1v3H2z";

export function BrandMark({ className = "size-9" }: { className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl bg-brand-mark text-white ${className}`} aria-hidden>
      <svg viewBox="0 0 12 10" className="w-3/5" shapeRendering="crispEdges" fill="currentColor">
        <path d={CAR} />
        <path d="M3 8h2v1H3zM7 8h2v1H7z" />
        <path d="M4 3h1v2H4zM6 3h2v2H6z" className="fill-brand-mark" />
      </svg>
    </span>
  );
}

export function Wordmark({ tagline = false, className = "" }: { tagline?: boolean; className?: string }) {
  return (
    <Link href="/" className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <BrandMark />
      <span className="flex min-w-0 flex-col">
        <span className="font-display text-xl leading-none font-semibold tracking-tight text-ink">BeCarful</span>
        {tagline && <span className="mt-1 truncate text-xs text-ink-soft">Snap. Understand. Claim.</span>}
      </span>
    </Link>
  );
}
