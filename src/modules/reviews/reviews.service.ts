import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateReviewDto, RateOrderDto, ReportSellerDto } from './dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  // Ratings rank shops on the home page, so only a buyer who actually received an
  // order from this seller (and shop, if given) may leave one.
  async createReview(authorId: string, dto: CreateReviewDto) {
    const bought = await this.prisma.order.findFirst({
      where: { buyerId: authorId, sellerId: dto.targetId, status: 'COMPLETED', ...(dto.listingId ? { listingId: dto.listingId } : {}) },
      select: { id: true },
    });
    if (!bought) throw new ForbiddenException('You can rate a seller only after receiving an order from them.');
    return this.prisma.review.create({ data: { ...dto, authorId } });
  }

  /**
   * Rates the shop an order came from. One rating per buyer per shop — rating again
   * (after a later order) updates it instead of stacking up extra votes.
   */
  async rateOrder(buyerId: string, orderId: string, dto: RateOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { buyerId: true, sellerId: true, listingId: true, status: true },
    });
    if (!order || order.buyerId !== buyerId) throw new NotFoundException('Order not found');
    if (order.status !== 'COMPLETED') throw new BadRequestException('Mark the order as received before rating it.');
    if (!order.listingId) throw new BadRequestException('This shop no longer exists.');

    const comment = dto.comment?.trim() || null;
    const existing = await this.prisma.review.findFirst({
      where: { authorId: buyerId, listingId: order.listingId },
      select: { id: true },
    });
    return existing
      ? this.prisma.review.update({ where: { id: existing.id }, data: { rating: dto.rating, comment } })
      : this.prisma.review.create({
          data: { authorId: buyerId, targetId: order.sellerId, listingId: order.listingId, rating: dto.rating, comment },
        });
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
