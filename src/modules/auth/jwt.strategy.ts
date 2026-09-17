import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret',
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    // Read the account live so an admin suspension locks the user out right away
    // (COD-suspended buyers stay signed in — they still need to see the warning).
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true, isSuspended: true, suspendedBy: true },
    });
    if (!user) throw new UnauthorizedException();
    if (user.isSuspended && user.suspendedBy === 'ADMIN') {
      throw new ForbiddenException('Your account has been suspended by the DukanCloude admin.');
    }
    return { userId: payload.sub, email: payload.email, role: user.role };
  }
}
