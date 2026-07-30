import { Controller, Post, RawBodyRequest, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { BillingService } from './billing.service';

/** Public Stripe webhook receiver. Verification happens in the provider using
 * the raw body + signature header. No-op in simulated mode. */
@Controller('billing')
export class BillingWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Public()
  @SkipThrottle()
  @Post('webhook')
  webhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.header('stripe-signature');
    return this.billing.handleWebhook(req.rawBody ?? Buffer.from(''), signature);
  }
}
