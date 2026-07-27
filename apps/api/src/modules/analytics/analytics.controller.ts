import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('organizations/:orgId/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(@Param('orgId') orgId: string, @Query('days') days?: string) {
    return this.analytics.overview(orgId, days ? Number(days) : undefined);
  }
}
