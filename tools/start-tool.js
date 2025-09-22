#!/usr/bin/env node
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const {
  ensureDirectories,
  resolveProjectPath,
  checkRequiredFiles
} = require('./lib/prerequisites');
const { ensureDependencies } = require('./lib/dependency-manager');
const { createStaticServer } = require('./lib/server');
const { findAvailablePort } = require('./lib/network');

const DEFAULT_PORT = 4173;
const ROOT = path.resolve(resolveProjectPath());

function createReporter(logger = console) {
  const startTime = Date.now();
  const prefix = '[Start-Routine]';

  const format = (label, message) => `${prefix} ${label} – ${message}`;

  return {
    step(id, message) {
      logger.log?.(format(`EVENT:${id}`, message));
    },
    success(id, message) {
      logger.log?.(format(`OK:${id}`, message));
    },
    warn(id, message) {
      logger.warn?.(format(`WARN:${id}`, message));
    },
    error(id, message) {
      logger.error?.(format(`ERROR:${id}`, message));
    },
    summary(message = 'ModulTool bereit.') {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.log?.(format(`DONE:${duration}s`, message));
    }
  };
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
    console.warn(`[Start-Routine] WARN:BROWSER_OPEN – Bitte öffne die Adresse manuell im Browser: ${url}`);
    return;
  }

  const child = spawn(entry.cmd, entry.args, { stdio: 'ignore', detached: true });
  child.on('error', (error) => {
    console.warn(`[Start-Routine] WARN:BROWSER_OPEN – Automatisches Öffnen fehlgeschlagen (${error.message}). Öffne bitte selbst: ${url}`);
  });
  child.unref();
}

async function start() {
  const reporter = createReporter(console);

  console.log('╭────────────────────────────────────────────╮');
  console.log('│ ModulTool Start-Routine                    │');
  console.log('╰────────────────────────────────────────────╯');

  reporter.step('DIRECTORY_CHECK', 'Prüfe Standardverzeichnisse …');
  const directoryResults = await ensureDirectories(console);
  directoryResults.forEach((entry) => {
    if (entry.status === 'ok') {
      reporter.success('DIRECTORY_READY', `Ordner „${entry.id}“ steht unter ${entry.path}.`);
    } else {
      reporter.warn('DIRECTORY_ISSUE', `Ordner „${entry.id}“ konnte nicht erstellt werden (${entry.message}).`);
    }
  });
  reporter.step('FILE_CHECK', 'Prüfe Pflichtdateien …');
  const missingFiles = await checkRequiredFiles();
  if (missingFiles.length === 0) {
    reporter.success('FILE_CHECK', 'Alle Pflichtdateien gefunden.');
  } else {
    missingFiles.forEach((entry) => {
      reporter.warn('FILE_MISSING', `Datei „${entry.path}“ fehlt (${entry.description}).`);
    });
  }

  reporter.step('DEPENDENCY_CHECK', 'Prüfe Abhängigkeiten …');
  const dependencyState = await ensureDependencies({ root: ROOT, logger: console });
  if (dependencyState.changed) {
    reporter.success('DEPENDENCIES', 'Abhängigkeiten frisch installiert.');
  } else if (dependencyState.installed) {
    reporter.success('DEPENDENCIES', 'Abhängigkeiten bereits vorhanden.');
  } else {
    reporter.warn('DEPENDENCIES', 'Abhängigkeiten konnten nicht automatisch installiert werden – bitte „npm install“ ausführen.');
  }

  reporter.step('PORT_SCAN', `Suche freien Port (Start bei ${DEFAULT_PORT}) …`);
  const port = await findAvailablePort(DEFAULT_PORT);
  const { server } = createStaticServer({
    root: ROOT,
    onRequestError: (error) => {
      reporter.error('SERVER_ERROR', error.message);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    const url = `http://localhost:${port}/`;
    reporter.success('SERVER_READY', `Server läuft unter ${url}`);
    reporter.step('BROWSER_OPEN', 'Versuche Browser zu öffnen …');
    openBrowser(url);
    reporter.summary('Alles bereit! Du kannst das ModulTool jetzt im Browser verwenden.');
  });

  const stop = () => {
    reporter.step('SERVER_STOP', 'Stoppe ModulTool …');
    server.close(() => {
      reporter.success('SERVER_STOPPED', 'Server beendet. Bis zum nächsten Mal!');
      process.exit(0);
    });
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

start().catch((error) => {
  console.error('[Start-Routine] ERROR:START_FAILED –', error);
  process.exit(1);
});
