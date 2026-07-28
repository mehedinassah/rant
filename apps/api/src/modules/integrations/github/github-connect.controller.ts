import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { GithubConnectService } from './github-connect.service';
import { CompleteInstallDto, LinkAccountDto } from './dto/github.dto';

@Controller()
export class GithubConnectController {
  constructor(private readonly connect: GithubConnectService) {}

  // ── Org-scoped install management (managers/admins) ──────────────────────

  @Roles(OrgRole.ADMIN)
  @Get('organizations/:orgId/integrations/github/install-url')
  installUrl(@Param('orgId') orgId: string) {
    return this.connect.installUrl(orgId);
  }

  @Roles(OrgRole.ADMIN)
  @Post('organizations/:orgId/integrations/github/complete-install')
  completeInstall(
    @Param('orgId') orgId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CompleteInstallDto,
  ) {
    return this.connect.completeInstall(orgId, userId, dto.installationId);
  }

  // Any member can see whether GitHub is connected.
  @Get('organizations/:orgId/integrations/github/status')
  status(@Param('orgId') orgId: string) {
    return this.connect.status(orgId);
  }

  @Roles(OrgRole.ADMIN)
  @Post('organizations/:orgId/integrations/github/resync')
  resync(@Param('orgId') orgId: string, @CurrentUser('userId') userId: string) {
    return this.connect.resync(orgId, userId);
  }

  @Roles(OrgRole.ADMIN)
  @Delete('organizations/:orgId/integrations/github')
  disconnect(@Param('orgId') orgId: string, @CurrentUser('userId') userId: string) {
    return this.connect.disconnect(orgId, userId);
  }

  // ── User account linking (token-scoped, no org) ──────────────────────────

  @Get('integrations/github/oauth/url')
  oauthUrl(@CurrentUser('userId') userId: string) {
    return this.connect.oauthUrl(userId);
  }

  @Post('integrations/github/account')
  link(@CurrentUser('userId') userId: string, @Body() dto: LinkAccountDto) {
    return this.connect.linkAccount(userId, dto.code);
  }

  @Get('integrations/github/account')
  account(@CurrentUser('userId') userId: string) {
    return this.connect.account(userId);
  }

  @Delete('integrations/github/account')
  unlink(@CurrentUser('userId') userId: string) {
    return this.connect.unlinkAccount(userId);
  }
}
