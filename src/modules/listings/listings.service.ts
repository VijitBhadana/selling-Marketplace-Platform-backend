import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { jobNearWhere, listingNearWhere, parseNear, type NearQuery } from '../../common/nearby';
import { scoreListings, scoreSellers, type Rating } from '../../common/seller-score';
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
        images: images?.length ? { create: images.map((url, i) => ({ url, sortOrder: i })) } : undefined,
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
    // The visitor's area (navbar location picker): their city or its sub-areas, pincode zone, ~25 km.
    const near = listingNearWhere(parseNear(query));
    if (near) where.AND = [near];
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

  /**
   * Home page "Fresh listings near you": live shops, services and open jobs in the
   * visitor's area, best-trusted first (buyer ratings, complaints, confirmed orders —
   * see seller-score.ts), newest first among equals. Capped at `limit` (8 on the home page).
   *
   * Ranking runs on a light id-only query first; only the winners are loaded with their
   * products, since photos are base64 data URLs and would make every candidate heavy.
   */
  async freshFeed(near: NearQuery, limit: number) {
    const take = Math.min(Math.max(limit, 1), 24);
    const shopWhere: Prisma.ListingWhereInput = {
      status: 'ACTIVE',
      seller: PUBLICLY_VISIBLE_USER,
    };
    const jobWhere: Prisma.JobWhereInput = {
      isClosed: false,
      isFilled: false,
      postedBy: PUBLICLY_VISIBLE_USER,
    };
    const nearShops = listingNearWhere(near);
    const nearJobs = jobNearWhere(near);
    if (nearShops) shopWhere.AND = [nearShops];
    if (nearJobs) jobWhere.AND = [nearJobs];

    const [shopCandidates, jobCandidates] = await Promise.all([
      this.prisma.listing.findMany({
        where: shopWhere,
        select: {
          id: true,
          sellerId: true,
          createdAt: true,
          _count: { select: { products: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.job.findMany({
        where: jobWhere,
        select: { id: true, postedById: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const [shopScores, recruiterScores] = await Promise.all([
      scoreListings(this.prisma, shopCandidates),
      scoreSellers(
        this.prisma,
        jobCandidates.map((j) => j.postedById),
      ),
    ]);

    type Ranked = {
      kind: 'shop' | 'job';
      id: string;
      score: number;
      rating: Rating;
      hasItems: boolean;
      createdAt: Date;
    };
    const ranked: Ranked[] = [
      ...shopCandidates.map((s) => ({
        kind: 'shop' as const,
        id: s.id,
        ...shopScores.get(s.id)!,
        hasItems: s._count.products > 0,
        createdAt: s.createdAt,
      })),
      ...jobCandidates.map((j) => ({
        kind: 'job' as const,
        id: j.id,
        ...recruiterScores.get(j.postedById)!,
        hasItems: true,
        createdAt: j.createdAt,
      })),
    ]
      // Best score first; a shop with nothing to buy yet goes after one that has; then newest.
      .sort(
        (a, b) =>
          b.score - a.score || Number(b.hasItems) - Number(a.hasItems) || b.createdAt.getTime() - a.createdAt.getTime(),
      )
      .slice(0, take);

    const shopIds = ranked.filter((r) => r.kind === 'shop').map((r) => r.id);
    const jobIds = ranked.filter((r) => r.kind === 'job').map((r) => r.id);
    const [shops, jobs] = await Promise.all([
      this.prisma.listing.findMany({
        where: { id: { in: shopIds } },
        select: {
          id: true,
          title: true,
          shopName: true,
          description: true,
          city: true,
          coverImageUrl: true,
          createdAt: true,
          cloude: { select: { name: true, slug: true } },
          category: { select: { name: true, slug: true } },
          _count: { select: { products: true } },
          products: {
            select: {
              id: true,
              name: true,
              price: true,
              priceType: true,
              priceUnit: true,
              imageUrl: true,
              isService: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
      }),
      this.prisma.job.findMany({
        where: { id: { in: jobIds } },
        select: {
          id: true,
          title: true,
          companyName: true,
          location: true,
          workMode: true,
          jobType: true,
          salaryMin: true,
          salaryMax: true,
          salaryPeriod: true,
          experience: true,
          createdAt: true,
          category: {
            select: {
              name: true,
              slug: true,
              cloude: { select: { name: true, slug: true } },
            },
          },
        },
      }),
    ]);
    const shopById = new Map(shops.map((s) => [s.id, s]));
    const jobById = new Map(jobs.map((j) => [j.id, j]));

    return ranked
      .map((r) => {
        if (r.kind === 'shop') {
          const shop = shopById.get(r.id);
          return shop && { kind: 'shop' as const, rating: r.rating, ...shop };
        }
        const job = jobById.get(r.id);
        return job && { kind: 'job' as const, rating: r.rating, ...job };
      })
      .filter((item) => !!item);
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
        seller: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            city: true,
            createdAt: true,
          },
        },
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
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: { sellerId: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Not your listing');
    await this.prisma.$transaction((tx) => deleteListingsCascade(tx, [id]), {
      timeout: 30_000,
    });
  }

  /** Deletes every shop the seller owns. */
  async removeAllMine(sellerId: string) {
    const listings = await this.prisma.listing.findMany({
      where: { sellerId },
      select: { id: true },
    });
    await this.prisma.$transaction(
      (tx) =>
        deleteListingsCascade(
          tx,
          listings.map((l) => l.id),
        ),
      { timeout: 30_000 },
    );
    return { deleted: listings.length };
  }

  async findMine(sellerId: string) {
    return this.prisma.listing.findMany({
      where: { sellerId },
      include: {
        cloude: true,
        category: true,
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
