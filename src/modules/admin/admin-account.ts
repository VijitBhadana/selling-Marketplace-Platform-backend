import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';

// The platform has exactly one admin. It is never created through sign-up;
// the backend makes sure the account exists every time it starts.
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'admin@gmail.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@123';

@Injectable()
export class AdminAccountSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminAccountSeeder.name);

  constructor(private prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      await ensureAdminAccount(this.prisma);
    } catch (err) {
      this.logger.error(`Could not ensure the admin account: ${(err as Error).message}`);
    }
  }
}

export async function ensureAdminAccount(prisma: Pick<PrismaService, 'user'>) {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    // Keep the admin an admin and never locked out; leave its password alone.
    if (existing.role !== 'ADMIN' || existing.isSuspended) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'ADMIN', isSuspended: false, suspendedAt: null, suspendedBy: null },
      });
    }
  } else {
    await prisma.user.create({
      data: {
        name: 'Admin',
        email: ADMIN_EMAIL,
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: 'ADMIN',
        isEmailVerified: true,
      },
    });
  }
  // Only one admin: anyone else carrying the role is demoted.
  await prisma.user.updateMany({
    where: { role: 'ADMIN', email: { not: ADMIN_EMAIL } },
    data: { role: 'BUYER' },
  });
}
