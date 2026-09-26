import { z } from "zod";

const optional = z
  .string()
  .trim()
  .transform((s) => s || undefined)
  .optional();

export const VehicleInputSchema = z.object({
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 2),
  make: z.string().trim().min(1, "Make is required").max(40),
  model: z.string().trim().min(1, "Model is required").max(40),
  trim: optional,
  color: z.string().trim().min(1, "Color is required").max(30),
  vin: optional.refine((v) => !v || /^[A-HJ-NPR-Z0-9]{17}$/i.test(v), "VIN must be 17 characters"),
  licensePlate: z.string().trim().min(1, "License plate is required").max(12),
  state: z.string().trim().length(2, "Use the 2-letter state code"),
});
export type VehicleInput = z.infer<typeof VehicleInputSchema>;
