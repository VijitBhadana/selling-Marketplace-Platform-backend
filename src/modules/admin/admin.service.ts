import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ListSubscriptionsQuery, ListUsersQuery } from './dto';

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

  async stats() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
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
      newUsersLast30Days: newUsers,
      listings,
      jobs,
      activeSubscriptions,
      inactiveSubscriptions: sellers - activeSubscriptions,
    };
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

  async getTheme() {
    const setting = await this.prisma.siteSetting.findUnique({ where: { id: 'global' } });
    return { brandColor: setting?.brandColor ?? null };
  }

  async updateTheme(brandColor: string | null) {
    const value = brandColor ? brandColor.toUpperCase() : null;
    const setting = await this.prisma.siteSetting.upsert({
      where: { id: 'global' },
      update: { brandColor: value },
      create: { id: 'global', brandColor: value },
    });
    return { brandColor: setting.brandColor };
  }
}
