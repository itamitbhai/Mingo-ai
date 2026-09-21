import { EventEmitter } from 'node:events';
import { DeploymentEventType, DeploymentStage } from 'shared';

/** In-process pub/sub for live deployment events (Phase 13 spec §11/§34) — identical shape to
 *  `sandbox/sandbox.events.ts`/`orchestrator/orchestrator.events.ts`. No Socket.IO anywhere in this
 *  codebase (see the Phase 12/13 plan's Context); every real-time feature uses this same SSE +
 *  EventEmitter pattern. */
export interface IDeploymentEvent {
  type: DeploymentEventType;
  deploymentId: string;
  message: string;
  stage?: DeploymentStage;
  /** A chunk of real build/deploy output — never a raw error object, secret, or env (spec §8/§32). */
  chunk?: string;
  timestamp: string;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

function channel(deploymentId: string): string {
  return `deployment:${deploymentId}`;
}

export function subscribe(deploymentId: string, listener: (event: IDeploymentEvent) => void): () => void {
  emitter.on(channel(deploymentId), listener);
  return () => emitter.off(channel(deploymentId), listener);
}

export function publish(
  deploymentId: string,
  partial: Omit<IDeploymentEvent, 'deploymentId' | 'timestamp'>
): IDeploymentEvent {
  const event: IDeploymentEvent = { ...partial, deploymentId, timestamp: new Date().toISOString() };
  emitter.emit(channel(deploymentId), event);
  return event;
}
