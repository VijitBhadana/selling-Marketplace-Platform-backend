import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AnnouncementDto, ListSubscriptionsQuery, ListUsersQuery, UpdateThemeDto } from './dto';

// Everything the admin may see about a user — never the password or OTP hashes.
const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatarUrl: true,
  role: true,
  city: true,
  pincode: true,
  isEmailVerified: true,
  isPhoneVerified: true,
  isSuspended: true,
  suspendedAt: true,
  suspendedBy: true,
  codStrikeCount: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: { listings: true, jobsPosted: true, ordersAsBuyer: true, ordersAsSeller: true, subscriptions: true },
  },
} satisfies Prisma.UserSelect;

const NOT_ADMIN: Prisma.UserWhereInput = { role: { in: ['BUYER', 'SELLER'] } };

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async stats(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [buyers, sellers, suspended, newUsers, listings, jobs, activeSubscriptions] = await Promise.all([
      this.prisma.user.count({ where: { role: 'BUYER' } }),
      this.prisma.user.count({ where: { role: 'SELLER' } }),
      this.prisma.user.count({ where: { ...NOT_ADMIN, isSuspended: true } }),
      this.prisma.user.count({ where: { ...NOT_ADMIN, createdAt: { gte: since } } }),
      this.prisma.listing.count(),
      this.prisma.job.count(),
      this.prisma.user.count({ where: { role: 'SELLER', isSuspended: false } }),
    ]);
    return {
      buyers,
      sellers,
      suspended,
      days,
      newUsers,
      // Kept for older clients.
      newUsersLast30Days: newUsers,
      listings,
      jobs,
      activeSubscriptions,
      inactiveSubscriptions: sellers - activeSubscriptions,
    };
  }

  // Business insights for the dashboard: order volume in the window, the
  // busiest Cloudes, and accounts or posts that need the admin's attention.
  async insights(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const inWindow = { createdAt: { gte: since } };

    const [byStatus, revenue, perCloude, cloudes, unverified, codStrikes, reports, drafts] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], where: inWindow, _count: { _all: true } }),
      this.prisma.order.aggregate({ where: { ...inWindow, status: { not: 'NO_SHOW' } }, _sum: { totalAmount: true } }),
      this.prisma.listing.groupBy({ by: ['cloudeId'], _count: { _all: true } }),
      this.prisma.cloude.findMany({ select: { id: true, name: true, slug: true } }),
      this.prisma.user.count({ where: { ...NOT_ADMIN, isEmailVerified: false, isPhoneVerified: false } }),
      this.prisma.user.count({ where: { ...NOT_ADMIN, codStrikeCount: { gt: 0 }, isSuspended: false } }),
      this.prisma.sellerReport.count({ where: inWindow }),
      this.prisma.listing.count({ where: { status: 'DRAFT' } }),
    ]);

    const count = (status: string) => byStatus.find((s) => s.status === status)?._count._all ?? 0;
    const names = new Map(cloudes.map((c) => [c.id, c]));
    const topCloudes = perCloude
      .map((g) => ({ name: names.get(g.cloudeId)?.name ?? 'Unknown', slug: names.get(g.cloudeId)?.slug ?? '', listings: g._count._all }))
      .sort((x, y) => y.listings - x.listings)
      .slice(0, 5);

    return {
      days,
      orders: {
        total: count('PENDING') + count('COMPLETED') + count('NO_SHOW'),
        pending: count('PENDING'),
        completed: count('COMPLETED'),
        noShow: count('NO_SHOW'),
        revenue: Number(revenue._sum.totalAmount ?? 0),
      },
      topCloudes,
      attention: { unverified, codStrikes, reports, drafts },
    };
  }

  async announce(dto: AnnouncementDto) {
    const recipients = await this.prisma.user.findMany({
      where: dto.audience === 'ALL' ? NOT_ADMIN : { role: dto.audience },
      select: { id: true },
    });
    const { count } = await this.prisma.notification.createMany({
      data: recipients.map((u) => ({
        userId: u.id,
        type: 'ANNOUNCEMENT' as const,
        title: dto.title.trim(),
        body: dto.body.trim(),
      })),
    });
    return { sent: count };
  }

  async listUsers(query: ListUsersQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const q = query.q?.trim();
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : NOT_ADMIN),
      ...(query.status ? { isSuspended: query.status === 'suspended' } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
              { city: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, users };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, ...NOT_ADMIN },
      select: {
        ...userSelect,
        listings: {
          select: {
            id: true,
            title: true,
            shopName: true,
            status: true,
            city: true,
            createdAt: true,
            cloude: { select: { name: true } },
            category: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        jobsPosted: {
          select: { id: true, title: true, companyName: true, location: true, isClosed: true, isFilled: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        subscriptions: { orderBy: { paidAt: 'desc' } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setSuspended(id: string, suspended: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') throw new BadRequestException('The admin account cannot be suspended');

    return this.prisma.user.update({
      where: { id },
      data: suspended
        ? { isSuspended: true, suspendedAt: new Date(), suspendedBy: 'ADMIN' }
        : // Reactivating also clears COD no-show strikes, so the buyer starts fresh.
          { isSuspended: false, suspendedAt: null, suspendedBy: null, codStrikeCount: 0, pendingCodWarning: false },
      select: userSelect,
    });
  }

  // Every seller account is a subscriber: the subscription starts when the
  // seller account is created and is active until the admin suspends it.
  async listSubscriptions(query: ListSubscriptionsQuery) {
    const q = query.q?.trim();
    const sellers = await this.prisma.user.findMany({
      where: {
        role: 'SELLER',
        ...(query.status ? { isSuspended: query.status === 'inactive' } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
                { city: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        createdAt: true,
        isSuspended: true,
        suspendedAt: true,
        suspendedBy: true,
        subscriptions: {
          select: { planName: true, amount: true, paidAt: true, expiresAt: true, paymentRef: true },
          orderBy: { paidAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return sellers.map(({ subscriptions, ...seller }) => ({
      ...seller,
      subscribedAt: seller.createdAt,
      status: seller.isSuspended ? 'INACTIVE' : 'ACTIVE',
      lastPayment: subscriptions[0] ?? null,
    }));
  }

  // `withHistory` adds who saved the theme last and when — admin panel only.
  async getTheme(withHistory = false) {
    const setting = await this.prisma.siteSetting.findUnique({ where: { id: 'global' } });
    const theme = { brandColor: setting?.brandColor ?? null, glow: setting?.glow ?? 'VIVID' };
    return withHistory ? { ...theme, updatedBy: setting?.updatedBy ?? null, updatedAt: setting?.updatedAt ?? null } : theme;
  }

  async updateTheme(dto: UpdateThemeDto, updatedBy: string | null) {
    const brandColor = dto.brandColor ? dto.brandColor.toUpperCase() : null;
    const data = { brandColor, ...(dto.glow ? { glow: dto.glow } : {}), updatedBy };
    const setting = await this.prisma.siteSetting.upsert({
      where: { id: 'global' },
      update: data,
      create: { id: 'global', ...data },
    });
    return { brandColor: setting.brandColor, glow: setting.glow, updatedBy: setting.updatedBy, updatedAt: setting.updatedAt };
  }
}
