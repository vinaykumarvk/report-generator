const endpoints = {
  providers: "/api/model-providers",
  modelConfigs: "/api/model-configs",
  profiles: "/api/generation-profiles",
  workspaces: "/api/workspaces",
  templates: "/api/templates",
};

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

function showToast(message, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.style.borderColor = isError ? "#f87171" : "#22d3ee";
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2500);
}

function setSelectOptions(selectEl, options, valueKey = "id", labelKey = "name") {
  selectEl.innerHTML = "";
  options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt[valueKey];
    option.textContent = opt[labelKey];
    selectEl.appendChild(option);
  });
}

function renderProviders(data) {
  const ul = document.getElementById("provider-list");
  ul.innerHTML = "";
  data.forEach((provider) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${provider.name}</strong> (${provider.region})<br/>Models: ${provider.models
      .map((m) => m.name)
      .join(", ")}`;
    ul.appendChild(li);
  });
}

function renderModelConfigs(data) {
  const ul = document.getElementById("model-config-list");
  ul.innerHTML = "";
  data.forEach((config) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${config.model}</strong> (${config.id})<br/>Temp: ${config.temperature} · Strictness: ${
      config.strictness
    }<br/>Verification: citations=${!!config.verification?.citationRequired}, reviewer=${
      !!config.verification?.reviewerSimulation
    }`;
    ul.appendChild(li);
  });
}

function renderProfiles(data) {
  const container = document.getElementById("profiles");
  container.innerHTML = "";
  data.forEach((profile) => {
    const div = document.createElement("div");
    div.className = "card";
    const toggles = profile.toggles || {};
    div.innerHTML = `
      <h3>${profile.name}</h3>
      <p>${profile.description || "No description"}</p>
      <p><strong>Toggles:</strong> verify=${toggles.enableVerification}, repair=${toggles.enableRepair}, reviewer=${toggles.enableReviewer}, citations=${toggles.enforceCitations}</p>
      <pre>${JSON.stringify(profile.stageConfig, null, 2)}</pre>
    `;
    container.appendChild(div);
  });
}

async function loadAll() {
  try {
    const [{ data: providers }, { data: modelConfigs }, { data: profiles }, { data: workspaces }, { data: templates }] =
      await Promise.all([
        fetchJson(endpoints.providers),
        fetchJson(endpoints.modelConfigs),
        fetchJson(endpoints.profiles),
        fetchJson(endpoints.workspaces),
        fetchJson(endpoints.templates),
      ]);

    renderProviders(providers);
    renderModelConfigs(modelConfigs);
    renderProfiles(profiles);

    const workspaceSelect = document.getElementById("workspace-select");
    setSelectOptions(workspaceSelect, workspaces);
    setSelectOptions(document.getElementById("workspace-profile"), profiles);
    setSelectOptions(document.getElementById("workspace-model"), modelConfigs, "id", "model");

    const templateSelect = document.getElementById("template-select");
    setSelectOptions(templateSelect, templates);
    setSelectOptions(document.getElementById("template-profile"), profiles);
    setSelectOptions(document.getElementById("template-model"), modelConfigs, "id", "model");
    setSelectOptions(document.getElementById("profile-stage-select"), profiles);

    workspaceSelect.value = workspaces[0]?.id;
    templateSelect.value = templates[0]?.id;

    await Promise.all([refreshWorkspaceDefaults(), refreshTemplateDefaults(), refreshPipelinePreview()]);
  } catch (err) {
    showToast(err.message, true);
  }
}

async function refreshWorkspaceDefaults() {
  const workspaceId = document.getElementById("workspace-select").value;
  if (!workspaceId) return;
  const res = await fetchJson(`/api/workspaces/${workspaceId}/defaults`);
  document.getElementById("workspace-profile").value = res.data.defaultProfileId;
  document.getElementById("workspace-model").value = res.data.defaultModelConfigId;
}

async function refreshTemplateDefaults() {
  const templateId = document.getElementById("template-select").value;
  if (!templateId) return;
  const res = await fetchJson(`/api/templates/${templateId}/defaults`);
  document.getElementById("template-profile").value = res.data.defaultProfileId;
  document.getElementById("template-model").value = res.data.defaultModelConfigId;
}

async function refreshPipelinePreview() {
  const templateId = document.getElementById("template-select").value;
  const profileId = document.getElementById("profile-stage-select").value;
  if (!templateId || !profileId) return;
  const res = await fetchJson(`/api/templates/${templateId}/profile-stages?profileId=${profileId}`);
  document.getElementById("pipeline-preview").textContent = JSON.stringify(res.data.resolved, null, 2);
  document.getElementById("stage-config-input").value = JSON.stringify(res.data.overrides, null, 2);
}

async function saveWorkspaceDefaults() {
  const workspaceId = document.getElementById("workspace-select").value;
  const defaultProfileId = document.getElementById("workspace-profile").value;
  const defaultModelConfigId = document.getElementById("workspace-model").value;
  await fetchJson(`/api/workspaces/${workspaceId}/defaults`, {
    method: "PUT",
    body: JSON.stringify({ defaultProfileId, defaultModelConfigId }),
  });
  showToast("Workspace defaults saved");
}

async function saveTemplateDefaults() {
  const templateId = document.getElementById("template-select").value;
  const defaultProfileId = document.getElementById("template-profile").value;
  const defaultModelConfigId = document.getElementById("template-model").value;
  await fetchJson(`/api/templates/${templateId}/defaults`, {
    method: "PUT",
    body: JSON.stringify({ defaultProfileId, defaultModelConfigId }),
  });
  showToast("Template defaults saved");
}

async function saveStageConfig() {
  const templateId = document.getElementById("template-select").value;
  const profileId = document.getElementById("profile-stage-select").value;
  const raw = document.getElementById("stage-config-input").value || "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    showToast("Invalid JSON for stage overrides", true);
    return;
  }
  await fetchJson(`/api/templates/${templateId}/profile-stages`, {
    method: "PUT",
    body: JSON.stringify({ profileId, stageConfig: parsed }),
  });
  showToast("Stage overrides saved");
  await refreshPipelinePreview();
}

document.addEventListener("DOMContentLoaded", () => {
  loadAll();

  document.getElementById("workspace-select").addEventListener("change", refreshWorkspaceDefaults);
  document.getElementById("template-select").addEventListener("change", async () => {
    await refreshTemplateDefaults();
    await refreshPipelinePreview();
  });
  document.getElementById("profile-stage-select").addEventListener("change", refreshPipelinePreview);
  document.getElementById("save-workspace-defaults").addEventListener("click", saveWorkspaceDefaults);
  document.getElementById("save-template-defaults").addEventListener("click", saveTemplateDefaults);
  document.getElementById("save-stage-config").addEventListener("click", saveStageConfig);
});
