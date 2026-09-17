import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class AddToCartDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  // Booking Cloude only — validated per category in CartService (see booking-details.ts).
  @IsOptional()
  @IsObject()
  bookingDetails?: Record<string, unknown>;
}

export class SetCartQuantityDto {
  @Type(() => Number)
  @IsInt()
  quantity: number;
}
