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
const { randomUUID } = require("crypto");
const {
  listTemplates,
  createTemplate,
  getTemplateById,
  listSections,
  createSection,
  updateSection,
  upsertTemplate,
} = require("./storage");
const { validateTemplate } = require("./validation");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res, parsedUrl) {
  let pathname = parsedUrl.pathname;
  if (pathname === "/") {
    pathname = "/index.html";
  }
  const filePath = path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
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
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const contentType =
      ext === ".html"
        ? "text/html"
        : ext === ".css"
        ? "text/css"
        : ext === ".js"
        ? "application/javascript"
        : "text/plain";
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
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function handleApi(req, res, parsedUrl) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  const parts = parsedUrl.pathname.split("/").filter(Boolean);
  if (parts[0] !== "api") {
    res.writeHead(404);
    res.end();
    return;
  }

  if (parts[1] === "templates" && parts.length === 2) {
    if (req.method === "GET") {
      const templates = listTemplates().map((template) => ({
        ...template,
        sections: listSections(template.id),
      }));
      sendJson(res, 200, templates);
      return;
    }
    if (req.method === "POST") {
      try {
        const body = await parseBody(req);
        if (!body.name) {
          sendJson(res, 400, { error: "Template name is required." });
          return;
        }
        const formats = Array.isArray(body.formats)
          ? body.formats
          : body.formats
          ? String(body.formats)
              .split(",")
              .map((f) => f.trim())
              .filter(Boolean)
          : [];
        const template = createTemplate({
          name: body.name,
          description: body.description || "",
          formats,
        });
        sendJson(res, 201, template);
      } catch (err) {
        sendJson(res, 500, { error: "Failed to create template" });
      }
      return;
    }
  }

  if (parts[1] === "templates" && parts.length >= 3) {
    const templateId = parts[2];
    const template = getTemplateById(templateId);
    if (!template) {
      sendJson(res, 404, { error: "Template not found" });
      return;
    }

    // GET single template
    if (req.method === "GET" && parts.length === 3) {
      sendJson(res, 200, { ...template, sections: listSections(templateId) });
      return;
    }

    // Sections routes
    if (parts[3] === "sections") {
      if (req.method === "GET" && parts.length === 4) {
        sendJson(res, 200, listSections(templateId));
        return;
      }
      if (req.method === "POST" && parts.length === 4) {
        try {
          const body = await parseBody(req);
          if (!body.title) {
            sendJson(res, 400, { error: "Section title is required." });
            return;
          }
          const formats = Array.isArray(body.formats)
            ? body.formats
            : body.formats
            ? String(body.formats)
                .split(",")
                .map((f) => f.trim())
                .filter(Boolean)
            : [];
          const section = createSection(templateId, {
            ...body,
            formats,
          });
          sendJson(res, 201, section);
        } catch (err) {
          sendJson(res, 500, { error: "Failed to create section" });
        }
        return;
      }
      if (req.method === "PUT" && parts.length === 5) {
        const sectionId = parts[4];
        try {
          const body = await parseBody(req);
          const formats = Array.isArray(body.formats)
            ? body.formats
            : body.formats
            ? String(body.formats)
                .split(",")
                .map((f) => f.trim())
                .filter(Boolean)
            : undefined;
          const updated = updateSection(templateId, sectionId, {
            ...body,
            ...(formats ? { formats } : {}),
          });
          if (!updated) {
            sendJson(res, 404, { error: "Section not found" });
            return;
          }
          sendJson(res, 200, updated);
        } catch (err) {
          sendJson(res, 500, { error: "Failed to update section" });
        }
        return;
      }
    }

    // Validate template
    if (parts[3] === "validate" && req.method === "POST") {
      const sections = listSections(templateId);
      const result = validateTemplate(template, sections);
      sendJson(res, 200, result);
      return;
    }

    // Publish template
    if (parts[3] === "publish" && req.method === "POST") {
      const sections = listSections(templateId);
      const result = validateTemplate(template, sections);
      if (!result.valid) {
        sendJson(res, 400, {
          error: "Validation failed",
          issues: result.issues,
        });
        return;
      }
      const now = new Date().toISOString();
      const publishedTemplate = {
        ...template,
        status: "PUBLISHED",
        publishedAt: now,
        version: (template.version || 1) + 1,
        updatedAt: now,
      };
      upsertTemplate(publishedTemplate);
      sendJson(res, 200, {
        message: "Template published",
        template: publishedTemplate,
      });
      return;
    }
  }

  sendJson(res, 404, { error: "Route not found" });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  if (parsedUrl.pathname.startsWith("/api/")) {
    return handleApi(req, res, parsedUrl);
  }
  return serveStatic(req, res, parsedUrl);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
