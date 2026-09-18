import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateAdvertisementDto {
  @IsIn(['SHOP', 'SERVICE'])
  kind: 'SHOP' | 'SERVICE';

  // The shop's or the service's name.
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  // A resized photo as a base64 data URL (~200 KB), or an https image link.
  @IsString()
  @MaxLength(6_000_000)
  @Matches(/^(data:image\/(png|jpe?g|webp|gif);base64,|https:\/\/)/, { message: 'imageUrl must be an uploaded image' })
  imageUrl: string;

  // A page on this site ("/listing/…") or an http(s) link — never javascript: and the like.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^(https?:\/\/|\/(?!\/))\S*$/, { message: 'linkUrl must start with / or https://' })
  linkUrl?: string;

  @IsIn(['ALL', 'BUYER', 'SELLER'])
  audience: 'ALL' | 'BUYER' | 'SELLER';

  // How long it runs; omitted = until the admin takes it down.
  @IsOptional()
  @IsIn([1, 7, 30])
  days?: 1 | 7 | 30;
}
