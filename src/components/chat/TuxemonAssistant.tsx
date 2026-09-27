import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { PerilMonster } from "@/components/insurance/peril-monsters";
import { DEFAULT_ASSISTANT, type Assistant } from "./assistants";

// Unmodified 128x88 Tuxemon sheet: front frame 64x64 at (0,0), menu frames 24x24 at (0,64) and (24,64).
const FRAMES = { front: { size: 64, x: 0, y: 0 }, icon: { size: 24, x: 0, y: 64 }, icon2: { size: 24, x: 24, y: 64 } } as const;

/** Integer scales only, so the pixel art stays crisp. */
export function TuxemonAvatar({
  frame = "icon",
  scale = 2,
  decorative = false,
  className = "",
  sheet = DEFAULT_ASSISTANT.sheet,
  label = DEFAULT_ASSISTANT.name,
}: {
  frame?: keyof typeof FRAMES;
  scale?: 1 | 2 | 3;
  decorative?: boolean;
  className?: string;
  sheet?: string;
  label?: string;
}) {
  const { size, x, y } = FRAMES[frame];
  const front = frame === "front";
  const box = { width: size * scale, height: size * scale };
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      className={`pixelated inline-block shrink-0 bg-no-repeat ${front ? "tux-front" : ""} ${className}`}
      style={
        front
          ? ({ ...box, "--tux-sheet": `url(${sheet})`, "--tux-idle": `url(${sheet.replace(/-sheet\.png$/, "-idle.png")})` } as CSSProperties)
          : {
              ...box,
              backgroundImage: `url(${sheet})`,
              backgroundSize: `${128 * scale}px ${88 * scale}px`,
              backgroundPosition: `-${x * scale}px -${y * scale}px`,
            }
      }
    />
  );
}

/** The sheet's two menu frames alternating; reduced motion keeps the first. */
export function TuxemonFace({ scale = 2, className = "", assistant = DEFAULT_ASSISTANT }: { scale?: 1 | 2 | 3; className?: string; assistant?: Assistant }) {
  return (
    <span role="img" aria-label={assistant.name} className={`relative inline-block shrink-0 ${className}`} style={{ width: 24 * scale, height: 24 * scale }}>
      <TuxemonAvatar frame="icon" scale={scale} sheet={assistant.sheet} decorative className="face-a absolute inset-0" />
      <TuxemonAvatar frame="icon2" scale={scale} sheet={assistant.sheet} decorative className="face-b absolute inset-0" />
    </span>
  );
}

export function TuxemonAssistant({ assistant = DEFAULT_ASSISTANT, children }: { assistant?: Assistant; children?: ReactNode }) {
  return (
    <div className="surface-card flex items-center gap-3 p-4">
      <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent-soft">
        <TuxemonFace assistant={assistant} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-semibold text-ink">{assistant.name}</p>
        {children && <div className="text-sm text-ink-soft">{children}</div>}
        <TuxemonAttribution monsters={[assistant]} />
      </div>
    </div>
  );
}

export function TuxemonAttribution({ monsters = [DEFAULT_ASSISTANT], className = "mt-1" }: { monsters?: PerilMonster[]; className?: string }) {
  const link = "underline decoration-dotted underline-offset-2 hover:text-accent";
  return (
    <p className={`${className} text-[11px] leading-snug text-ink-soft`}>
      {monsters.length > 1 ? "Sprites" : "Sprite"} from Tuxemon, animated by BeCarful:{" "}
      {monsters.map((m, i) => (
        <Fragment key={m.name}>
          {i > 0 && ", "}
          {m.name} by{" "}
          <a className={link} href={m.authorUrl} target="_blank" rel="noopener noreferrer">
            {m.author}
          </a>{" "}
          (
          <a className={link} href={m.licenseUrl} target="_blank" rel="noopener noreferrer">
            {m.license}
          </a>
          )
        </Fragment>
      ))}
      .{" "}
      <a className={link} href="/tuxemon/ATTRIBUTION.md" target="_blank" rel="noopener">
        Full credits
      </a>
    </p>
  );
}
