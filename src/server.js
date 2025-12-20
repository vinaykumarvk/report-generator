const http = require("http");
const fs = require("fs");
const path = require("path");
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
