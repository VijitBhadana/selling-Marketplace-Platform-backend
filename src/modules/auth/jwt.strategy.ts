import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { requireSecret } from '../../common/env';
import { passwordVersion } from './password-version';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireSecret('JWT_SECRET', 'dev-secret'),
    });
  }

  async validate(payload: { sub: string; email: string; role: string; pwv?: string }) {
    // Read the account live so an admin suspension locks the user out right away
    // (COD-suspended buyers stay signed in — they still need to see the warning).
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true, isSuspended: true, suspendedBy: true, passwordHash: true },
    });
    if (!user) throw new UnauthorizedException();
    // Password changed since this token was issued (e.g. a reset) — sign in again.
    // Tokens from before `pwv` existed have none and simply run out on their own.
    if (payload.pwv && payload.pwv !== passwordVersion(user.passwordHash)) {
      throw new UnauthorizedException('Your password was changed. Please log in again.');
    }
    if (user.isSuspended && user.suspendedBy === 'ADMIN') {
      throw new ForbiddenException('Your account has been suspended by the DukanCloude admin.');
    }
    return { userId: payload.sub, email: payload.email, role: user.role };
  }
}
