import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CreateProjectLinkDto } from '../dto/integration.dto';
import { VercelConnectService } from './vercel-connect.service';

@Controller()
export class VercelConnectController {
  constructor(private readonly connect: VercelConnectService) {}

  /** Any member can see whether Vercel is connected and how many projects are linked. */
  @Get('organizations/:orgId/integrations/vercel/status')
  status(@Param('orgId') orgId: string) {
    return this.connect.status(orgId);
  }

  @Get('organizations/:orgId/integrations/vercel/links')
  listLinks(@Param('orgId') orgId: string) {
    return this.connect.listLinks(orgId);
  }

  @Roles(OrgRole.ADMIN)
  @Post('organizations/:orgId/integrations/vercel/links')
  createLink(
    @Param('orgId') orgId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateProjectLinkDto,
  ) {
    return this.connect.createLink(orgId, userId, dto);
  }

  @Roles(OrgRole.ADMIN)
  @Delete('organizations/:orgId/integrations/vercel/links/:linkId')
  removeLink(
    @Param('orgId') orgId: string,
    @Param('linkId') linkId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.connect.removeLink(orgId, userId, linkId);
  }

  @Roles(OrgRole.ADMIN)
  @Get('organizations/:orgId/integrations/vercel/deliveries')
  deliveries(@Param('orgId') orgId: string) {
    return this.connect.deliveries(orgId);
  }
}
