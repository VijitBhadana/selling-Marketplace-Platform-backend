import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export enum PriceTypeDto {
  FIXED = 'FIXED',
  CONTACT_FOR_PRICE = 'CONTACT_FOR_PRICE',
}

export class CreateListingDto {
  @IsString()
  cloudeId: string;

  @IsString()
  categoryId: string;

  @IsString()
  @MaxLength(70)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  description?: string;

  // Shop / business name shown on the listing card (optional — Post Your Ad, Step 1).
  @IsOptional()
  @IsString()
  @MaxLength(80)
  shopName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsEnum(PriceTypeDto)
  priceType?: PriceTypeDto;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  // Filled when the seller used "Use current location" — lets buyers ~25 km away find the shop.
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  // Dynamic fields defined by the category's attributeSchema (Section 6.1, Step 3)
  @IsOptional()
  attributes?: Record<string, any>;

  @IsOptional()
  @IsArray()
  images?: string[];
}

export class ListingQueryDto {
  @IsOptional()
  @IsString()
  cloudeSlug?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  // Matches the frontend's /cloudes/:slug?category=:categorySlug links.
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  q?: string;

  // The visitor's area from the navbar location picker — see common/nearby.ts.
  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 20;
}

export class FreshQueryDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
