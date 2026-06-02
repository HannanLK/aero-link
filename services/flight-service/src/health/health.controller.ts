import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get('ready')
  @HealthCheck()
  check() {
    return this.health.check([() => this.prismaHealth.pingCheck('database', this.prisma)]);
  }

  @Get('live')
  live() { return { status: 'ok' }; }
}
