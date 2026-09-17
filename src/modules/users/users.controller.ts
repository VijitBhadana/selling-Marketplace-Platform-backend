import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  findMe(@Req() req: any) {
    return this.usersService.findMe(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/ack-warning')
  ackWarning(@Req() req: any) {
    return this.usersService.ackWarning(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@Req() req: any, @Body() body: any) {
    return this.usersService.updateProfile(req.user.userId, body);
  }
}
