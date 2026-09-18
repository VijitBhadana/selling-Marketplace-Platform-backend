import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export class StatsQuery {
  // Window for the "new sign-ups" figure.
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsIn([7, 30, 90])
  days?: 7 | 30 | 90;
}

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
  @IsOptional()
  @IsIn(['VIVID', 'SUBTLE', 'MINIMAL'])
  glow?: 'VIVID' | 'SUBTLE' | 'MINIMAL';

  // null resets the site to its built-in default colour.
  @ValidateIf((o) => o.brandColor !== null)
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'brandColor must be a hex colour like #007AFF' })
  brandColor: string | null;
}

export class AnnouncementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  title: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  body: string;

  @IsIn(['ALL', 'BUYER', 'SELLER'])
  audience: 'ALL' | 'BUYER' | 'SELLER';
}
