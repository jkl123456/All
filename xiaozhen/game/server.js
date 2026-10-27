// 一个零依赖的静态服务器，直接把 game/ 目录作为站点根目录。
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5173;

const zlib = require('zlib');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(ROOT))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(resolved, (err, stats) => {
    if (err || stats.isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const gz = stats.size > 1400 && /json|javascript|gltf|glb|svg|css|html/.test(type) &&
      /gzip/.test(req.headers['accept-encoding'] || '');

    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
      ...(gz ? { 'Content-Encoding': 'gzip' } : {}),
    });
    if (gz) {
      fs.createReadStream(resolved).pipe(zlib.createGzip({ level: 6 })).pipe(res);
    } else {
      fs.createReadStream(resolved).pipe(res);
    }
  });
});

server.listen(PORT, () => {
  console.log(`苔溪镇已启动： http://localhost:${PORT}/`);
});
