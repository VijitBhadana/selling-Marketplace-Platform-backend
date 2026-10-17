import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
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
