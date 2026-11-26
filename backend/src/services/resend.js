// services/resend.js
import { Resend } from "resend";

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

if (!resend) {
  console.warn(" RESEND_API_KEY is not set. Emails will not be sent.");
}