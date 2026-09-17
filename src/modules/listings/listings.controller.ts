import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateListingDto, ListingQueryDto } from './dto';
import { ListingsService } from './listings.service';

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private listingsService: ListingsService) {}

  @Get()
  findAll(@Query() query: ListingQueryDto) {
    return this.listingsService.findAll(query);
  }

  // Declared before ':id' so "sitemap" isn't treated as a listing id.
  @Get('sitemap')
  sitemap() {
    return this.listingsService.sitemapEntries();
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  findMine(@Req() req: any) {
    return this.listingsService.findMine(req.user.userId);
  }

  // Declared before ':id' so "mine" isn't treated as a listing id.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  @Delete('mine')
  removeAllMine(@Req() req: any) {
    return this.listingsService.removeAllMine(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.listingsService.remove(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: any, @Body() dto: CreateListingDto) {
    return this.listingsService.create(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<CreateListingDto>) {
    return this.listingsService.update(id, req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: 'SOLD' | 'BOOKED' | 'ACTIVE' | 'REMOVED' }) {
    return this.listingsService.markStatus(id, req.user.userId, body.status);
  }
}
