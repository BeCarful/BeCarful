import { PageHeader } from "@/components/layout/PageHeader";
import { VehicleForm } from "@/components/layout/VehicleForm";

export const maxDuration = 60;

export default function NewVehiclePage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Garage" title="Add a vehicle" description="Each vehicle keeps its own photos, insurance, chat and claim." />
      <VehicleForm />
    </div>
  );
}
