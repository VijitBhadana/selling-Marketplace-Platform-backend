import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { PRICE_UNITS } from '../cart/booking-details';
import { CertificateDto } from '../listings/shop-certificate';
import { ITEM_CONDITIONS } from './item-condition';
import { PriceTypeDto } from '../listings/dto';

export class CreateProductDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(PriceTypeDto)
  priceType?: PriceTypeDto;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isService?: boolean;

  // Goods in shops where pre-owned items make sense — NEW, USED (second hand) or REFURBISHED.
  // Dropped for services and other shops in ProductsService (see item-condition.ts).
  @IsOptional()
  @IsIn(ITEM_CONDITIONS)
  condition?: string;

  // Booking Cloude only — what the price is per (night, hour, day, person...).
  @IsOptional()
  @IsIn(PRICE_UNITS)
  priceUnit?: string;

  // Property Cloude only — validated per category in ProductsService (see property-details.ts).
  @IsOptional()
  @IsObject()
  propertyDetails?: Record<string, unknown>;

  // Clinic & Doctors Cloude only — a doctor's or medicine's details, validated in
  // ProductsService (see clinic-details.ts). null turns the item back into a plain product.
  @IsOptional()
  @IsObject()
  clinicDetails?: Record<string, unknown> | null;

  // Agriculture & Farmer Cloude transport shops only — the vehicle's delivery charge and
  // hourly rate, validated in ProductsService (see transport-details.ts).
  @IsOptional()
  @IsObject()
  transportDetails?: Record<string, unknown>;

  // Education Cloude only — a course's, class's, counselling service's or book's details,
  // validated in ProductsService (see education-details.ts). null turns the item back into a plain product.
  @IsOptional()
  @IsObject()
  educationDetails?: Record<string, unknown> | null;

  // Financing Cloude only — a loan scheme's, policy's, investment product's or financial
  // service's terms, validated in ProductsService (see finance-details.ts). null turns the
  // item back into a plain product.
  @IsOptional()
  @IsObject()
  financeDetails?: Record<string, unknown> | null;

  // Clinic & Doctors Cloude doctors only — their registration certificate photo, required
  // when a doctor is added (see listings/shop-certificate.ts). On an edit it replaces the old one.
  @IsOptional()
  @ValidateNested()
  @Type(() => CertificateDto)
  certificate?: CertificateDto;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(PriceTypeDto)
  priceType?: PriceTypeDto;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isService?: boolean;

  // Goods in shops where pre-owned items make sense — NEW, USED (second hand) or REFURBISHED.
  // Dropped for services and other shops in ProductsService (see item-condition.ts).
  @IsOptional()
  @IsIn(ITEM_CONDITIONS)
  condition?: string;

  // Booking Cloude only — what the price is per (night, hour, day, person...).
  @IsOptional()
  @IsIn(PRICE_UNITS)
  priceUnit?: string;

  // Property Cloude only — validated per category in ProductsService (see property-details.ts).
  @IsOptional()
  @IsObject()
  propertyDetails?: Record<string, unknown>;

  // Clinic & Doctors Cloude only — a doctor's or medicine's details, validated in
  // ProductsService (see clinic-details.ts). null turns the item back into a plain product.
  @IsOptional()
  @IsObject()
  clinicDetails?: Record<string, unknown> | null;

  // Agriculture & Farmer Cloude transport shops only — the vehicle's delivery charge and
  // hourly rate, validated in ProductsService (see transport-details.ts).
  @IsOptional()
  @IsObject()
  transportDetails?: Record<string, unknown>;

  // Education Cloude only — a course's, class's, counselling service's or book's details,
  // validated in ProductsService (see education-details.ts). null turns the item back into a plain product.
  @IsOptional()
  @IsObject()
  educationDetails?: Record<string, unknown> | null;

  // Financing Cloude only — a loan scheme's, policy's, investment product's or financial
  // service's terms, validated in ProductsService (see finance-details.ts). null turns the
  // item back into a plain product.
  @IsOptional()
  @IsObject()
  financeDetails?: Record<string, unknown> | null;

  // Clinic & Doctors Cloude doctors only — their registration certificate photo, required
  // when a doctor is added (see listings/shop-certificate.ts). On an edit it replaces the old one.
  @IsOptional()
  @ValidateNested()
  @Type(() => CertificateDto)
  certificate?: CertificateDto;
}
