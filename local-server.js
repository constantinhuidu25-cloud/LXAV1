// Local development server pentru testare fara a depinde de platforma de hosting
// Simuleaza functia API local + serve static files

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const handler = require('./functions/drolly-account.js').handler;

const PORT = 8888;

// MIME types pentru fișiere statice
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

function serveStaticFile(pathname, res) {
  pathname = decodeURIComponent(pathname);

  // Default to index.html for root
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const filePath = path.join(__dirname, pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);

  // Handle API requests
  if (parsedUrl.pathname === '/api/drolly-account') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const event = {
          httpMethod: req.method,
          headers: req.headers,
          body: body,
          queryStringParameters: parsedUrl.query
        };

        console.log(`[${new Date().toISOString()}] ${req.method} ${parsedUrl.pathname}`,
                    body ? JSON.parse(body).action : parsedUrl.query.action || 'leaderboard');

        const response = await handler(event);

        res.writeHead(response.statusCode, response.headers);
        res.end(response.body);
      } catch (error) {
        console.error('Handler error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  } else {
    // Serve static files
    serveStaticFile(parsedUrl.pathname, res);
  }
});

server.listen(PORT, () => {
  console.log(`\n🎰 LXA Local Server Running`);
  console.log(`📡 API: http://localhost:${PORT}/api/drolly-account`);
  console.log(`📊 Using production Firebase storage (same backend as live)\n`);
});
