// utils/verificationCode.js
import bcrypt from "bcrypt";
import { randomInt } from "crypto";

const BCRYPT_COST = 10;
const MAX_ATTEMPTS = 5;

/** Generate a 6-digit numeric code (zero-padded, e.g. "042918"). */
export function generateVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Hash the code for safe storage (bcrypt, not SHA-256 — see §A). */
export function hashCode(code) {
  return bcrypt.hash(code, BCRYPT_COST);
}

/** Constant-time comparison of a submitted code against a stored hash. */
export function verifyCodeHash(code, hash) {
  return bcrypt.compare(code, hash);
}

/** Expiry timestamp (default 10 minutes). */
export function getCodeExpiry() {
  const ms = Number(process.env.VERIFICATION_CODE_EXPIRES_IN_MS) || 600_000;
  return new Date(Date.now() + ms);
}

export const MAX_VERIFICATION_ATTEMPTS = MAX_ATTEMPTS;