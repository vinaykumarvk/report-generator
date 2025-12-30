export function enqueueJob(params: {
  type: string;
  priority?: number;
  payloadJson: unknown;
  runId?: string | null;
  sectionRunId?: string | null;
  workspaceId?: string | null;
  maxAttempts?: number;
}): Promise<{
  id: string;
  type: string;
  status: string;
  priority: number;
  payloadJson: unknown;
  runId: string | null;
  sectionRunId: string | null;
  attemptCount: number;
  maxAttempts: number;
  lockedBy: string | null;
  lockedAt: string | null;
  lockExpiresAt: string | null;
  scheduledAt: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  workspaceId?: string | null;
}>;

export function claimNextJob(workerId: string): Promise<{
  id: string;
  type: string;
  status: string;
  priority: number;
  payloadJson: unknown;
  runId: string | null;
  sectionRunId: string | null;
  attemptCount: number;
  maxAttempts: number;
  lockedBy: string;
  lockedAt: string;
  lockExpiresAt: string;
  scheduledAt: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  workspaceId?: string | null;
} | null>;

export function completeJob(job: {
  id: string;
  [key: string]: unknown;
}): Promise<void>;

export function failJob(job: {
  id: string;
  attemptCount: number;
  maxAttempts: number;
  [key: string]: unknown;
}, error: string): Promise<void>;

export function heartbeat(job: {
  id: string;
  [key: string]: unknown;
}): Promise<void>;

