import { AlertTriangle, ShieldAlert, ShieldCheck, Zap } from 'lucide-react';
import type { IPlanConflict, IPlanNonFunctionalRequirement, IPlanRisk, IPlanSecurityRequirement, RiskSeverity } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const SEVERITY_VARIANT: Record<RiskSeverity, 'destructive' | 'warning' | 'default' | 'outline'> = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'warning',
  low: 'outline',
};

interface RiskListProps {
  risks: IPlanRisk[] | undefined;
  security: IPlanSecurityRequirement[] | undefined;
  nonFunctionalRequirements: IPlanNonFunctionalRequirement[] | undefined;
  conflicts: IPlanConflict[] | undefined;
}

export function RiskList({ risks, security, nonFunctionalRequirements, conflicts }: RiskListProps) {
  const hasConflicts = conflicts && conflicts.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {hasConflicts && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
              <AlertTriangle className="size-4" /> Technology conflicts detected
            </p>
            {conflicts.map((conflict, index) => (
              <div key={index} className="text-sm">
                <p>{conflict.description}</p>
                {conflict.optionsDetected.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {conflict.optionsDetected.map((option, i) => (
                      <Badge key={i} variant="destructive">
                        {option}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <AlertTriangle className="size-3.5" /> Risks
        </p>
        {!risks || risks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No risks were identified.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {risks.map((risk, index) => (
              <div key={index} className="rounded-lg border border-border/60 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant={SEVERITY_VARIANT[risk.severity]} className="capitalize">
                    {risk.severity}
                  </Badge>
                  <p className="text-sm font-medium">{risk.description}</p>
                </div>
                {risk.mitigation && <p className="text-xs text-muted-foreground">Mitigation: {risk.mitigation}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <ShieldAlert className="size-3.5" /> Security requirements
        </p>
        {!security || security.length === 0 ? (
          <p className="text-sm text-muted-foreground">No security requirements were identified.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {security.map((item, index) => (
              <Badge key={index} variant="outline" className="gap-1">
                <ShieldCheck className="size-3" /> {item.requirement}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Zap className="size-3.5" /> Non-functional requirements
        </p>
        {!nonFunctionalRequirements || nonFunctionalRequirements.length === 0 ? (
          <p className="text-sm text-muted-foreground">None identified.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {nonFunctionalRequirements.map((item, index) => (
              <li key={index}>
                <Badge variant="outline" className="mr-2 capitalize">
                  {item.category}
                </Badge>
                {item.description}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
