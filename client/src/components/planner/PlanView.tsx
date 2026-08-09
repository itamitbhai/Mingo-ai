'use client';

import type { IProjectPlan, TaskPriority } from 'shared';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiSection } from './ApiSection';
import { ArchitectureSection } from './ArchitectureSection';
import { DatabaseSection } from './DatabaseSection';
import { FeatureList } from './FeatureList';
import { FileStructureSection } from './FileStructureSection';
import { PlanApprovalBar } from './PlanApprovalBar';
import { PlanOverview } from './PlanOverview';
import { RequirementsSection } from './RequirementsSection';
import { RiskList } from './RiskList';
import { StackSection } from './StackSection';
import { TaskList } from './TaskList';

interface PlanViewProps {
  plan: IProjectPlan;
  isSubmitting: boolean;
  onApprove: () => void;
  onReject: () => void;
  onRegenerate: () => void;
  onEditFeature: (edit: { id: string; title?: string; description?: string; priority?: TaskPriority }) => void;
  onEditTask: (edit: { id: string; title?: string; description?: string; acceptanceCriteria?: string[] }) => void;
}

export function PlanView({
  plan,
  isSubmitting,
  onApprove,
  onReject,
  onRegenerate,
  onEditFeature,
  onEditTask,
}: PlanViewProps) {
  const editable = plan.status === 'ready';

  return (
    <div className="flex flex-col gap-4">
      <PlanOverview plan={plan} />
      <PlanApprovalBar
        plan={plan}
        isSubmitting={isSubmitting}
        onApprove={onApprove}
        onReject={onReject}
        onRegenerate={onRegenerate}
      />

      <Tabs defaultValue="requirements">
        <TabsList className="flex-wrap">
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="stack">Stack</TabsTrigger>
          <TabsTrigger value="architecture">Architecture</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="files">File Structure</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
        </TabsList>

        <TabsContent value="requirements">
          <RequirementsSection requirements={plan.requirements} assumptions={plan.assumptions} />
        </TabsContent>
        <TabsContent value="stack">
          <StackSection stack={plan.stack} />
        </TabsContent>
        <TabsContent value="architecture">
          <ArchitectureSection architecture={plan.architecture} />
        </TabsContent>
        <TabsContent value="features">
          <FeatureList features={plan.features} editable={editable} onEdit={onEditFeature} />
        </TabsContent>
        <TabsContent value="database">
          <DatabaseSection database={plan.database} />
        </TabsContent>
        <TabsContent value="api">
          <ApiSection api={plan.api} />
        </TabsContent>
        <TabsContent value="files">
          <FileStructureSection files={plan.files} />
        </TabsContent>
        <TabsContent value="tasks">
          <TaskList tasks={plan.tasks} executionOrder={plan.executionOrder} editable={editable} onEdit={onEditTask} />
        </TabsContent>
        <TabsContent value="risks">
          <RiskList
            risks={plan.risks}
            security={plan.security}
            nonFunctionalRequirements={plan.nonFunctionalRequirements}
            conflicts={plan.conflicts}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
