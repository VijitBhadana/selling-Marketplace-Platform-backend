import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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

export class ReportSellerDto {
  @IsString()
  sellerId: string;

  @IsString()
  reason: string;
}
