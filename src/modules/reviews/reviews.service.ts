import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateReviewDto, ReportSellerDto } from './dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  createReview(authorId: string, dto: CreateReviewDto) {
    return this.prisma.review.create({ data: { ...dto, authorId } });
  }

  findForUser(userId: string) {
    return this.prisma.review.findMany({
      where: { targetId: userId },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // "178 Sellers Reporting" style seller-reporting mechanism from the wireframes.
  reportSeller(reporterId: string, dto: ReportSellerDto) {
    return this.prisma.sellerReport.create({ data: { ...dto, reporterId } });
  }

  countReportsForSeller(sellerId: string) {
    return this.prisma.sellerReport.count({ where: { sellerId } });
  }
}
