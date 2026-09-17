import { Body, Controller, Get, Param, Patch, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';
import { ListSubscriptionsQuery, ListUsersQuery, SetSuspendedDto, UpdateThemeDto } from './dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('users')
  listUsers(@Query() query: ListUsersQuery) {
    return this.admin.listUsers(query);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Patch('users/:id/suspension')
  setSuspended(@Param('id') id: string, @Body() dto: SetSuspendedDto) {
    return this.admin.setSuspended(id, dto.suspended);
  }

  @Get('subscriptions')
  listSubscriptions(@Query() query: ListSubscriptionsQuery) {
    return this.admin.listSubscriptions(query);
  }

  @Put('theme')
  updateTheme(@Body() dto: UpdateThemeDto) {
    return this.admin.updateTheme(dto.brandColor);
  }
}

// Public: every visitor's page needs the admin-chosen brand colour.
@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private admin: AdminService) {}

  @Get('theme')
  theme() {
    return this.admin.getTheme();
  }
}
