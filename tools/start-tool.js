#!/usr/bin/env node
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const {
  ensureDirectories,
  REQUIRED_DIRECTORIES,
  resolveProjectPath
} = require('./lib/prerequisites');
const { ensureDependencies } = require('./lib/dependency-manager');
const { createStaticServer } = require('./lib/server');
const { findAvailablePort } = require('./lib/network');

const DEFAULT_PORT = 4173;
const ROOT = path.resolve(resolveProjectPath());

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
  await ensureDirectories(console);
  console.log(`✓ Verzeichnisse bereit (${REQUIRED_DIRECTORIES.join(', ')})`);

  console.log('→ Prüfe Abhängigkeiten …');
  const dependencyState = await ensureDependencies({ root: ROOT, logger: console });
  if (dependencyState.changed) {
    console.log('✓ Abhängigkeiten frisch installiert.');
  } else if (dependencyState.installed) {
    console.log('✓ Abhängigkeiten bereits vorhanden.');
  } else {
    console.warn('⚠️  Abhängigkeiten konnten nicht automatisch geprüft werden. Bitte führe „npm install“ manuell aus.');
  }

  console.log('→ Suche freien Port …');
  const port = await findAvailablePort(DEFAULT_PORT);
  const { server } = createStaticServer({
    root: ROOT,
    onRequestError: (error) => {
      console.error('[Start-Routine] EVENT:SERVER_ERROR –', error.message);
    }
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
