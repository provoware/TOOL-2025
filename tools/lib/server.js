#!/usr/bin/env node
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
  ['.woff', 'font/woff'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8']
]);

function buildMimeMap(custom = []) {
  const map = new Map(DEFAULT_MIME_TYPES);
  custom.forEach(([ext, value]) => {
    if (typeof ext === 'string' && typeof value === 'string') {
      map.set(ext.startsWith('.') ? ext : `.${ext}`, value);
    }
  });
  return map;
}

function resolveRequestPath(root, requestUrl = '/') {
  const url = new URL(requestUrl, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) {
    pathname += 'index.html';
  }
  const normalized = path.normalize(path.join(root, pathname));
  if (!normalized.startsWith(root)) {
    return null;
  }
  return normalized;
}

async function loadFile(filePath, mimeTypes) {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = mimeTypes.get(ext) || 'application/octet-stream';
    return { status: 200, headers: { 'Content-Type': type }, body: data };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: Buffer.from('404 – Datei nicht gefunden')
      };
    }
    throw error;
  }
}

function createStaticServer(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const mimeTypes = buildMimeMap(options.mimeTypes || []);
  const onRequestError = typeof options.onRequestError === 'function' ? options.onRequestError : (error) => {
    console.error('[StaticServer] Fehler beim Ausliefern:', error);
  };

  async function handle(req, res) {
    const filePath = resolveRequestPath(root, req.url || '/');
    if (!filePath) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('400 – Ungültige Anfrage');
      return;
    }
    try {
      const result = await loadFile(filePath, mimeTypes);
      res.writeHead(result.status, result.headers);
      res.end(result.body);
    } catch (error) {
      onRequestError(error);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 – Interner Serverfehler');
    }
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      onRequestError(error);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 – Interner Serverfehler');
    });
  });

  return { server, resolveRequestPath: (url) => resolveRequestPath(root, url), mimeTypes };
}

module.exports = {
  DEFAULT_MIME_TYPES,
  createStaticServer,
  resolveRequestPath,
  loadFile
};
