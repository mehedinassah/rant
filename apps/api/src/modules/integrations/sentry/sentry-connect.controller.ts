import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CreateProjectLinkDto } from '../dto/integration.dto';
import { SentryConnectService } from './sentry-connect.service';

@Controller()
export class SentryConnectController {
  constructor(private readonly connect: SentryConnectService) {}

  @Get('organizations/:orgId/integrations/sentry/status')
  status(@Param('orgId') orgId: string) {
    return this.connect.status(orgId);
  }

  @Get('organizations/:orgId/integrations/sentry/links')
  listLinks(@Param('orgId') orgId: string) {
    return this.connect.listLinks(orgId);
  }

  @Roles(OrgRole.ADMIN)
  @Post('organizations/:orgId/integrations/sentry/links')
  createLink(
    @Param('orgId') orgId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateProjectLinkDto,
  ) {
    return this.connect.createLink(orgId, userId, dto);
  }

  @Roles(OrgRole.ADMIN)
  @Delete('organizations/:orgId/integrations/sentry/links/:linkId')
  removeLink(
    @Param('orgId') orgId: string,
    @Param('linkId') linkId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.connect.removeLink(orgId, userId, linkId);
  }

  @Roles(OrgRole.ADMIN)
  @Get('organizations/:orgId/integrations/sentry/deliveries')
  deliveries(@Param('orgId') orgId: string) {
    return this.connect.deliveries(orgId);
  }
}
