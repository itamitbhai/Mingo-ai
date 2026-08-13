import type { ITestSuitePlan } from 'shared';
import { Badge } from '@/components/ui/badge';

interface TestPlanSummaryProps {
  testPlan?: ITestSuitePlan[];
}

const PRIORITY_VARIANT: Record<string, 'default' | 'destructive' | 'warning' | 'secondary'> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'default',
  low: 'secondary',
};

/**
 * Real, dynamically-generated test plan preview for a Testing Agent generation (spec §24/§64) —
 * every suite/case shown here comes straight from the generation's own `testPlan`, never hardcoded.
 * Mirrors `DatabaseSchemaPreview.tsx`'s no-op-if-nothing-to-show pattern so `ChangePreview` can render
 * it unconditionally.
 */
export function TestPlanSummary({ testPlan }: TestPlanSummaryProps) {
  if (!testPlan?.length) return null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-card/30 p-2 text-xs">
      <p className="font-medium">Test plan:</p>

      <div className="flex flex-col gap-2">
        {testPlan.map((suite) => (
          <div key={suite.name} className="rounded border border-border/40 p-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-semibold">{suite.name}</span>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="capitalize">
                  {suite.type}
                </Badge>
                <Badge variant={PRIORITY_VARIANT[suite.priority] ?? 'default'} className="capitalize">
                  {suite.priority}
                </Badge>
              </div>
            </div>
            {suite.tests.length > 0 && (
              <ul className="flex flex-col gap-0.5 text-muted-foreground">
                {suite.tests.map((test) => (
                  <li key={test}>· {test}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
