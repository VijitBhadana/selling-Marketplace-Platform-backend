import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  targetId: string;

  @IsOptional()
  @IsString()
  listingId?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

/** A buyer's rating for the shop an order came from — once they've confirmed receiving it. */
export class RateOrderDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class ReportSellerDto {
  @IsString()
  sellerId: string;

  @IsString()
  reason: string;
}
