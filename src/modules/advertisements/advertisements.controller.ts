import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdvertisementsService } from './advertisements.service';
import { CreateAdvertisementDto } from './dto';

class MarkSeenDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  ids: string[];
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/advertisements')
export class AdminAdvertisementsController {
  constructor(private ads: AdvertisementsService) {}

  @Post()
  create(@Body() dto: CreateAdvertisementDto) {
    return this.ads.create(dto);
  }

  @Get()
  list() {
    return this.ads.list();
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.ads.remove(id);
  }
}

// Buyer / seller side: the pop-up shown when they land on the site.
@ApiTags('advertisements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('advertisements')
export class AdvertisementsController {
  constructor(private ads: AdvertisementsService) {}

  @Get('pending')
  pending(@Req() req: any) {
    return this.ads.pending(req.user.userId, req.user.role);
  }

  @Post('seen')
  @HttpCode(200)
  markSeen(@Req() req: any, @Body() dto: MarkSeenDto) {
    return this.ads.markSeen(req.user.userId, dto.ids);
  }
}
