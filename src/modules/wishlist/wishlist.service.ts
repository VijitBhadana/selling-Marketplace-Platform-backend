import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  add(userId: string, listingId: string) {
    return this.prisma.wishlistItem.upsert({
      where: { userId_listingId: { userId, listingId } },
      update: {},
      create: { userId, listingId },
    });
  }

  remove(userId: string, listingId: string) {
    return this.prisma.wishlistItem.deleteMany({ where: { userId, listingId } });
  }

  findMine(userId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      include: { listing: { include: { images: true, cloude: true } } },
    });
  }
}
