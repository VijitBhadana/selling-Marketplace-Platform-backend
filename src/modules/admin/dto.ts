import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateIf } from 'class-validator';

export class ListUsersQuery {
  @IsOptional()
  @IsIn(['BUYER', 'SELLER'])
  role?: 'BUYER' | 'SELLER';

  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: 'active' | 'suspended';

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class ListSubscriptionsQuery {
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsString()
  q?: string;
}

export class SetSuspendedDto {
  @IsBoolean()
  suspended: boolean;
}

export class UpdateThemeDto {
  // null resets the site to its built-in default colour.
  @ValidateIf((o) => o.brandColor !== null)
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'brandColor must be a hex colour like #007AFF' })
  brandColor: string | null;
}
