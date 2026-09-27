import "server-only";
import mongoose from "mongoose";
import { env } from "./env";

const g = globalThis as unknown as { mongoosePromise?: Promise<typeof mongoose> };

export function connectDB(): Promise<typeof mongoose> {
  g.mongoosePromise ??= mongoose.connect(env().MONGODB_URI).catch((err) => {
    g.mongoosePromise = undefined;
    throw err;
  });
  return g.mongoosePromise;
}
