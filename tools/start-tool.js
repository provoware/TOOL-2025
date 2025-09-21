#!/usr/bin/env node
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const {
  ensureDirectories,
  REQUIRED_DIRECTORIES,
  resolveProjectPath
} = require('./lib/prerequisites');

const DEFAULT_PORT = 4173;
const ROOT = path.resolve(resolveProjectPath());

const MIME_TYPES = new Map([
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

function resolveFilePath(requestUrl = '/') {
  try {
    const url = new URL(requestUrl, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) {
      pathname += 'index.html';
    }
    const normalized = path.normalize(path.join(ROOT, pathname));
    if (!normalized.startsWith(ROOT)) {
      return null;
    }
    return normalized;
  } catch (error) {
    console.error('[Start-Routine] Ungültige Anfrage', error);
    return null;
  }
}

async function serveFile(filePath) {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES.get(ext) || 'application/octet-stream';
    return { status: 200, headers: { 'Content-Type': type }, body: data };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: Buffer.from('404 – Datei nicht gefunden')
      };
    }
    console.error('[Start-Routine] Fehler beim Lesen der Datei:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: Buffer.from('500 – Interner Serverfehler')
    };
  }
}

async function requestHandler(req, res) {
  const filePath = resolveFilePath(req.url ?? '/');
  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('400 – Ungültige Anfrage');
    return;
  }
  const result = await serveFile(filePath);
  res.writeHead(result.status, result.headers);
  res.end(result.body);
}

async function findAvailablePort(startPort) {
  let port = startPort;
  while (port < startPort + 20) {
    const isFree = await new Promise((resolve) => {
      const tester = http.createServer();
      tester.once('error', () => {
        tester.close();
        resolve(false);
      });
      tester.once('listening', () => {
        tester.close(() => resolve(true));
      });
      tester.listen(port, '0.0.0.0');
    });
    if (isFree) {
      return port;
    }
    port += 1;
  }
  throw new Error('Kein freier Port im Bereich 4173–4193 gefunden.');
}

function openBrowser(url) {
  const platform = os.platform();
  const map = {
    darwin: { cmd: 'open', args: [url] },
    win32: { cmd: 'cmd', args: ['/c', 'start', '', url] },
    linux: { cmd: 'xdg-open', args: [url] }
  };

  const entry = map[platform];
  if (!entry) {
    console.warn(`[Start-Routine] Bitte öffne die Adresse manuell im Browser: ${url}`);
    return;
  }

  const child = spawn(entry.cmd, entry.args, { stdio: 'ignore', detached: true });
  child.on('error', (error) => {
    console.warn(`[Start-Routine] Automatisches Öffnen fehlgeschlagen (${error.message}). Öffne bitte selbst: ${url}`);
  });
  child.unref();
}

async function start() {
  console.log('╭────────────────────────────────────────────╮');
  console.log('│ ModulTool Start-Routine                    │');
  console.log('╰────────────────────────────────────────────╯');
  console.log('→ Prüfe Standardverzeichnisse …');
  await ensureDirectories();
  console.log(`✓ Verzeichnisse bereit (${REQUIRED_DIRECTORIES.join(', ')})`);

  console.log('→ Suche freien Port …');
  const port = await findAvailablePort(DEFAULT_PORT);
  const server = http.createServer((req, res) => {
    requestHandler(req, res).catch((error) => {
      console.error('[Start-Routine] Unerwarteter Fehler:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 – Interner Serverfehler');
    });
  });

  server.listen(port, '0.0.0.0', () => {
    const url = `http://localhost:${port}/`;
    console.log(`✓ Server läuft unter ${url}`);
    console.log('→ Öffne Browser …');
    openBrowser(url);
    console.log('Alles bereit! Du kannst das ModulTool jetzt im Browser verwenden.');
  });

  const stop = () => {
    console.log('\nStoppe ModulTool …');
    server.close(() => {
      console.log('Server beendet. Bis zum nächsten Mal!');
      process.exit(0);
    });
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

start().catch((error) => {
  console.error('[Start-Routine] Start fehlgeschlagen:', error);
  process.exit(1);
});
