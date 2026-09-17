import { Module } from '@nestjs/common';
import { AdminAccountSeeder } from './admin-account';
import { AdminController, SettingsController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController, SettingsController],
  providers: [AdminService, AdminAccountSeeder],
})
export class AdminModule {}
