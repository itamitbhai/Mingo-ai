import { ArrowRight, Box } from 'lucide-react';
import type { IPlanArchitecture } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface ArchitectureSectionProps {
  architecture: IPlanArchitecture | undefined;
}

/**
 * Nodes/edges rendered as a clean connector-styled list rather than a React Flow canvas — the
 * dependency isn't installed today and the spec itself hedges ("if appropriate"). This is still a
 * real, complete representation of the generated graph data.
 */
export function ArchitectureSection({ architecture }: ArchitectureSectionProps) {
  const nodes = architecture?.nodes ?? [];
  const edges = architecture?.edges ?? [];
  const labelById = new Map(nodes.map((node) => [node.id, node.label]));

  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">No architecture was generated.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {architecture?.description && (
        <p className="text-sm text-muted-foreground">{architecture.description}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {nodes.map((node) => (
          <Badge key={node.id} variant="outline" className="gap-1.5 py-1.5">
            <Box className="size-3" />
            {node.label}
            {node.type && <span className="text-muted-foreground">· {node.type}</span>}
          </Badge>
        ))}
      </div>

      {edges.length > 0 && (
        <Card className="bg-card/60">
          <CardContent className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Connections</p>
            <ul className="flex flex-col gap-1.5 text-sm">
              {edges.map((edge, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="font-medium">{labelById.get(edge.from) ?? edge.from}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{labelById.get(edge.to) ?? edge.to}</span>
                  {edge.label && <span className="text-xs text-muted-foreground">({edge.label})</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
