import { IsEmail, IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { VEHICLE_TYPES } from './delivery-kyc';

export enum RoleDto {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  DELIVERY = 'DELIVERY',
}

export class RegisterDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsString()
  @Matches(/^\d{10}$/, { message: 'phone must be exactly 10 digits' })
  phone?: string;

  @IsOptional()
  @IsEnum(RoleDto)
  role?: RoleDto;

  // Required (and checksum-validated) only for SELLER sign-ups — see AuthService.register.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '') || undefined : value))
  @IsString()
  aadhaar?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s/g, '').toUpperCase() || undefined : value))
  @IsString()
  gstin?: string;

  // Sellers give a GSTIN, or a PAN if they have no GST registration.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s/g, '').toUpperCase() || undefined : value))
  @IsString()
  pan?: string;

  // Required only for DELIVERY sign-ups (Aadhaar number above too) — see AuthService.register.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '').toUpperCase() || undefined : value))
  @IsString()
  @MaxLength(20)
  licenseNumber?: string;

  // Photos as base64 data URLs (resized in the browser).
  @IsOptional()
  @IsString()
  licenseImage?: string;

  @IsOptional()
  @IsString()
  aadhaarImage?: string;

  @IsOptional()
  @IsIn(VEHICLE_TYPES)
  vehicleType?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '').toUpperCase() || undefined : value))
  @IsString()
  @MaxLength(12)
  vehicleNumber?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(300)
  address?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'otp must be exactly 6 digits' })
  otp: string;
}

export class ResendOtpDto {
  @IsEmail()
  email: string;
}
