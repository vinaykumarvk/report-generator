const DEFAULT_TIMEOUT_MS = 3000;

function getMode() {
  return String(process.env.JOB_TRIGGER_MODE || "db").toLowerCase();
}

function getTriggerUrl() {
  return String(process.env.WORKER_TRIGGER_URL || "");
}

function getTriggerSecret() {
  return String(process.env.WORKER_TRIGGER_SECRET || "");
}

function getTasksConfig() {
  return {
    project: String(process.env.CLOUD_TASKS_PROJECT || ""),
    location: String(process.env.CLOUD_TASKS_LOCATION || ""),
    queue: String(process.env.CLOUD_TASKS_QUEUE || ""),
    serviceAccountEmail: String(process.env.WORKER_TASK_SERVICE_ACCOUNT || ""),
  };
}

async function notifyJobQueued(job) {
  const mode = getMode();
  if (mode === "db" || mode === "none") {
    return { ok: true, mode };
  }

  if (mode === "http") {
    return triggerHttp(job, mode);
  }
  if (mode === "cloud-tasks" || mode === "tasks") {
    return triggerCloudTasks(job, mode);
  }

  console.warn(`[JobTrigger] Unsupported JOB_TRIGGER_MODE: ${mode}`);
  return { ok: false, mode, reason: "unsupported_mode" };
}

async function triggerHttp(job, mode) {
  const url = getTriggerUrl();
  if (!url) {
    console.warn("[JobTrigger] WORKER_TRIGGER_URL is not set.");
    return { ok: false, mode, reason: "missing_url" };
  }

  const secret = getTriggerSecret();
  const headers = {
    "content-type": "application/json",
  };
  if (secret) {
    headers["x-worker-trigger"] = secret;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jobId: job.id,
        type: job.type,
        runId: job.runId ?? null,
        sectionRunId: job.sectionRunId ?? null,
        workspaceId: job.workspaceId ?? null,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[JobTrigger] Worker trigger failed (${response.status}).`);
      return { ok: false, mode, status: response.status };
    }

    return { ok: true, mode, status: response.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[JobTrigger] Worker trigger error: ${message}`);
    return { ok: false, mode, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

async function triggerCloudTasks(job, mode) {
  const { project, location, queue, serviceAccountEmail } = getTasksConfig();
  const url = getTriggerUrl();
  if (!project || !location || !queue) {
    console.warn("[JobTrigger] CLOUD_TASKS_* settings are incomplete.");
    return { ok: false, mode, reason: "missing_tasks_config" };
  }
  if (!url) {
    console.warn("[JobTrigger] WORKER_TRIGGER_URL is not set.");
    return { ok: false, mode, reason: "missing_url" };
  }

  const taskPayload = {
    jobId: job.id,
    type: job.type,
    runId: job.runId ?? null,
    sectionRunId: job.sectionRunId ?? null,
    workspaceId: job.workspaceId ?? null,
  };

  const headers = { "content-type": "application/json" };
  const secret = getTriggerSecret();
  if (secret) {
    headers["x-worker-trigger"] = secret;
  }

  const body = Buffer.from(JSON.stringify(taskPayload)).toString("base64");
  const task = {
    httpRequest: {
      httpMethod: "POST",
      url,
      headers,
      body,
    },
  };

  if (serviceAccountEmail) {
    task.httpRequest.oidcToken = { serviceAccountEmail };
  }

  const tasksUrl = `https://cloudtasks.googleapis.com/v2/projects/${project}/locations/${location}/queues/${queue}/tasks`;
  const token = await getAccessToken();
  if (!token) {
    return { ok: false, mode, reason: "missing_access_token" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(tasksUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ task }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[JobTrigger] Cloud Tasks enqueue failed (${response.status}).`);
      return { ok: false, mode, status: response.status };
    }

    return { ok: true, mode, status: response.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[JobTrigger] Cloud Tasks enqueue error: ${message}`);
    return { ok: false, mode, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

async function getAccessToken() {
  if (process.env.CLOUD_TASKS_ACCESS_TOKEN) {
    return String(process.env.CLOUD_TASKS_ACCESS_TOKEN);
  }
  const metadataUrl =
    "http://metadata/computeMetadata/v1/instance/service-accounts/default/token";
  try {
    const response = await fetch(metadataUrl, {
      headers: { "metadata-flavor": "Google" },
    });
    if (!response.ok) {
      console.warn(`[JobTrigger] Metadata token fetch failed (${response.status}).`);
      return null;
    }
    const data = await response.json();
    return data.access_token || null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[JobTrigger] Metadata token fetch error: ${message}`);
    return null;
  }
}

module.exports = { notifyJobQueued };
