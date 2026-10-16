import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DeliveryService } from './delivery.service';
import { SetLocationDto } from './dto';

@ApiTags('delivery')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DELIVERY')
@Controller('delivery')
export class DeliveryController {
  constructor(private delivery: DeliveryService) {}

  @Get('profile')
  profile(@Req() req: any) {
    return this.delivery.profile(req.user.userId);
  }

  @Put('location')
  setLocation(@Req() req: any, @Body() dto: SetLocationDto) {
    return this.delivery.setLocation(req.user.userId, dto);
  }

  @Get('requests')
  requests(@Req() req: any) {
    return this.delivery.requests(req.user.userId);
  }

  @Get('orders')
  mine(@Req() req: any) {
    return this.delivery.mine(req.user.userId);
  }

  @Post('orders/:id/accept')
  accept(@Req() req: any, @Param('id') id: string) {
    return this.delivery.accept(req.user.userId, id);
  }

  @Post('orders/:id/reject')
  reject(@Req() req: any, @Param('id') id: string) {
    return this.delivery.reject(req.user.userId, id);
  }

  @Post('orders/:id/picked-up')
  pickedUp(@Req() req: any, @Param('id') id: string) {
    return this.delivery.pickedUp(req.user.userId, id);
  }

  @Post('orders/:id/delivered')
  delivered(@Req() req: any, @Param('id') id: string) {
    return this.delivery.delivered(req.user.userId, id);
  }
}
