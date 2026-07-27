import { PlanTier } from '@rant/database';

export type GatedResource = 'members' | 'repositories' | 'projects';

export interface PlanDefinition {
  tier: PlanTier;
  label: string;
  priceCents: number;
  /** null = unlimited. */
  limits: Record<GatedResource, number | null>;
  features: string[];
}

/** The catalogue. Plans live in code; a Subscription just references the tier. */
export const PLANS: Record<PlanTier, PlanDefinition> = {
  [PlanTier.FREE]: {
    tier: PlanTier.FREE,
    label: 'Free',
    priceCents: 0,
    limits: { members: 3, repositories: 2, projects: 2 },
    features: ['Up to 3 members', '2 repositories', '2 projects', 'Community support'],
  },
  [PlanTier.PRO]: {
    tier: PlanTier.PRO,
    label: 'Pro',
    priceCents: 2900,
    limits: { members: 15, repositories: 25, projects: 25 },
    features: ['Up to 15 members', '25 repositories', '25 projects', 'Webhooks + API keys', 'Email support'],
  },
  [PlanTier.ENTERPRISE]: {
    tier: PlanTier.ENTERPRISE,
    label: 'Enterprise',
    priceCents: 9900,
    limits: { members: null, repositories: null, projects: null },
    features: ['Unlimited members', 'Unlimited repositories', 'Unlimited projects', 'SSO + audit exports', 'Priority support'],
  },
};

export const PLAN_ORDER: PlanTier[] = [PlanTier.FREE, PlanTier.PRO, PlanTier.ENTERPRISE];
