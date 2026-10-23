import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { LoginDto, RegisterDto, ResendOtpDto, VerifyOtpDto } from './dto';
import { ADMIN_EMAIL } from '../admin/admin-account';
import {
  hashAadhaar,
  isValidAadhaar,
  isValidGstin,
  isValidPan,
  normalizeAadhaar,
  normalizeGstin,
  normalizePan,
  panMatchesName,
} from './seller-kyc';
import { isImageDataUrl, isValidLicense, isValidVehicleNumber, normalizeLicense, normalizeVehicleNumber } from './delivery-kyc';

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
    // A sign-up only becomes an account once its email OTP is verified. An unverified
    // one can't log in, so signing up again with the same email just replaces it.
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing?.isEmailVerified) throw new ConflictException('Email already registered');
    if (dto.email.trim().toLowerCase() === ADMIN_EMAIL) throw new ForbiddenException('This email cannot be used to sign up');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    // An empty phone string (left blank on the sign-up form) must become `undefined`,
    // not '' — phone is a unique column, and a second blank registration would
    // otherwise collide on the empty string and crash with a raw 500.
    const phone = dto.phone?.trim() || undefined;

    // Sellers must give a valid Aadhaar, plus a GSTIN or (without GST) a PAN — offline
    // checks only. Buyers' values, if any, are ignored.
    let sellerKyc: { aadhaarHash: string; aadhaarLast4: string; gstin: string | null; pan: string | null } | undefined;
    if (dto.role === 'SELLER') {
      const aadhaar = this.checkAadhaar(dto.aadhaar, 'seller accounts');
      if (!dto.gstin && !dto.pan) throw new BadRequestException("Please enter your GST number — or your PAN if you don't have GST");
      const gstin = dto.gstin ? normalizeGstin(dto.gstin) : null;
      if (gstin && gstin.length !== 15) throw new BadRequestException('GST number must be exactly 15 characters');
      if (gstin && !isValidGstin(gstin)) {
        throw new BadRequestException('This GST number is not valid. Please check it against your GST certificate.');
      }
      const pan = dto.pan ? normalizePan(dto.pan) : null;
      if (pan) {
        if (pan.length !== 10) throw new BadRequestException('PAN must be exactly 10 characters');
        if (!isValidPan(pan)) throw new BadRequestException('This PAN is not valid. Please check it against your PAN card.');
        // A GSTIN carries its holder's PAN in characters 3–12.
        if (gstin && gstin.slice(2, 12) !== pan) throw new BadRequestException('This PAN does not match your GST number');
        if (!panMatchesName(pan, dto.name)) {
          throw new BadRequestException("This PAN does not match your name — a personal PAN's 5th letter is your surname's first letter");
        }
        // A PAN-only sign-up can't reuse the PAN inside another seller's GSTIN.
        if (!gstin && (await this.prisma.user.findFirst({ where: { isEmailVerified: true, gstin: { contains: pan } }, select: { id: true } }))) {
          throw new ConflictException('This PAN is already registered with another seller');
        }
      }
      sellerKyc = { aadhaarHash: hashAadhaar(aadhaar), aadhaarLast4: aadhaar.slice(-4), gstin, pan };
    }

    // Delivery partners: phone, Aadhaar (number + photo), driving licence (number + photo),
    // vehicle and address. Their working location is set later, from the delivery panel.
    let deliveryProfile: Prisma.DeliveryProfileCreateWithoutUserInput | undefined;
    let deliveryAadhaar: { aadhaarHash: string; aadhaarLast4: string } | undefined;
    if (dto.role === 'DELIVERY') {
      if (!phone) throw new BadRequestException('Phone number is required for delivery partners');
      const aadhaar = this.checkAadhaar(dto.aadhaar, 'delivery partners');
      if (!isImageDataUrl(dto.aadhaarImage)) throw new BadRequestException('Please upload a photo of your Aadhaar card (JPG or PNG)');
      if (!dto.licenseNumber) throw new BadRequestException('Driving licence number is required for delivery partners');
      if (!isValidLicense(dto.licenseNumber)) {
        throw new BadRequestException('This driving licence number is not valid. It looks like "UP14 20190012345" on your licence.');
      }
      if (!isImageDataUrl(dto.licenseImage)) throw new BadRequestException('Please upload a photo of your driving licence (JPG or PNG)');
      if (!dto.vehicleType) throw new BadRequestException('Please choose your vehicle');
      const needsNumber = dto.vehicleType !== 'BICYCLE';
      if (needsNumber && !dto.vehicleNumber) throw new BadRequestException('Vehicle number is required');
      if (needsNumber && !isValidVehicleNumber(dto.vehicleNumber!)) {
        throw new BadRequestException('This vehicle number is not valid. It looks like "UP15 AB 1234" on your number plate.');
      }
      if (!dto.address || dto.address.length < 10) throw new BadRequestException('Please enter your full address');

      deliveryAadhaar = { aadhaarHash: hashAadhaar(aadhaar), aadhaarLast4: aadhaar.slice(-4) };
      deliveryProfile = {
        address: dto.address,
        vehicleType: dto.vehicleType,
        vehicleNumber: needsNumber ? normalizeVehicleNumber(dto.vehicleNumber!) : null,
        licenseNumber: normalizeLicense(dto.licenseNumber),
        licenseImage: dto.licenseImage!,
        aadhaarImage: dto.aadhaarImage!,
      };
    }

    const kyc = sellerKyc ?? deliveryAadhaar;
    try {
      await this.releaseFromUnverified({
        phone,
        aadhaarHash: kyc?.aadhaarHash,
        gstin: sellerKyc?.gstin ?? undefined,
        pan: sellerKyc?.pan ?? undefined,
        licenseNumber: deliveryProfile?.licenseNumber,
      });

      const data = {
        name: dto.name,
        email: dto.email,
        phone: phone ?? null,
        passwordHash,
        role: (dto.role as any) ?? 'BUYER',
        aadhaarHash: kyc?.aadhaarHash ?? null,
        aadhaarLast4: kyc?.aadhaarLast4 ?? null,
        gstin: sellerKyc?.gstin ?? null,
        pan: sellerKyc?.pan ?? null,
        ...(deliveryProfile ? { deliveryProfile: { create: deliveryProfile } } : {}),
      };
      const user = existing
        ? await this.prisma.$transaction(async (tx) => {
            await tx.deliveryProfile.deleteMany({ where: { userId: existing.id } });
            return tx.user.update({ where: { id: existing.id }, data });
          })
        : await this.prisma.user.create({ data });
      await this.issueOtp(user.id, user.email);
      return { email: user.email, message: 'Registered. Enter the OTP sent to your email to verify your account.' };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = String(err.meta?.target ?? '');
        if (target.includes('aadhaarHash')) throw new ConflictException('This Aadhaar number is already registered with another account');
        if (target.includes('gstin')) throw new ConflictException('This GST number is already registered with another seller');
        if (target.includes('pan')) throw new ConflictException('This PAN is already registered with another seller');
        if (target.includes('licenseNumber')) {
          throw new ConflictException('This driving licence is already registered with another delivery partner');
        }
        throw new ConflictException('That email or phone number is already registered');
      }
      throw err;
    }
  }

  /**
   * Frees a phone / Aadhaar / GSTIN / licence held by sign-ups that never verified their
   * email — e.g. one made with a mistyped address — so they can't block the real account.
   */
  private async releaseFromUnverified(keys: { phone?: string; aadhaarHash?: string; gstin?: string; pan?: string; licenseNumber?: string }) {
    const unverified = { isEmailVerified: false } as const;
    await this.prisma.$transaction([
      ...(keys.phone ? [this.prisma.user.updateMany({ where: { ...unverified, phone: keys.phone }, data: { phone: null } })] : []),
      ...(keys.aadhaarHash
        ? [this.prisma.user.updateMany({ where: { ...unverified, aadhaarHash: keys.aadhaarHash }, data: { aadhaarHash: null, aadhaarLast4: null } })]
        : []),
      ...(keys.gstin ? [this.prisma.user.updateMany({ where: { ...unverified, gstin: keys.gstin }, data: { gstin: null } })] : []),
      ...(keys.pan ? [this.prisma.user.updateMany({ where: { ...unverified, pan: keys.pan }, data: { pan: null } })] : []),
      ...(keys.licenseNumber
        ? [this.prisma.deliveryProfile.deleteMany({ where: { licenseNumber: keys.licenseNumber, user: unverified } })]
        : []),
    ]);
  }

  /** Validates a seller's / delivery partner's Aadhaar number and returns its 12 digits. */
  private checkAadhaar(value: string | undefined, who: string) {
    if (!value) throw new BadRequestException(`Aadhaar number is required for ${who}`);
    if (normalizeAadhaar(value).length !== 12) throw new BadRequestException('Aadhaar number must be exactly 12 digits');
    if (!isValidAadhaar(value)) {
      throw new BadRequestException('This Aadhaar number is not valid. Please check it against your Aadhaar card.');
    }
    return normalizeAadhaar(value);
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

    // Not an account until the email OTP is verified. Send a fresh code (unless one went
    // out in the last minute) and let the frontend take them to the OTP screen.
    if (!user.isEmailVerified) {
      const sentAt = user.emailOtpExpiresAt ? user.emailOtpExpiresAt.getTime() - OTP_TTL_MS : 0;
      if (Date.now() - sentAt >= OTP_RESEND_COOLDOWN_MS) {
        await this.issueOtp(user.id, user.email).catch(() => undefined); // the OTP screen has "Resend"
      }
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email first — we sent a 6-digit code to your inbox.',
      });
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
