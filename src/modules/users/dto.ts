import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

// The only fields a user may change on their own profile. Role, suspension, COD strikes,
// verification flags and KYC are never settable from here — the global ValidationPipe
// rejects any other key (forbidNonWhitelisted).
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
  pincode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000_000)
  avatarUrl?: string;
}
