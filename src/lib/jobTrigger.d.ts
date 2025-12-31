export type JobTriggerPayload = {
  id: string;
  type: string;
  runId?: string | null;
  sectionRunId?: string | null;
  workspaceId?: string | null;
};

export type JobTriggerResult = {
  ok: boolean;
  mode: string;
  status?: number;
  error?: string;
  reason?: string;
};

export function notifyJobQueued(job: JobTriggerPayload): Promise<JobTriggerResult>;
