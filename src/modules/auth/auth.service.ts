import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { LoginDto, RegisterDto, ResendOtpDto, VerifyOtpDto } from './dto';
import { ADMIN_EMAIL } from '../admin/admin-account';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');
    if (dto.email.trim().toLowerCase() === ADMIN_EMAIL) throw new ForbiddenException('This email cannot be used to sign up');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    // An empty phone string (left blank on the sign-up form) must become `undefined`,
    // not '' — phone is a unique column, and a second blank registration would
    // otherwise collide on the empty string and crash with a raw 500.
    const phone = dto.phone?.trim() || undefined;

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          phone,
          passwordHash,
          role: (dto.role as any) ?? 'BUYER',
        },
      });
      await this.issueOtp(user.id, user.email);
      return { email: user.email, message: 'Registered. Enter the OTP sent to your email to verify your account.' };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('That email or phone number is already registered');
      }
      throw err;
    }
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('Invalid email or OTP');
    if (user.isEmailVerified) throw new BadRequestException('Email is already verified');
    if (!user.emailOtpHash || !user.emailOtpExpiresAt || user.emailOtpExpiresAt < new Date()) {
      throw new BadRequestException('OTP has expired. Please request a new one.');
    }

    const valid = await bcrypt.compare(dto.otp, user.emailOtpHash);
    if (!valid) throw new BadRequestException('Invalid email or OTP');

    const verified = await this.prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, emailOtpHash: null, emailOtpExpiresAt: null },
    });
    return this.buildAuthResponse(verified);
  }

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('Invalid email');
    if (user.isEmailVerified) throw new BadRequestException('Email is already verified');

    const sentAt = user.emailOtpExpiresAt ? user.emailOtpExpiresAt.getTime() - OTP_TTL_MS : 0;
    if (Date.now() - sentAt < OTP_RESEND_COOLDOWN_MS) {
      throw new BadRequestException('Please wait a minute before requesting another OTP');
    }

    await this.issueOtp(user.id, user.email);
    return { message: 'A new OTP has been sent to your email.' };
  }

  private async issueOtp(userId: string, email: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const emailOtpHash = await bcrypt.hash(otp, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailOtpHash, emailOtpExpiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });
    await this.mail.sendOtpEmail(email, otp);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.isSuspended) {
      throw new ForbiddenException(
        user.suspendedBy === 'ADMIN'
          ? 'Your account has been suspended by the DukanCloude admin. Please contact support.'
          : 'Your account has been suspended for repeated no-shows on Cash on Delivery orders.',
      );
    }

    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: { id: string; email: string; name: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }
}
