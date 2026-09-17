import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { cloude: true, children: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  // Returns the dynamic attribute schema used to render the "Post Your Ad" form
  // for this category (admin-configurable per the requirement doc, Section 6.2).
  async getAttributeSchema(id: string) {
    const category = await this.findOne(id);
    return category.attributeSchema ?? [];
  }

  async updateAttributeSchema(id: string, schema: any) {
    return this.prisma.category.update({ where: { id }, data: { attributeSchema: schema } });
  }
}
