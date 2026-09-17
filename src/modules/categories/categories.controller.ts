import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Get(':id/attribute-schema')
  getSchema(@Param('id') id: string) {
    return this.categoriesService.getAttributeSchema(id);
  }

  // Admin-only: configure the dynamic ad-posting form fields for a category.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id/attribute-schema')
  updateSchema(@Param('id') id: string, @Body() body: { schema: any }) {
    return this.categoriesService.updateAttributeSchema(id, body.schema);
  }
}
