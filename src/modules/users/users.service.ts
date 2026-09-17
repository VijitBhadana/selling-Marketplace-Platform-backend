import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, role: true,
        isSuspended: true, pendingCodWarning: true, codStrikeCount: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async ackWarning(id: string) {
    await this.prisma.user.update({ where: { id }, data: { pendingCodWarning: false } });
    return { ok: true };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true, avatarUrl: true,
        role: true, city: true, pincode: true, isPhoneVerified: true, createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, data: { name?: string; city?: string; pincode?: string; avatarUrl?: string }) {
    return this.prisma.user.update({ where: { id }, data });
  }
}
