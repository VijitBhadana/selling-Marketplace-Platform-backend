import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateProductDto, UpdateProductDto } from './dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller()
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get('listings/:listingId/products')
  findForListing(@Param('listingId') listingId: string) {
    return this.productsService.findForListing(listingId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('listings/:listingId/products')
  create(@Req() req: any, @Param('listingId') listingId: string, @Body() dto: CreateProductDto) {
    return this.productsService.create(listingId, req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  @Delete('listings/:listingId/products')
  removeAll(@Req() req: any, @Param('listingId') listingId: string) {
    return this.productsService.removeAllForListing(listingId, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('products/:id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('products/:id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.productsService.remove(id, req.user.userId);
  }
}
