import { Module } from '@nestjs/common';
import { CloudesController } from './cloudes.controller';
import { CloudesService } from './cloudes.service';

@Module({
  controllers: [CloudesController],
  providers: [CloudesService],
})
export class CloudesModule {}
