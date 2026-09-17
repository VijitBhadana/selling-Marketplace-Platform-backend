import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddToCartDto, SetCartQuantityDto } from './dto';
import { CartService } from './cart.service';

@ApiTags('cart')
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  @Get()
  findMine(@Req() req: any) {
    return this.cartService.findMine(req.user.userId);
  }

  @Post(':productId')
  add(@Req() req: any, @Param('productId') productId: string, @Body() dto: AddToCartDto) {
    return this.cartService.add(req.user.userId, productId, dto.quantity ?? 1, dto.bookingDetails);
  }

  @Patch(':productId')
  setQuantity(@Req() req: any, @Param('productId') productId: string, @Body() dto: SetCartQuantityDto) {
    return this.cartService.setQuantity(req.user.userId, productId, dto.quantity);
  }

  @Delete(':productId')
  remove(@Req() req: any, @Param('productId') productId: string) {
    return this.cartService.remove(req.user.userId, productId);
  }
}
