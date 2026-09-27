import Link from "next/link";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { SceneBackground } from "@/components/layout/SceneBackground";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { VehicleMenu } from "@/components/layout/VehicleSelector";
import { BrandMark } from "@/components/layout/Wordmark";
import { RetroLinkButton } from "@/components/retro";
import { getVehicleContext, vehicleTitle } from "@/services/vehicles/context";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, vehicles, selected } = await getVehicleContext();
  const options = vehicles.map((v) => ({ id: v._id.toString(), title: vehicleTitle(v) }));
  const selectedId = selected?._id.toString() ?? null;
  return (
    <div className="app-sky min-h-dvh md:pl-60">
      <SceneBackground />
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <AppSidebar email={user.email} vehicles={options} selectedId={selectedId} />
      <header className="sticky top-0 z-20 border-b border-border bg-panel/75 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
        <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center gap-3 px-4 py-2 sm:px-6 md:px-8">
          <Link href="/" aria-label="BeCarful home">
            <BrandMark />
          </Link>
          <div className="flex flex-1 justify-center">
            <RetroLinkButton href="/crash" variant="danger" className="px-3 text-sm">
              Crash mode
            </RetroLinkButton>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/profile"
              aria-label="Profile"
              className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-gold-soft font-display text-lg font-semibold text-gold"
            >
              {user.name.charAt(0).toUpperCase()}
            </Link>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 pt-6 pb-28 outline-none sm:px-6 md:px-8 md:pb-16">
        {children}
      </main>
      <BottomNav />
      <VehicleMenu vehicles={options} selectedId={selectedId} />
    </div>
  );
}
