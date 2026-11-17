// utils/token.js
import { randomBytes, createHash } from "crypto";

const TOKEN_BYTES = 32;

/** Generate a raw token (to be sent in the email). */
export function generateRawToken() {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/** Hash a raw token for safe database storage. */
export function hashToken(rawToken) {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Compute the expiry date. */
export function getTokenExpiry() {
  const ms = Number(process.env.VERIFICATION_TOKEN_EXPIRES_IN_MS) || 3600000; // 1h
  return new Date(Date.now() + ms);
}