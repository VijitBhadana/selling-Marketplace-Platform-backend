import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Deliberately touches nothing but the process itself — no database, no mail. ' +
      'It answers "is the app serving requests", which is what the deploy gate needs; ' +
      'a DB check here would make an unrelated outage look like a failed release.',
  })
  check() {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
