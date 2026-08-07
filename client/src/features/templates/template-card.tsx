'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCreateProjectStore } from '@/store/use-create-project-store';
import { getTechStackBadges } from '@/utils/tech-stack';
import type { ProjectTemplate } from './templates-data';

export function TemplateCard({ template }: { template: ProjectTemplate }) {
  const open = useCreateProjectStore((state) => state.open);
  const badges = getTechStackBadges(template.stack);

  return (
    <Card className="flex h-full flex-col bg-card/60">
      <CardHeader>
        <CardTitle>{template.name}</CardTitle>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <span
              key={badge.key}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
            >
              <badge.icon className="size-3" />
              {badge.label}
            </span>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={() => open(template.stack)}>
          Use this template
        </Button>
      </CardFooter>
    </Card>
  );
}
