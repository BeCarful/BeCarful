import { logout } from "@/actions/auth";
import { AssistantPicker } from "@/components/chat/AssistantPicker";
import { assistantById } from "@/components/chat/assistants";
import { PageHeader } from "@/components/layout/PageHeader";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { RetroBadge, RetroButton, RetroCard, RetroLinkButton } from "@/components/retro";
import { DeleteVehicleButton } from "@/components/vehicle/DeleteVehicleButton";
import { getVehicleContext, vehicleTitle } from "@/services/vehicles/context";

export default async function ProfilePage() {
  const { user, vehicles, selected } = await getVehicleContext();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader eyebrow="Account" title="Profile" />
      <RetroCard>
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full border border-border bg-gold-soft font-display text-2xl font-semibold text-gold">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{user.name}</p>
            <p className="truncate text-sm text-ink-soft">{user.email}</p>
          </div>
        </div>
      </RetroCard>
      <RetroCard title="Garage" action={<RetroLinkButton href="/vehicles/new" variant="secondary">+ Add vehicle</RetroLinkButton>}>
        {vehicles.length ? (
          <ul className="divide-y divide-border">
            {vehicles.map((v) => (
              <li key={v._id.toString()} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- pixel art scaled with nearest-neighbour */}
                <img src="/scenery/car.svg" alt="" width={48} height={22} className="pixelated shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{vehicleTitle(v)}</span>
                  <span className="block truncate text-sm text-ink-soft">
                    {v.color} · {v.licensePlate} ({v.state})
                  </span>
                </span>
                {selected?._id.equals(v._id) && <RetroBadge tone="ok">Selected</RetroBadge>}
                <DeleteVehicleButton vehicleId={v._id.toString()} title={vehicleTitle(v)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">No vehicles yet.</p>
        )}
      </RetroCard>
      <RetroCard title="Chat buddy">
        <p className="mb-3 text-sm text-ink-soft">Pick the Tuxemon that floats on your screens and answers your questions.</p>
        <AssistantPicker selectedId={assistantById(user.assistantId).id} />
      </RetroCard>
      <RetroCard title="Settings">
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-medium">Day / night</span>
            <span className="block text-sm text-ink-soft">Switch between the day and night scene.</span>
          </span>
          <ThemeToggle />
        </div>
      </RetroCard>
      <form action={logout}>
        <RetroButton type="submit" variant="danger" className="w-full">
          Log out
        </RetroButton>
      </form>
    </div>
  );
}
