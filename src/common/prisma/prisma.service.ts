import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

// Supabase's pooler closes idle connections; the next query on one fails with
// P1017 ("Server has closed the connection") and Prisma reconnects right after.
// Reads are safe to replay once. Writes are never retried — the first attempt
// may already have committed.
const READ_ACTIONS = new Set<Prisma.PrismaAction>([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

function isClosedConnection(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P1017';
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    // $use is deprecated in favour of client extensions, but $extends returns a
    // new client and can't be applied to this injected subclass.
    this.$use(async (params, next) => {
      try {
        return await next(params);
      } catch (err) {
        if (!params.runInTransaction && READ_ACTIONS.has(params.action) && isClosedConnection(err)) {
          return next(params);
        }
        throw err;
      }
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
