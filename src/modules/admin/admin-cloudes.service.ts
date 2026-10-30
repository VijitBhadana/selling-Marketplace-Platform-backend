import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCloudeDto, UpdateCloudeDto } from './dto';

// Same rule as prisma/seed.ts and the frontend's lib/cloudes-data.ts, so slugs line up.
function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// The "Post Your Ad" form fields every seeded category starts with.
const DEFAULT_ATTRIBUTE_SCHEMA = [
  { key: 'title', label: 'Ad Title', type: 'text', required: true, maxLength: 70 },
  { key: 'description', label: 'Description', type: 'textarea', required: true, maxLength: 4096 },
];

const cloudeInclude = {
  categories: {
    select: { id: true, name: true, slug: true, createdAt: true, _count: { select: { listings: true, jobs: true, children: true } } },
    orderBy: { name: 'asc' },
  },
  _count: { select: { listings: true } },
} satisfies Prisma.CloudeInclude;

/** Unique category names (by slug) that aren't empty once slugified. */
function cleanNames(names: string[]) {
  const seen = new Map<string, string>();
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, ' ');
    const slug = slugify(name);
    if (slug && !seen.has(slug)) seen.set(slug, name);
  }
  return [...seen].map(([slug, name]) => ({ slug, name }));
}

function isPrismaError(e: unknown, code: string) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === code;
}

// Admin panel → Cloudes: add, rename and delete Cloudes and their categories.
// Anything a shop or job is posted under can't be deleted, so no live post is orphaned.
@Injectable()
export class AdminCloudesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.cloude.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], include: cloudeInclude });
  }

  private async getOne(id: string) {
    const cloude = await this.prisma.cloude.findUnique({ where: { id }, include: cloudeInclude });
    if (!cloude) throw new NotFoundException('Cloude not found');
    return cloude;
  }

  async create(dto: CreateCloudeDto) {
    const name = dto.name.trim();
    const slug = dto.slug ?? slugify(name);
    if (!slug) throw new BadRequestException('Give the Cloude a name with letters or numbers');

    const last = await this.prisma.cloude.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    try {
      return await this.prisma.cloude.create({
        data: {
          name,
          slug,
          description: dto.description?.trim() || null,
          icon: dto.icon?.trim() || null,
          sortOrder: (last?.sortOrder ?? -1) + 1,
          categories: {
            create: cleanNames(dto.categories ?? []).map((c) => ({ ...c, attributeSchema: DEFAULT_ATTRIBUTE_SCHEMA })),
          },
        },
        include: cloudeInclude,
      });
    } catch (e) {
      if (isPrismaError(e, 'P2002')) throw new ConflictException('A Cloude with this name or slug already exists');
      throw e;
    }
  }

  async update(id: string, dto: UpdateCloudeDto) {
    await this.getOne(id);
    try {
      return await this.prisma.cloude.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
          ...(dto.icon !== undefined ? { icon: dto.icon.trim() || null } : {}),
        },
        include: cloudeInclude,
      });
    } catch (e) {
      if (isPrismaError(e, 'P2002')) throw new ConflictException('Another Cloude already has this name');
      throw e;
    }
  }

  async remove(id: string) {
    const cloude = await this.getOne(id);
    const jobs = cloude.categories.reduce((sum, c) => sum + c._count.jobs, 0);
    if (cloude._count.listings > 0 || jobs > 0) {
      throw new BadRequestException(
        `${cloude.name} has ${cloude._count.listings} shop(s) and ${jobs} job(s) posted in it — those must be removed before the Cloude can be deleted`,
      );
    }
    // Its categories go with it (onDelete: Cascade).
    await this.prisma.cloude.delete({ where: { id } });
    return { id, deleted: true };
  }

  async addCategories(cloudeId: string, names: string[]) {
    const cloude = await this.getOne(cloudeId);
    const existing = new Set(cloude.categories.map((c) => c.slug));
    const fresh = cleanNames(names).filter((c) => !existing.has(c.slug));
    if (fresh.length === 0) throw new ConflictException('These categories already exist in this Cloude');

    await this.prisma.category.createMany({
      data: fresh.map((c) => ({ ...c, cloudeId, attributeSchema: DEFAULT_ATTRIBUTE_SCHEMA })),
      skipDuplicates: true,
    });
    return this.getOne(cloudeId);
  }

  // Only the name changes — the slug stays, so links and posts under it keep working.
  async renameCategory(id: string, name: string) {
    const category = await this.prisma.category.findUnique({ where: { id }, select: { cloudeId: true } });
    if (!category) throw new NotFoundException('Category not found');
    await this.prisma.category.update({ where: { id }, data: { name: name.trim().replace(/\s+/g, ' ') } });
    return this.getOne(category.cloudeId);
  }

  async removeCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { name: true, cloudeId: true, _count: { select: { listings: true, jobs: true, children: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    const { listings, jobs, children } = category._count;
    if (listings > 0 || jobs > 0 || children > 0) {
      const parts = [`${listings} shop(s)`, `${jobs} job(s)`, ...(children > 0 ? [`${children} sub-category(s)`] : [])];
      throw new BadRequestException(`"${category.name}" has ${parts.join(', ')} under it — it can't be deleted while they exist`);
    }
    await this.prisma.category.delete({ where: { id } });
    return this.getOne(category.cloudeId);
  }
}
