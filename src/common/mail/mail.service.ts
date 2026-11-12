import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

const RESEND_FROM = 'Cloude <no-reply@dukancloude.com>';
const RESEND_TIMEOUT_MS = 15 * 1000;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter() {
    if (this.transporter) return this.transporter;
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) return null;

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
    return this.transporter;
  }

  // Render's free plan blocks outbound SMTP ports, so production mails go over HTTPS.
  private async sendViaResend(apiKey: string, mail: { to: string; subject: string; text: string; html: string }) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: RESEND_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Resend send failed (${res.status}): ${await res.text().catch(() => '')}`);
  }

  async sendOtpEmail(to: string, otp: string) {
    const subject = 'Your Cloude verification code';
    const text = `Your OTP is ${otp}. It expires in 10 minutes.`;
    const html = `<p>Your OTP is <b style="font-size:18px">${otp}</b>. It expires in 10 minutes.</p>`;
    await this.send(to, subject, text, html, `OTP for ${to} is ${otp}`);
  }

  async sendPasswordResetEmail(to: string, otp: string) {
    const subject = 'Reset your DukanCloude password';
    const text =
      `Your password reset code is ${otp}. It expires in 10 minutes.\n\n` +
      `If you didn't ask to reset your password, you can ignore this email — your password stays the same.`;
    const html =
      `<p>Your password reset code is <b style="font-size:18px">${otp}</b>. It expires in 10 minutes.</p>` +
      `<p style="color:#666">If you didn't ask to reset your password, you can ignore this email — your password stays the same.</p>`;
    await this.send(to, subject, text, html, `Password reset code for ${to} is ${otp}`);
  }

  /** Resend in production, Gmail SMTP locally, or just a log line when neither is configured. */
  private async send(to: string, subject: string, text: string, html: string, devLog: string) {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      await this.sendViaResend(resendKey, { to, subject, text, html });
      return;
    }

    const transporter = this.getTransporter();
    if (!transporter) {
      // No Gmail credentials configured (e.g. local dev) — log instead of failing signup.
      this.logger.warn(`GMAIL_USER/GMAIL_APP_PASSWORD not set — ${devLog}`);
      return;
    }

    const from = process.env.GMAIL_USER;
    await transporter.sendMail({ from: `"Cloude" <${from}>`, to, subject, text, html });
  }
}
