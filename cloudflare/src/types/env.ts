import type { TenantWorkflowCoordinator } from '../durable-objects/TenantWorkflowCoordinator';

export type AiBinding = {
  run(model: string, input: unknown): Promise<unknown>;
};

export type VectorizeMatchRecord = {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
};

export type VectorizeBinding = {
  describe(): Promise<{ vectorsCount?: number; vectorCount?: number }>;
  query(
    vector: number[],
    options?: {
      topK?: number;
      namespace?: string;
      returnValues?: boolean;
      returnMetadata?: boolean | 'all' | 'indexed' | 'none';
      filter?: Record<string, unknown>;
    },
  ): Promise<{ matches: VectorizeMatchRecord[]; count: number }>;
  upsert(
    vectors: Array<{
      id: string;
      values: number[];
      namespace?: string;
      metadata?: Record<string, string | number | boolean | null>;
    }>,
  ): Promise<unknown>;
};

export type EnvBindings = {
  APP_ENV: string;
  APP_ORIGIN?: string;
  ASSETS: Fetcher;
  D1_MAIN: D1Database;
  R2_EVIDENCE: R2Bucket;
  QUEUE_EVIDENCE_JOBS: Queue<EvidenceJobMessage>;
  QUEUE_CONMON_JOBS: Queue<ConMonJobMessage>;
  TENANT_WORKFLOW_COORDINATOR: DurableObjectNamespace<TenantWorkflowCoordinator>;
  AI?: AiBinding;
  EVIDENCE_VECTOR_INDEX?: VectorizeBinding;
  BOOTSTRAP_SETUP_SECRET?: string;
};

export type AuthStrategy = 'headers' | 'd1-session' | 'anonymous';

export type EvidenceJobMessage = {
  type: 'evidence.job.run';
  tenantId: string;
  sourceId: string;
  jobId: string;
  requestedBy: string | null;
};

export type ConMonJobMessage = {
  type: 'conmon.execution.run';
  tenantId: string;
  profileId: string;
  activityId: string;
  executionId: string;
  requestedBy: string | null;
};

export type QueueMessagePayload = EvidenceJobMessage | ConMonJobMessage;
