import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateReviewDto, ReportSellerDto } from './dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Get('user/:userId')
  findForUser(@Param('userId') userId: string) {
    return this.reviewsService.findForUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: any, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('report-seller')
  report(@Req() req: any, @Body() dto: ReportSellerDto) {
    return this.reviewsService.reportSeller(req.user.userId, dto);
  }

  @Get('report-count/:sellerId')
  reportCount(@Param('sellerId') sellerId: string) {
    return this.reviewsService.countReportsForSeller(sellerId);
  }
}
