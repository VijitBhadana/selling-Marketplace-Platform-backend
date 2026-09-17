import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CloudesService } from './cloudes.service';

@ApiTags('cloudes')
@Controller('cloudes')
export class CloudesController {
  constructor(private cloudesService: CloudesService) {}

  @Get()
  findAll() {
    return this.cloudesService.findAll();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.cloudesService.findBySlug(slug);
  }
}
