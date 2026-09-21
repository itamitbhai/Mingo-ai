'use client';

import { useState } from 'react';
import { DeploymentEnvironment } from 'shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeploymentConfigForm } from './deployment-config-form';
import { DeploymentHistoryPanel } from './deployment-history-panel';
import { DeploymentStatusPanel } from './deployment-status-panel';
import { EnvironmentVariablesPanel } from './environment-variables-panel';

const ENVIRONMENT_LABELS: Record<DeploymentEnvironment, string> = {
  [DeploymentEnvironment.PRODUCTION]: 'Production',
  [DeploymentEnvironment.PREVIEW]: 'Preview',
  [DeploymentEnvironment.DEVELOPMENT]: 'Development',
};

export function DeploymentShell({ projectId }: { projectId: string }) {
  const [environment, setEnvironment] = useState<DeploymentEnvironment>(DeploymentEnvironment.PRODUCTION);

  return (
    <Tabs value={environment} onValueChange={(value) => setEnvironment(value as DeploymentEnvironment)}>
      <TabsList>
        {Object.values(DeploymentEnvironment).map((env) => (
          <TabsTrigger key={env} value={env}>
            {ENVIRONMENT_LABELS[env]}
          </TabsTrigger>
        ))}
      </TabsList>

      {Object.values(DeploymentEnvironment).map((env) => (
        <TabsContent key={env} value={env} className="mt-4 space-y-4">
          <Card className="bg-card/60">
            <CardContent className="pt-6">
              <DeploymentStatusPanel projectId={projectId} environment={env} />
            </CardContent>
          </Card>

          <Card className="bg-card/60">
            <CardHeader>
              <CardTitle>Deploy Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <DeploymentConfigForm projectId={projectId} environment={env} />
            </CardContent>
          </Card>

          <Card className="bg-card/60">
            <CardContent className="pt-6">
              <EnvironmentVariablesPanel projectId={projectId} environment={env} />
            </CardContent>
          </Card>

          <Card className="bg-card/60">
            <CardHeader>
              <CardTitle>Deployment History</CardTitle>
            </CardHeader>
            <CardContent>
              <DeploymentHistoryPanel projectId={projectId} environment={env} />
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}
