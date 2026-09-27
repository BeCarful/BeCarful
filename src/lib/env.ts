import "server-only";
import { z } from "zod";

const EnvSchema = z.object({
  MONGODB_URI: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  GOOGLE_CLOUD_PROJECT: z.string().min(1),
  GCS_BUCKET_NAME: z.string().min(1),
  GCP_WORKLOAD_IDENTITY_PROVIDER: z.string().min(1).optional(),
  GCP_SERVICE_ACCOUNT_EMAIL: z.string().min(1).optional(),
  TYPESAFE_API_KEY: z.string().min(1).optional(),
  ELEVENLABS_API_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

// Validated lazily so `next build` works without secrets.
export function env(): Env {
  // Blank lines in .env files mean "unset", so optional values fall back to their defaults.
  const vars = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  return (cached ??= EnvSchema.parse(vars));
}
