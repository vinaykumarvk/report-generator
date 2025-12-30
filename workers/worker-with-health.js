/**
 * Worker with HTTP Health Check
 * 
 * This wrapper runs the worker process while also providing
 * a minimal HTTP server for Cloud Run health checks.
 */

const http = require('http');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 8080;

// Start the actual worker process
console.log('🚀 Starting worker process...');
const worker = spawn('node', ['workers/worker.js'], {
  stdio: 'inherit',
  env: process.env
});

worker.on('exit', (code) => {
  console.error(`❌ Worker process exited with code ${code}`);
  process.exit(code ?? 1);
});

// Create a minimal HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'report-generator-worker',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`✅ Health check server listening on port ${PORT}`);
  console.log(`   Worker process is running in the background`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📥 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Health check server closed');
    worker.kill('SIGTERM');
  });
});

process.on('SIGINT', () => {
  console.log('📥 Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Health check server closed');
    worker.kill('SIGINT');
  });
});

