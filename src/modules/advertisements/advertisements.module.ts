import { Module } from '@nestjs/common';
import { AdminAdvertisementsController, AdvertisementsController } from './advertisements.controller';
import { AdvertisementsService } from './advertisements.service';

@Module({
  controllers: [AdminAdvertisementsController, AdvertisementsController],
  providers: [AdvertisementsService],
})
export class AdvertisementsModule {}
