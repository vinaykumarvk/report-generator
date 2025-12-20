const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const {
  listPromptSets,
  findPromptSet,
  createPromptSet,
  updatePromptSet,
  publishPromptSet,
  rollbackPromptSet,
  renderedSectionPrompt,
} = require('./promptSets');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, payload, contentType = 'text/plain') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
  });
  res.end(payload);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 1e6) {
        req.socket.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });
  });
}

function handleApi(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (req.method === 'OPTIONS') {
    return sendText(res, 200, 'ok');
  }

  if (req.method === 'GET' && pathname === '/api/prompt-sets') {
    return sendJson(res, 200, { promptSets: listPromptSets() });
  }

  if (req.method === 'POST' && pathname === '/api/prompt-sets') {
    return parseJsonBody(req)
      .then((body) => {
        const created = createPromptSet({ name: body.name, sections: body.sections });
        sendJson(res, 201, created);
      })
      .catch(() => sendJson(res, 400, { error: 'Invalid JSON body' }));
  }

  const promptSetMatch = pathname.match(/^\/api\/prompt-sets\/([^/]+)(.*)$/);
  if (promptSetMatch) {
    const promptSetId = promptSetMatch[1];
    const remainder = promptSetMatch[2] || '';
    const promptSet = findPromptSet(promptSetId);
    if (!promptSet) {
      return sendJson(res, 404, { error: 'Prompt set not found' });
    }

    if (req.method === 'GET' && remainder === '') {
      return sendJson(res, 200, promptSet);
    }

    if (req.method === 'PUT' && remainder === '') {
      return parseJsonBody(req)
        .then((body) => {
          const updated = updatePromptSet(promptSetId, body, body.note);
          sendJson(res, 200, updated);
        })
        .catch(() => sendJson(res, 400, { error: 'Invalid JSON body' }));
    }

    if (req.method === 'POST' && remainder === '/publish') {
      return parseJsonBody(req)
        .then((body) => {
          const published = publishPromptSet(promptSetId, body.note);
          sendJson(res, 200, published);
        })
        .catch(() => sendJson(res, 400, { error: 'Invalid JSON body' }));
    }

    if (req.method === 'POST' && remainder === '/rollback') {
      return parseJsonBody(req)
        .then((body) => {
          const targetVersion = body && body.version ? Number(body.version) : null;
          if (!targetVersion) {
            return sendJson(res, 400, { error: 'version is required' });
          }
          const rolled = rollbackPromptSet(promptSetId, targetVersion, body.note);
          if (!rolled) return sendJson(res, 404, { error: 'Version not found' });
          sendJson(res, 200, rolled);
        })
        .catch(() => sendJson(res, 400, { error: 'Invalid JSON body' }));
    }

    if (req.method === 'GET' && remainder === '/history') {
      return sendJson(res, 200, { history: promptSet.history });
    }

    const sectionMatch = remainder.match(/^\/sections\/([^/]+)\/rendered$/);
    if (req.method === 'GET' && sectionMatch) {
      const sectionId = sectionMatch[1];
      const rendered = renderedSectionPrompt(promptSetId, sectionId);
      if (!rendered) return sendJson(res, 404, { error: 'Section not found' });
      return sendJson(res, 200, rendered);
    }
  }

  return sendJson(res, 404, { error: 'Not found' });
}

function serveStatic(req, res) {
  const parsedUrl = url.parse(req.url);
  let pathname = `${parsedUrl.pathname}`;

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendText(res, 403, 'Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return sendText(res, 404, 'Not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
    };
    const contentType = contentTypeMap[ext] || 'text/plain';
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        return sendText(res, 500, 'Server error');
      }
      sendText(res, 200, data, contentType);
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    return handleApi(req, res);
  }
  return serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Prompt set service running on http://localhost:${PORT}`);
});
