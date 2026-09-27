"use client";

import { useState, useTransition, type FormEvent } from "react";
import { unstable_rethrow } from "next/navigation";
import { createShareLink, stopShareLink } from "@/actions/share";
import { RetroButton, RetroField, retroButtonClass } from "@/components/retro";
import { SHARE_DAYS } from "@/types";
import { ActionButton } from "./ActionButton";
import { LocalTime } from "./LocalTime";

type Link = { id: string; label: string | null; expiresAt: string; openCount: number };

export function ShareEvidence({ vehicleId, vehicleTitle, links }: { vehicleId: string; vehicleTitle: string; links: Link[] }) {
  const [label, setLabel] = useState("");
  const [days, setDays] = useState<(typeof SHARE_DAYS)[number]>(7);
  const [newLink, setNewLink] = useState<{ id: string; url: string; expiresAt: string } | null>(null);
  const created = newLink && links.some((l) => l.id === newLink.id) ? newLink : null;
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      try {
        const res = await createShareLink(vehicleId, { label, days });
        if (!res.ok) return setError(res.error);
        setError(null);
        setLabel("");
        setCopied(false);
        setNewLink({ id: res.data.id, url: `${window.location.origin}/share/${res.data.token}`, expiresAt: res.data.expiresAt });
      } catch (err) {
        unstable_rethrow(err);
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  const message = created
    ? `Photos and details of what happened to my ${vehicleTitle}:\n${created.url}\n\nThe link works until ${new Date(created.expiresAt).toLocaleString()}.`
    : "";

  return (
    <>
      {created ? (
        <div className="space-y-3 rounded-lg bg-panel-shade p-4">
          <p className="font-semibold text-ink">Your link is ready</p>
          <input
            readOnly
            aria-label="Share link"
            value={created.url}
            onFocus={(e) => e.target.select()}
            className="field-input font-mono text-sm"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            {typeof navigator.share === "function" && (
              <RetroButton type="button" onClick={() => navigator.share({ title: `Evidence: ${vehicleTitle}`, text: message }).catch(() => {})}>
                Share…
              </RetroButton>
            )}
            <RetroButton
              type="button"
              variant="secondary"
              onClick={() =>
                navigator.clipboard.writeText(created.url).then(
                  () => setCopied(true),
                  () => setError("Couldn't copy. Select the link and copy it."),
                )
              }
            >
              {copied ? "Copied ✓" : "Copy link"}
            </RetroButton>
            <a
              href={`mailto:?subject=${encodeURIComponent(`Evidence: ${vehicleTitle}`)}&body=${encodeURIComponent(message)}`}
              className={retroButtonClass("secondary")}
            >
              Email
            </a>
          </div>
          <p className="text-sm text-ink-soft">Send it now. For your privacy, BeCarful shows each link only once.</p>
          <RetroButton type="button" variant="ghost" onClick={() => setNewLink(null)} className="w-full">
            Done
          </RetroButton>
        </div>
      ) : (
        <form onSubmit={create} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <RetroField
              label="Who's it for? (optional)"
              placeholder="State Farm adjuster"
              maxLength={80}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <label className="block">
              <span className="field-label">Link works for</span>
              <select className="field-select" value={days} onChange={(e) => setDays(Number(e.target.value) as typeof days)}>
                {SHARE_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d === 1 ? "1 day" : `${d} days`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <RetroButton type="submit" disabled={pending} className="w-full">
            {pending ? "Creating…" : "Create link"}
          </RetroButton>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      {links.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-1 text-sm font-semibold text-ink">Active links</p>
          <ul className="divide-y divide-border">
            {links.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium text-ink">{l.label || "Share link"}</p>
                  <p className="text-ink-soft">
                    Until <LocalTime iso={l.expiresAt} /> · {l.openCount === 0 ? "Not opened yet" : `Opened ${l.openCount}×`}
                  </p>
                </div>
                <div className="shrink-0">
                  <ActionButton action={stopShareLink.bind(null, vehicleId, l.id)} variant="secondary">
                    Stop sharing
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-soft">Mail apps that preview links can count as opens.</p>
        </div>
      )}
    </>
  );
}
