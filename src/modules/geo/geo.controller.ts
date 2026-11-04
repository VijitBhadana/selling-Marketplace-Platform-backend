import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GeoService } from './geo.service';

@ApiTags('geo')
@Controller('geo')
export class GeoController {
  constructor(private geo: GeoService) {}

  @Get('reverse')
  @ApiOperation({
    summary: 'Coordinates → colony, city and pincode (Ola Maps)',
    description: '503 when Ola is unavailable or over its daily cap — the client then uses OpenStreetMap.',
  })
  reverse(@Query('lat') latRaw: string, @Query('lng') lngRaw: string) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new BadRequestException('lat and lng must be valid coordinates');
    }
    return this.geo.reverse(lat, lng);
  }
}
