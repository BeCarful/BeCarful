import { randomBytes } from "node:crypto";
import { sha256Hex } from "@/services/photos/seal";

export const hashShareToken = (token: string) => sha256Hex(token);

export function newShareToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashShareToken(token) };
}

export const isLive = (share: { expiresAt: Date }, now = new Date()) => share.expiresAt > now;
