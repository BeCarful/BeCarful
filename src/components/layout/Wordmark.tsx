import Image from "next/image";
import Link from "next/link";

const CAR = "M2 5h1V3h1V2h4v1h1v2h1v3H2z";

/** Pixel car in currentColor; `windows` paints the window cut-outs in that fill class. */
export function PixelCar({ className, windows }: { className: string; windows: string }) {
  return (
    <svg viewBox="0 0 12 10" className={className} shapeRendering="crispEdges" fill="currentColor" aria-hidden>
      <path d={CAR} />
      <path d="M3 8h2v1H3zM7 8h2v1H7z" />
      <path d="M4 3h1v2H4zM6 3h2v2H6z" className={windows} />
    </svg>
  );
}

export function BrandMark({ className = "size-9" }: { className?: string }) {
  return <Image src="/becarful-logo.png" alt="" width={72} height={72} loading="eager" className={`shrink-0 rounded-xl ${className}`} />;
}

export function Wordmark({ tagline = false, className = "" }: { tagline?: boolean; className?: string }) {
  return (
    <Link href="/" className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <BrandMark />
      <span className="flex min-w-0 flex-col">
        <span className="font-display text-xl leading-none font-semibold tracking-tight text-ink">BeCarful</span>
        {tagline && <span className="mt-1 truncate text-xs text-ink-soft">careful with your car</span>}
      </span>
    </Link>
  );
}
