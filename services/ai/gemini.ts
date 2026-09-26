import "server-only";
import { GoogleGenAI, type ContentListUnion } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";

let client: GoogleGenAI | undefined;
export const gemini = () => (client ??= new GoogleGenAI({ apiKey: env().GEMINI_API_KEY }));
export const geminiModel = () => env().GEMINI_MODEL;

function jsonSchemaFor(schema: z.ZodType) {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/** Structured output, validated with the same Zod schema before anyone trusts it. */
export async function generateJson<T extends z.ZodType>(opts: {
  schema: T;
  contents: ContentListUnion;
  system?: string;
}): Promise<z.infer<T>> {
  const res = await gemini().models.generateContent({
    model: geminiModel(),
    contents: opts.contents,
    config: {
      systemInstruction: opts.system,
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchemaFor(opts.schema),
      temperature: 0.2,
    },
  });
  return opts.schema.parse(JSON.parse(res.text ?? ""));
}
