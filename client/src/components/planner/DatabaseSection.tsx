import { ArrowRight, Database } from 'lucide-react';
import type { IPlanDatabase } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface DatabaseSectionProps {
  database: IPlanDatabase | undefined;
}

export function DatabaseSection({ database }: DatabaseSectionProps) {
  const entities = database?.entities ?? [];
  const relationships = database?.relationships ?? [];

  if (entities.length === 0) {
    return <p className="text-sm text-muted-foreground">No database entities were planned.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {entities.map((entity) => (
          <Card key={entity.name} className="bg-card/60">
            <CardContent className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Database className="size-3.5 text-primary" /> {entity.name}
              </p>
              <ul className="flex flex-col gap-1 text-xs">
                {entity.fields.map((field) => (
                  <li key={field.name} className="flex items-center justify-between gap-2 border-b border-border/40 py-1">
                    <span className="font-mono">
                      {field.name}
                      {field.required && <span className="text-destructive">*</span>}
                    </span>
                    <span className="text-muted-foreground">{field.type}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {relationships.length > 0 && (
        <Card className="bg-card/60">
          <CardContent className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Relationships</p>
            <ul className="flex flex-col gap-1.5 text-sm">
              {relationships.map((rel, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="font-medium">{rel.from}</span>
                  <Badge variant="outline">{rel.type}</Badge>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <span className="font-medium">{rel.to}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
