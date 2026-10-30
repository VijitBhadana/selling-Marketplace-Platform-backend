import { Module } from '@nestjs/common';
import { AdminAccountSeeder } from './admin-account';
import { AdminCloudesService } from './admin-cloudes.service';
import { AdminController, SettingsController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController, SettingsController],
  providers: [AdminService, AdminCloudesService, AdminAccountSeeder],
})
export class AdminModule {}
