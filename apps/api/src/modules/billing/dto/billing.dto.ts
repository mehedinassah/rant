import { IsEnum } from 'class-validator';
import { PlanTier } from '@rant/database';

export class ChangePlanDto {
  @IsEnum(PlanTier)
  plan!: PlanTier;
}
