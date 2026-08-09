import { AlertCircle, CheckCircle2, HelpCircle, Sparkles } from 'lucide-react';
import type { IPlanRequirements } from 'shared';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RequirementListProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  items: string[];
  emptyLabel: string;
  accentClassName: string;
}

function RequirementList({ icon: Icon, title, description, items, emptyLabel, accentClassName }: RequirementListProps) {
  return (
    <Card className="bg-card/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className={`size-4 ${accentClassName}`} /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{emptyLabel}</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {items.map((item, index) => (
              <li key={index} className="flex gap-2">
                <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-current opacity-60" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface RequirementsSectionProps {
  requirements: IPlanRequirements | undefined;
  assumptions: string[] | undefined;
}

/** Explicit/inferred/missing/assumptions are always shown in visually distinct cards — inferred
 *  requirements are never presented as something the user stated (spec §45). */
export function RequirementsSection({ requirements, assumptions }: RequirementsSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <RequirementList
        icon={CheckCircle2}
        title="Explicit requirements"
        description="Stated directly in your request"
        items={requirements?.explicit ?? []}
        emptyLabel="Nothing explicit was detected."
        accentClassName="text-emerald-500"
      />
      <RequirementList
        icon={Sparkles}
        title="Inferred requirements"
        description="Reasonable additions Mingo AI inferred — not something you asked for directly"
        items={requirements?.inferred ?? []}
        emptyLabel="No inferred requirements."
        accentClassName="text-primary"
      />
      <RequirementList
        icon={HelpCircle}
        title="Missing information"
        description="Details your request didn't specify"
        items={requirements?.missing ?? []}
        emptyLabel="Nothing missing was flagged."
        accentClassName="text-amber-500"
      />
      <RequirementList
        icon={AlertCircle}
        title="Assumptions"
        description="What Mingo AI assumed to fill the gaps above"
        items={assumptions ?? []}
        emptyLabel="No assumptions were needed."
        accentClassName="text-muted-foreground"
      />
    </div>
  );
}
