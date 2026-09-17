import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PUBLICLY_VISIBLE_USER } from '../../common/visibility';
import { deleteListingsCascade } from '../products/product-cleanup';
import { CreateListingDto, ListingQueryDto } from './dto';

@Injectable()
export class ListingsService {
  constructor(private prisma: PrismaService) {}

  async create(sellerId: string, dto: CreateListingDto) {
    const { images, ...rest } = dto;
    return this.prisma.listing.create({
      data: {
        ...rest,
        sellerId,
        status: 'ACTIVE',
        coverImageUrl: images?.[0],
        images: images?.length
          ? { create: images.map((url, i) => ({ url, sortOrder: i })) }
          : undefined,
      },
      include: { images: true },
    });
  }

  async findAll(query: ListingQueryDto) {
    const page = Number(query.page) || 1;
    const pageSize = Math.min(Number(query.pageSize) || 20, 50);

    const where: any = { status: 'ACTIVE', seller: PUBLICLY_VISIBLE_USER };
    if (query.cloudeSlug) where.cloude = { slug: query.cloudeSlug };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.categorySlug) where.category = { slug: query.categorySlug };
    if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
    if (query.q) where.title = { contains: query.q, mode: 'insensitive' };
    if (query.minPrice || query.maxPrice) {
      where.price = {};
      if (query.minPrice) where.price.gte = query.minPrice;
      if (query.maxPrice) where.price.lte = query.maxPrice;
    }

    // No `images` relation on read endpoints: photos are stored as base64 data
    // URLs and images[0] is the same photo as coverImageUrl, so including it
    // doubled every response (≈100 KB per listing) and made pages slow to load.
    // The frontend only ever renders coverImageUrl.
    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: { cloude: true, category: true, seller: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  // Feeds the frontend's sitemap.xml — ids only, since images/relations can
  // carry large base64 photos. 45k stays under the 50k-URL sitemap limit.
  sitemapEntries() {
    return this.prisma.listing.findMany({
      where: { status: 'ACTIVE', seller: PUBLICLY_VISIBLE_USER },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 45000,
    });
  }

  async findOne(id: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { id, seller: PUBLICLY_VISIBLE_USER },
      include: {
        cloude: true,
        category: true,
        seller: { select: { id: true, name: true, avatarUrl: true, city: true, createdAt: true } },
        products: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async update(id: string, sellerId: string, data: Partial<CreateListingDto>) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Not your listing');
    const { images, ...rest } = data;
    return this.prisma.listing.update({ where: { id }, data: rest as any });
  }

  async markStatus(id: string, sellerId: string, status: 'SOLD' | 'BOOKED' | 'ACTIVE' | 'REMOVED') {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Not your listing');
    return this.prisma.listing.update({ where: { id }, data: { status } });
  }

  /** Deletes a shop for good, with its products, orders, chats and applications. */
  async remove(id: string, sellerId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id }, select: { sellerId: true } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Not your listing');
    await this.prisma.$transaction((tx) => deleteListingsCascade(tx, [id]), { timeout: 30_000 });
  }

  /** Deletes every shop the seller owns. */
  async removeAllMine(sellerId: string) {
    const listings = await this.prisma.listing.findMany({ where: { sellerId }, select: { id: true } });
    await this.prisma.$transaction((tx) => deleteListingsCascade(tx, listings.map((l) => l.id)), { timeout: 30_000 });
    return { deleted: listings.length };
  }

  async findMine(sellerId: string) {
    return this.prisma.listing.findMany({
      where: { sellerId },
      include: { cloude: true, category: true, _count: { select: { products: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
