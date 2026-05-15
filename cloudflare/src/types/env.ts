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
  QUEUE_GRC_CONTENT_IMPORT?: Queue<GrcQueueMessage>;
  QUEUE_GRC_SCF_REFRESH?: Queue<GrcQueueMessage>;
  QUEUE_GRC_FINDING_INGEST?: Queue<GrcQueueMessage>;
  QUEUE_GRC_GAP_REPORT?: Queue<GrcQueueMessage>;
  QUEUE_GRC_AI_ENRICH?: Queue<GrcQueueMessage>;
  TENANT_WORKFLOW_COORDINATOR: DurableObjectNamespace<TenantWorkflowCoordinator>;
  AI?: AiBinding;
  EVIDENCE_VECTOR_INDEX?: VectorizeBinding;
  BOOTSTRAP_SETUP_SECRET?: string;
  OPENAI_API_KEY?: string;
  OPENAI_API_BASE_URL?: string;
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

export type QueueMessagePayload = EvidenceJobMessage | ConMonJobMessage | GrcQueueMessage;

export type GrcQueueMessage =
  | {
      type: 'grc.content.import';
      tenantId: string;
      requestedBy: string | null;
      jobId?: string;
    }
  | {
      type: 'grc.scf.refresh';
      tenantId: string;
      requestedBy: string | null;
      frameworkIds?: string[];
      jobId?: string;
    }
  | {
      type: 'grc.finding.ingest';
      tenantId: string;
      requestedBy: string | null;
      payloadId: string;
      jobId?: string;
    }
  | {
      type: 'grc.gap.report';
      tenantId: string;
      assessmentId?: string;
      requestedBy: string | null;
      reportKind?: string;
      jobId?: string;
    }
  | {
      type: 'grc.evidence.package';
      tenantId: string;
      assessmentId: string;
      requestedBy: string | null;
      jobId?: string;
    }
  | {
      type: 'grc.ai.enrich';
      tenantId: string;
      bundleId: string;
      requestedBy: string | null;
      jobId?: string;
    }
  | {
      type: 'grc.connector.collect';
      tenantId: string;
      source: string;
      requestedBy: string | null;
      jobId?: string;
    };
