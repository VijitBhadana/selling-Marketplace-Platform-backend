import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminCloudesService } from './admin-cloudes.service';
import { AdminService } from './admin.service';
import {
  AddCategoriesDto,
  AnnouncementDto,
  CreateCloudeDto,
  ListSubscriptionsQuery,
  ListUsersQuery,
  RenameCategoryDto,
  SetSuspendedDto,
  StatsQuery,
  UpdateCloudeDto,
  UpdateThemeDto,
} from './dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private admin: AdminService,
    private cloudes: AdminCloudesService,
  ) {}

  @Get('stats')
  stats(@Query() query: StatsQuery) {
    return this.admin.stats(query.days ?? 30);
  }

  @Get('insights')
  insights(@Query() query: StatsQuery) {
    return this.admin.insights(query.days ?? 30);
  }

  @Post('announcements')
  announce(@Body() dto: AnnouncementDto) {
    return this.admin.announce(dto);
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

  @Get('theme')
  getTheme() {
    return this.admin.getTheme(true);
  }

  @Put('theme')
  updateTheme(@Req() req: any, @Body() dto: UpdateThemeDto) {
    return this.admin.updateTheme(dto, req.user?.email ?? null);
  }

  @Get('cloudes')
  listCloudes() {
    return this.cloudes.list();
  }

  @Post('cloudes')
  createCloude(@Body() dto: CreateCloudeDto) {
    return this.cloudes.create(dto);
  }

  @Patch('cloudes/:id')
  updateCloude(@Param('id') id: string, @Body() dto: UpdateCloudeDto) {
    return this.cloudes.update(id, dto);
  }

  @Delete('cloudes/:id')
  deleteCloude(@Param('id') id: string) {
    return this.cloudes.remove(id);
  }

  @Post('cloudes/:id/categories')
  addCategories(@Param('id') id: string, @Body() dto: AddCategoriesDto) {
    return this.cloudes.addCategories(id, dto.names);
  }

  @Patch('categories/:id')
  renameCategory(@Param('id') id: string, @Body() dto: RenameCategoryDto) {
    return this.cloudes.renameCategory(id, dto.name);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.cloudes.removeCategory(id);
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
