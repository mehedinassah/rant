import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { BillingService } from './billing.service';
import { ChangePlanDto } from './dto/billing.dto';

@Controller('organizations/:orgId/billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** Public catalogue of plans (still requires org membership via the guard). */
  @Get('plans')
  plans() {
    return this.billing.plans();
  }

  @Get('subscription')
  subscription(@Param('orgId') orgId: string) {
    return this.billing.getSubscription(orgId);
  }

  @Get('usage')
  usage(@Param('orgId') orgId: string) {
    return this.billing.getUsage(orgId);
  }

  @Get('invoices')
  invoices(@Param('orgId') orgId: string) {
    return this.billing.listInvoices(orgId);
  }

  @Roles(OrgRole.ADMIN)
  @Post('subscription')
  changePlan(
    @Param('orgId') orgId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePlanDto,
  ) {
    return this.billing.changePlan(orgId, userId, dto.plan);
  }

  /** Starts an upgrade: returns a URL to redirect to (Stripe Checkout, or a
   * local success page in simulated mode where the change already applied). */
  @Roles(OrgRole.ADMIN)
  @Post('checkout')
  checkout(
    @Param('orgId') orgId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePlanDto,
  ) {
    return this.billing.startCheckout(orgId, userId, dto.plan);
  }

  @Roles(OrgRole.ADMIN)
  @Post('subscription/cancel')
  cancel(@Param('orgId') orgId: string, @CurrentUser('userId') userId: string) {
    return this.billing.cancel(orgId, userId);
  }

  @Roles(OrgRole.ADMIN)
  @Post('subscription/resume')
  resume(@Param('orgId') orgId: string, @CurrentUser('userId') userId: string) {
    return this.billing.resume(orgId, userId);
  }
}
