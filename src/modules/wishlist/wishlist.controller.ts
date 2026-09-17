import { Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WishlistService } from './wishlist.service';

@ApiTags('wishlist')
@UseGuards(JwtAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private wishlistService: WishlistService) {}

  @Get()
  findMine(@Req() req: any) {
    return this.wishlistService.findMine(req.user.userId);
  }

  @Post(':listingId')
  add(@Req() req: any, @Param('listingId') listingId: string) {
    return this.wishlistService.add(req.user.userId, listingId);
  }

  @Delete(':listingId')
  remove(@Req() req: any, @Param('listingId') listingId: string) {
    return this.wishlistService.remove(req.user.userId, listingId);
  }
}
