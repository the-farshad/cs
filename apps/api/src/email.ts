/** Magic-link delivery. Uses SMTP when configured, otherwise dev mode. */
import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? 'cs.thefarshad.com <no-reply@thefarshad.com>';

/** SMTP is "configured" once a host is provided. */
export function smtpConfigured(): boolean {
  return Boolean(SMTP_HOST);
}

// Lazily build a single reusable transport.
let transport: nodemailer.Transporter | null = null;
function getTransport(): nodemailer.Transporter {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }
  return transport;
}

/**
 * Send the magic sign-in link to `email`. No-op when SMTP is not configured —
 * callers should check `smtpConfigured()` and surface a `devLink` instead.
 */
export async function sendMagicLink(email: string, link: string): Promise<void> {
  if (!smtpConfigured()) return;
  await getTransport().sendMail({
    from: SMTP_FROM,
    to: email,
    subject: 'Your cs.thefarshad.com sign-in link',
    text: `Click to sign in (valid for 15 minutes):\n\n${link}\n\nIf you didn't request this, you can ignore this email.`,
    html:
      `<p>Click to sign in (valid for 15 minutes):</p>` +
      `<p><a href="${link}">Sign in to cs.thefarshad.com</a></p>` +
      `<p>If you didn't request this, you can ignore this email.</p>`,
  });
}
