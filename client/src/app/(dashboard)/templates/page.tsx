import type { Metadata } from 'next';

import { TemplateCard } from '@/features/templates/template-card';
import { PROJECT_TEMPLATES } from '@/features/templates/templates-data';

export const metadata: Metadata = {
  title: 'Templates',
};

export default function TemplatesPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Start from a pre-configured stack — pick one to prefill a new project.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROJECT_TEMPLATES.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </div>
  );
}
