import { RetroButton } from "@/components/retro";
import { DamageList } from "@/components/vehicle/SeverityBadge";
import type { DamageAnalysis } from "@/schemas/damage";
import type { PhotoIssue } from "@/types";

export const RETAKE_HINT = "Take a clear, well-lit photo from 1–2 m away that shows the whole damaged panel.";

const ISSUE_TEXT: Record<PhotoIssue, string> = {
  unreadable: "We couldn't read this file as a photo.",
  low_resolution: "This photo is low resolution.",
  too_dark: "This photo is too dark.",
  too_bright: "This photo is overexposed.",
  possibly_blurry: "This photo looks blurry.",
};

export function AnalysisSummary({
  analysis,
  failed,
  onRetry,
  retrying,
}: {
  analysis: DamageAnalysis | null;
  failed: boolean;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  if (retrying) return <p className="animate-pulse text-sm">Analyzing this photo…</p>;
  if (failed || !analysis) {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          {failed ? "Photo saved, but we couldn't analyze it. Try again in a moment." : "Analyzing this photo…"}
        </p>
        {failed && onRetry && (
          <RetroButton type="button" variant="secondary" onClick={onRetry} className="w-full">
            Retry analysis
          </RetroButton>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {analysis.summary && <p className="text-sm leading-relaxed">{analysis.summary}</p>}
      {analysis.needsManualReview && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm">
          {analysis.photoIssues.length > 0
            ? analysis.photoIssues.map((i) => ISSUE_TEXT[i]).join(" ")
            : "We couldn't confidently identify damage here."}{" "}
          {RETAKE_HINT}
        </p>
      )}
      {analysis.damagedComponents.length > 0 ? (
        <DamageList items={analysis.damagedComponents} />
      ) : (
        !analysis.needsManualReview && <p className="text-sm text-ink-soft">No visible damage found. If you can see damage, take a close-up of it.</p>
      )}
    </div>
  );
}
