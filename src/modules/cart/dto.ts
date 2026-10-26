import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

// Well inside the DB's integer column — a bigger number used to crash the request with a 500.
export const MAX_CART_QUANTITY = 999;
const tooMany = { message: `You can add at most ${MAX_CART_QUANTITY} of one item.` };

export class AddToCartDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CART_QUANTITY, tooMany)
  quantity?: number;

  // Booking Cloude only — validated per category in CartService (see booking-details.ts).
  @IsOptional()
  @IsObject()
  bookingDetails?: Record<string, unknown>;
}

export class SetCartQuantityDto {
  @Type(() => Number)
  @IsInt()
  @Max(MAX_CART_QUANTITY, tooMany)
  quantity: number;
}
