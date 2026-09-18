import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAdvertisementDto } from './dto';

const DAY_MS = 24 * 60 * 60 * 1000;

// What the pop-up needs — everything but the bookkeeping.
const popupSelect = {
  id: true,
  kind: true,
  name: true,
  description: true,
  imageUrl: true,
  linkUrl: true,
  createdAt: true,
} satisfies Prisma.AdvertisementSelect;

@Injectable()
export class AdvertisementsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAdvertisementDto) {
    const ad = await this.prisma.advertisement.create({
      data: {
        kind: dto.kind,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        imageUrl: dto.imageUrl,
        linkUrl: dto.linkUrl?.trim() || null,
        audience: dto.audience,
        endsAt: dto.days ? new Date(Date.now() + dto.days * DAY_MS) : null,
      },
      select: { id: true },
    });
    const reach = await this.prisma.user.count({
      where: dto.audience === 'ALL' ? { role: { in: ['BUYER', 'SELLER'] } } : { role: dto.audience },
    });
    return { id: ad.id, reach };
  }

  // Admin list: every ad with how many people have seen (closed) it out of its audience.
  async list() {
    const [ads, buyers, sellers] = await Promise.all([
      this.prisma.advertisement.findMany({
        select: { ...popupSelect, audience: true, endsAt: true, _count: { select: { views: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.user.count({ where: { role: 'BUYER' } }),
      this.prisma.user.count({ where: { role: 'SELLER' } }),
    ]);
    const reach = { ALL: buyers + sellers, BUYER: buyers, SELLER: sellers };
    return ads.map(({ _count, ...ad }) => ({ ...ad, seen: _count.views, reach: reach[ad.audience] }));
  }

  async remove(id: string) {
    const { count } = await this.prisma.advertisement.deleteMany({ where: { id } });
    if (!count) throw new NotFoundException('Advertisement not found');
  }

  // Running ads for this user's role that they haven't closed yet, newest first.
  pending(userId: string, role: string) {
    if (role !== 'BUYER' && role !== 'SELLER') return [];
    return this.prisma.advertisement.findMany({
      where: {
        audience: { in: ['ALL', role] },
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
        views: { none: { userId } },
      },
      select: popupSelect,
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  // The user closed the pop-up after seeing these ads — don't pop them up again.
  async markSeen(userId: string, ids: string[]) {
    const existing = await this.prisma.advertisement.findMany({ where: { id: { in: ids } }, select: { id: true } });
    await this.prisma.advertisementView.createMany({
      data: existing.map((ad) => ({ advertisementId: ad.id, userId })),
      skipDuplicates: true,
    });
    return { seen: existing.length };
  }
}
