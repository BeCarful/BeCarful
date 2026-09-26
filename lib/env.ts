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
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GOOGLE_GENAI_USE_VERTEXAI: z.stringbool().default(false),
  GOOGLE_CLOUD_PROJECT: z.string().min(1).optional(),
  GOOGLE_CLOUD_LOCATION: z.string().default("global"),
  TYPESAFE_API_KEY: z.string().min(1).optional(),
  JEV_MODEL: z.string().default("jev-latest"),
}).refine(
  (e) => (e.GOOGLE_GENAI_USE_VERTEXAI ? Boolean(e.GOOGLE_CLOUD_PROJECT) : Boolean(e.GEMINI_API_KEY)),
  "Set GEMINI_API_KEY, or GOOGLE_GENAI_USE_VERTEXAI=true with GOOGLE_CLOUD_PROJECT",
);

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

// Validated lazily so `next build` works without secrets.
export function env(): Env {
  // Blank lines in .env files mean "unset", so optional values fall back to their defaults.
  const vars = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  return (cached ??= EnvSchema.parse(vars));
}
