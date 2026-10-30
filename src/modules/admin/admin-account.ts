import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { isProduction } from '../../common/env';

// The platform has exactly one admin, whose login is ADMIN_EMAIL / ADMIN_PASSWORD from
// the environment. It is never created through sign-up; the backend makes sure the
// account exists — with that password — every time it starts.
//
// There is no built-in default login. Production refuses to boot without both values;
// a dev backend without them leaves every account as it is. (Dev and prod share one
// database, so a dev backend falling back to a default admin would demote the real one.)
function adminSetting(name: 'ADMIN_EMAIL' | 'ADMIN_PASSWORD') {
  // Trimmed: a value pasted into a hosting dashboard often carries a stray space or newline.
  const value = process.env[name]?.trim() ?? '';
  if (!value && isProduction()) {
    throw new Error(`[security] ${name} must be set in production — refusing to start without the admin login.`);
  }
  return value;
}

/**
 * Read when needed, never at import time: locally ConfigModule only loads .env once
 * AppModule is set up, after this file has been imported.
 */
export function adminLogin() {
  return { email: adminSetting('ADMIN_EMAIL').toLowerCase(), password: adminSetting('ADMIN_PASSWORD') };
}

@Injectable()
export class AdminAccountSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminAccountSeeder.name);

  constructor(private prisma: PrismaService) {}

  async onApplicationBootstrap() {
    // Outside the try: a missing login in production must stop the boot.
    const login = adminLogin();
    try {
      await ensureAdminAccount(this.prisma, login);
    } catch (err) {
      this.logger.error(`Could not ensure the admin account: ${(err as Error).message}`);
    }
  }
}

export async function ensureAdminAccount(prisma: Pick<PrismaService, 'user'>, { email, password } = adminLogin()) {
  if (!email || !password) {
    // eslint-disable-next-line no-console
    console.warn('[admin] ADMIN_EMAIL / ADMIN_PASSWORD are not set — leaving the admin account untouched.');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Keep the admin an admin, never locked out, and logging in with ADMIN_PASSWORD.
    const passwordMatches = await bcrypt.compare(password, existing.passwordHash);
    if (existing.role !== 'ADMIN' || existing.isSuspended || !passwordMatches) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: 'ADMIN',
          isSuspended: false,
          suspendedAt: null,
          suspendedBy: null,
          ...(passwordMatches ? {} : { passwordHash: await bcrypt.hash(password, 10) }),
        },
      });
    }
  } else {
    await prisma.user.create({
      data: {
        name: 'Admin',
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'ADMIN',
        isEmailVerified: true,
      },
    });
  }
  // Only one admin: anyone else carrying the role is demoted.
  await prisma.user.updateMany({
    where: { role: 'ADMIN', email: { not: email } },
    data: { role: 'BUYER' },
  });
}
