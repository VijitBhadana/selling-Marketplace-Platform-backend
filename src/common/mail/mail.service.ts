import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

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

  async sendOtpEmail(to: string, otp: string) {
    const transporter = this.getTransporter();
    if (!transporter) {
      // No Gmail credentials configured (e.g. local dev) — log instead of failing signup.
      this.logger.warn(`GMAIL_USER/GMAIL_APP_PASSWORD not set — OTP for ${to} is ${otp}`);
      return;
    }

    const from = process.env.GMAIL_USER;
    await transporter.sendMail({
      from: `"Cloude" <${from}>`,
      to,
      subject: 'Your Cloude verification code',
      text: `Your OTP is ${otp}. It expires in 10 minutes.`,
      html: `<p>Your OTP is <b style="font-size:18px">${otp}</b>. It expires in 10 minutes.</p>`,
    });
  }
}
