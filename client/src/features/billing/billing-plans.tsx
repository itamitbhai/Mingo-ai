'use client';

import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { PLAN_LIMITS, PlanType } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const PLAN_DETAILS: Record<PlanType, { price: string; features: string[] }> = {
  [PlanType.FREE]: {
    price: '$0',
    features: ['Up to 3 projects', '1 workspace', 'Community support'],
  },
  [PlanType.PRO]: {
    price: '$29/mo',
    features: ['Up to 50 projects', 'Unlimited workspaces', 'Priority support'],
  },
  [PlanType.ENTERPRISE]: {
    price: 'Custom',
    features: ['Unlimited projects', 'SSO & advanced security', 'Dedicated support'],
  },
};

function notifyComingSoon() {
  toast.info(
    'Self-serve plan changes are coming in a future phase. Reach out from your dashboard to change plans today.'
  );
}

export function BillingPlans({ currentPlan }: { currentPlan: PlanType }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Object.values(PlanType).map((plan) => {
        const isCurrent = plan === currentPlan;
        const details = PLAN_DETAILS[plan];

        return (
          <Card
            key={plan}
            className={cn('flex flex-col', isCurrent ? 'border-primary/50 bg-primary/5' : 'bg-card/60')}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{PLAN_LIMITS[plan].label}</h3>
                {isCurrent && <Badge>Current plan</Badge>}
              </div>
              <p className="text-2xl font-semibold">{details.price}</p>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {details.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="size-4 text-primary" /> {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={isCurrent ? 'outline' : 'default'}
                disabled={isCurrent}
                onClick={notifyComingSoon}
              >
                {isCurrent ? 'Current plan' : plan === PlanType.ENTERPRISE ? 'Contact sales' : 'Upgrade'}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
