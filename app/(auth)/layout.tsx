import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { TuxemonAttribution, TuxemonAvatar } from "@/components/chat/TuxemonAssistant";
import { SceneBackground } from "@/components/layout/SceneBackground";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Wordmark } from "@/components/layout/Wordmark";
import { getCurrentUser } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="app-sky min-h-dvh">
      <SceneBackground />
      <ThemeToggle className="fixed top-4 right-4 z-10" />
      <main className="mx-auto grid min-h-dvh max-w-6xl items-center gap-8 px-4 py-10 sm:px-8 lg:grid-cols-2 lg:gap-16">
        <section className="flex flex-col gap-6">
          <Wordmark tagline />
          <div>
            <p className="eyebrow">Your car. Your policy. Your next step.</p>
            <p className="mt-3 font-display text-3xl leading-tight font-semibold tracking-tight text-ink sm:text-4xl">
              Had a bump?
              <br />
              We&apos;ll walk you through it.
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink">
              Snap the damage, understand your coverage, and get to your insurer&apos;s claim page with everything ready.
            </p>
          </div>
          <div className="pixel-scene hidden h-60 items-end rounded-xl pl-[5%] border border-border sm:flex">
            {/* eslint-disable-next-line @next/next/no-img-element -- pixel art scaled with nearest-neighbour */}
            <img src="/scenery/car.svg" alt="" width={384} height={176} className="pixelated mb-5 w-[58%] drop-shadow-[3px_5px_0_rgb(30_43_57/0.24)]" />
            <div className="pixel-frame absolute right-[6%] bottom-[18%] flex flex-col items-center px-2 py-1">
              <TuxemonAvatar frame="front" scale={1} />
              <span className="font-display text-sm font-semibold">Propellercat</span>
            </div>
          </div>
          <div className="-mt-4 hidden w-fit rounded-lg bg-panel/85 px-2 py-0.5 sm:block">
            <TuxemonAttribution />
          </div>
        </section>
        <section className="mx-auto w-full max-w-md">{children}</section>
      </main>
    </div>
  );
}
