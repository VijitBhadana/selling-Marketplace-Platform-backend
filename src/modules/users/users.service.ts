import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateProfileDto } from './dto';

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

  // Public profile — anyone can call this without logging in, so no email or phone.
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, avatarUrl: true,
        role: true, city: true, pincode: true, isPhoneVerified: true, createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const { name, city, pincode, avatarUrl } = dto;
    return this.prisma.user.update({
      where: { id },
      data: { name, city, pincode, avatarUrl },
      // Never the password / OTP / Aadhaar hashes.
      select: { id: true, name: true, email: true, role: true, city: true, pincode: true, avatarUrl: true },
    });
  }
}
