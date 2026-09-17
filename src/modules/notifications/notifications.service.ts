import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const EPOCH = new Date(0);

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string, role: string) {
    if (role === 'SELLER') {
      const items = await this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          job: { select: { id: true, title: true, companyName: true } },
          // Financing Cloude alerts link to the agency's shop page.
          listing: { select: { id: true, shopName: true, title: true } },
        },
      });
      await this.prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
      return items;
    }

    // Buyers get a live "latest products" feed instead of persisted rows —
    // "seen" state is tracked via User.notificationsSeenAt, bumped below. Mixed
    // in are their persisted alerts (e.g. "interview scheduled" from a recruiter).
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { notificationsSeenAt: true } });
    const seenAt = user?.notificationsSeenAt ?? EPOCH;

    const [alerts, products] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          job: { select: { id: true, title: true, companyName: true } },
          // Financing Cloude alerts link to the agency's shop page.
          listing: { select: { id: true, shopName: true, title: true } },
        },
      }),
      this.prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { listing: { select: { id: true, shopName: true, title: true, coverImageUrl: true } } },
      }),
    ]);

    await Promise.all([
      this.prisma.user.update({ where: { id: userId }, data: { notificationsSeenAt: new Date() } }),
      this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } }),
    ]);

    const productItems = products.map((p) => ({
      id: p.id,
      type: 'NEW_PRODUCT' as const,
      title: 'New product added',
      body: `${p.name} is now available at ${p.listing.shopName || p.listing.title}`,
      image: p.imageUrl || p.listing.coverImageUrl,
      listingId: p.listing.id,
      createdAt: p.createdAt,
      isNew: p.createdAt > seenAt,
    }));

    return [...alerts, ...productItems]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 30);
  }

  async unreadCount(userId: string, role: string) {
    if (role === 'SELLER') {
      const count = await this.prisma.notification.count({ where: { userId, read: false } });
      return { count };
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { notificationsSeenAt: true } });
    const seenAt = user?.notificationsSeenAt ?? EPOCH;
    const [newProducts, unreadAlerts] = await Promise.all([
      this.prisma.product.count({ where: { createdAt: { gt: seenAt } } }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);
    return { count: newProducts + unreadAlerts };
  }
}
