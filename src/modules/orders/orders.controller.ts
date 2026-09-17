import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckoutDto } from './dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post('checkout')
  checkout(@Req() req: any, @Body() dto: CheckoutDto) {
    return this.ordersService.checkout(req.user.userId, dto);
  }

  @Get('mine')
  findMine(@Req() req: any) {
    return this.ordersService.findMine(req.user.userId);
  }

  @Post(':id/receive')
  receive(@Req() req: any, @Param('id') id: string) {
    return this.ordersService.receive(req.user.userId, id);
  }

  @Get('shop/:listingId')
  findForShop(@Req() req: any, @Param('listingId') listingId: string) {
    return this.ordersService.findForShop(req.user.userId, listingId);
  }

  @Post(':id/no-show')
  markNoShow(@Req() req: any, @Param('id') id: string) {
    return this.ordersService.markNoShow(req.user.userId, id);
  }
}
