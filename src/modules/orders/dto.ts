import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const MAX_PICKUP_ETA_MINUTES = 24 * 60;

export enum OrderChannelDto {
  TAKEAWAY = 'TAKEAWAY',
  DELIVERY = 'DELIVERY',
  DINE_IN = 'DINE_IN',
  SERVICE = 'SERVICE',
  BOOKING = 'BOOKING',
}

export enum PaymentMethodDto {
  ONLINE = 'ONLINE',
  COD = 'COD',
}

export class CheckoutDto {
  @IsEnum(OrderChannelDto)
  channel: OrderChannelDto;

  // At most a day: the seller can report a COD no-show only after this time, so an
  // open-ended ETA would make that impossible (and a huge one overflowed the date → 500).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PICKUP_ETA_MINUTES, { message: 'You can arrive at most 24 hours (1440 minutes) from now.' })
  pickupEtaMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  // Food Cloude: instructions for the kitchen (less spicy, no onion...). Ignored for other shops.
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @IsEnum(PaymentMethodDto)
  paymentMethod: PaymentMethodDto;
}
