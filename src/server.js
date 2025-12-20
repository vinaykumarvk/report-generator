const http = require("http");
const fs = require("fs");
const path = require("path");
const { readState, writeState, upsert, generateId } = require("./data/storage");
const { normalizeModelProvider, normalizeModelConfig, normalizeGenerationProfile, normalizeStageOverride } = require("./schema");
const { resolveProfileStages } = require("./pipeline");

const PORT = process.env.PORT || 3000;

function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        const json = JSON.parse(body);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

function serveStatic(req, res, url) {
  const filePath =
    url.pathname === "/" ? path.join(__dirname, "public", "index.html") : path.join(__dirname, "public", url.pathname);
  if (!filePath.startsWith(path.join(__dirname, "public"))) {
    notFound(res);
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      notFound(res);
      return;
    }
    const contentType = filePath.endsWith(".js")
      ? "application/javascript"
      : filePath.endsWith(".css")
        ? "text/css"
        : "text/html";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

async function handleApi(req, res, url) {
  const state = readState();
  if (req.method === "GET" && url.pathname === "/api/model-providers") {
    return sendJson(res, 200, { data: state.modelProviders });
  }

  if (req.method === "POST" && url.pathname === "/api/model-providers") {
    try {
      const body = await parseJson(req);
      const provider = normalizeModelProvider(body);
      provider.id = generateId("prov");
      upsert(state.modelProviders, provider);
      writeState(state);
      return sendJson(res, 201, { data: provider });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/model-configs") {
    const providerId = url.searchParams.get("providerId");
    const configs = providerId ? state.modelConfigs.filter((c) => c.providerId === providerId) : state.modelConfigs;
    return sendJson(res, 200, { data: configs });
  }

  if (req.method === "POST" && url.pathname === "/api/model-configs") {
    try {
      const body = await parseJson(req);
      const config = normalizeModelConfig(body);
      config.id = generateId("model");
      upsert(state.modelConfigs, config);
      writeState(state);
      return sendJson(res, 201, { data: config });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/generation-profiles") {
    return sendJson(res, 200, { data: state.generationProfiles });
  }

  if (req.method === "POST" && url.pathname === "/api/generation-profiles") {
    try {
      const body = await parseJson(req);
      const profile = normalizeGenerationProfile(body);
      profile.id = generateId("profile");
      upsert(state.generationProfiles, profile);
      writeState(state);
      return sendJson(res, 201, { data: profile });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/workspaces") {
    return sendJson(res, 200, { data: state.workspaces });
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/workspaces/") && url.pathname.endsWith("/defaults")) {
    const workspaceId = url.pathname.split("/")[3];
    const workspace = state.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return notFound(res);
    return sendJson(res, 200, {
      data: {
        workspaceId,
        defaultProfileId: workspace.defaultProfileId,
        defaultModelConfigId: workspace.defaultModelConfigId,
      },
    });
  }

  if (req.method === "PUT" && url.pathname.startsWith("/api/workspaces/") && url.pathname.endsWith("/defaults")) {
    try {
      const workspaceId = url.pathname.split("/")[3];
      const body = await parseJson(req);
      const workspace = state.workspaces.find((w) => w.id === workspaceId);
      if (!workspace) return notFound(res);
      workspace.defaultProfileId = body.defaultProfileId || workspace.defaultProfileId;
      workspace.defaultModelConfigId = body.defaultModelConfigId || workspace.defaultModelConfigId;
      writeState(state);
      return sendJson(res, 200, { data: workspace });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/templates") {
    return sendJson(res, 200, { data: state.templates });
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/templates/") && url.pathname.endsWith("/defaults")) {
    const templateId = url.pathname.split("/")[3];
    const template = state.templates.find((t) => t.id === templateId);
    if (!template) return notFound(res);
    return sendJson(res, 200, {
      data: {
        templateId,
        defaultProfileId: template.defaultProfileId,
        defaultModelConfigId: template.defaultModelConfigId,
      },
    });
  }

  if (req.method === "PUT" && url.pathname.startsWith("/api/templates/") && url.pathname.endsWith("/defaults")) {
    try {
      const templateId = url.pathname.split("/")[3];
      const body = await parseJson(req);
      const template = state.templates.find((t) => t.id === templateId);
      if (!template) return notFound(res);
      template.defaultProfileId = body.defaultProfileId || template.defaultProfileId;
      template.defaultModelConfigId = body.defaultModelConfigId || template.defaultModelConfigId;
      writeState(state);
      return sendJson(res, 200, { data: template });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (req.method === "PUT" && url.pathname.startsWith("/api/templates/") && url.pathname.endsWith("/profile-stages")) {
    try {
      const templateId = url.pathname.split("/")[3];
      const body = await parseJson(req);
      const template = state.templates.find((t) => t.id === templateId);
      if (!template) return notFound(res);
      if (!body.profileId) return sendJson(res, 400, { error: "profileId is required" });
      template.profileStages = template.profileStages || {};
      template.profileStages[body.profileId] = normalizeStageOverride(body.stageConfig);
      writeState(state);
      return sendJson(res, 200, { data: template.profileStages[body.profileId] });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/templates/") && url.pathname.endsWith("/profile-stages")) {
    const templateId = url.pathname.split("/")[3];
    const profileId = url.searchParams.get("profileId");
    const template = state.templates.find((t) => t.id === templateId);
    if (!template) return notFound(res);
    const resolved = resolveProfileStages(state, templateId, profileId);
    if (!resolved) return notFound(res);
    const overrides = (template.profileStages && template.profileStages[profileId]) || {};
    return sendJson(res, 200, { data: { resolved, overrides } });
  }

  if (req.method === "GET" && url.pathname === "/api/pipeline/preview") {
    const templateId = url.searchParams.get("templateId");
    const profileId = url.searchParams.get("profileId");
    const resolved = resolveProfileStages(state, templateId, profileId);
    if (!resolved) return sendJson(res, 400, { error: "Invalid templateId or profileId" });
    return sendJson(res, 200, { data: resolved });
  }

  notFound(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    return handleApi(req, res, url);
  }
  return serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
