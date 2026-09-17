import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CloudesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.cloude.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { categories: { orderBy: { name: 'asc' } } },
    });
  }

  findBySlug(slug: string) {
    return this.prisma.cloude.findUnique({
      where: { slug },
      include: { categories: { orderBy: { name: 'asc' } } },
    });
  }
}
