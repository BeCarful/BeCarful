import "server-only";
import { z } from "zod";

const EnvSchema = z.object({
  MONGODB_URI: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_NAME: z.string().min(1),
  S3_ENDPOINT: z.string().url().optional(),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

// Validated lazily so `next build` works without secrets.
export function env(): Env {
  // Blank lines in .env files mean "unset", so optional values fall back to their defaults.
  const vars = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  return (cached ??= EnvSchema.parse(vars));
}
