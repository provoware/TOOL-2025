#!/usr/bin/env node
const path = require('node:path');

const { ensureDirectories, checkRequiredFiles, resolveProjectPath } = require('./prerequisites');
const { ensureDependencies } = require('./dependency-manager');
const { createStaticServer } = require('./server');
const { findAvailablePort } = require('./network');
const { openBrowser } = require('./browser');
const { createReporter } = require('./reporting');

class StartPipeline {
  constructor(options = {}) {
    this.root = path.resolve(options.root || resolveProjectPath());
    this.defaultPort = options.defaultPort || 4173;
    this.portAttempts = options.portAttempts || 20;
    this.autoInstall = options.autoInstall !== false;
    this.logger = options.logger || console;
    this.reporter = options.reporter || createReporter(this.logger);
    this.server = null;
    this.port = null;
    this.url = null;
  }

  async prepareDirectories() {
    this.reporter.step('DIRECTORY_CHECK', 'Prüfe Standardverzeichnisse …');
    const directories = await ensureDirectories(this.logger);
    directories.forEach((entry) => {
      if (entry.status === 'ok') {
        this.reporter.success('DIRECTORY_READY', `Ordner „${entry.id}“ steht unter ${entry.path}.`);
      } else {
        this.reporter.warn('DIRECTORY_ISSUE', `Ordner „${entry.id}“ konnte nicht erstellt werden (${entry.message}).`);
      }
    });
    return directories;
  }

  async checkFiles() {
    this.reporter.step('FILE_CHECK', 'Prüfe Pflichtdateien …');
    const missing = await checkRequiredFiles();
    if (missing.length === 0) {
      this.reporter.success('FILE_CHECK', 'Alle Pflichtdateien gefunden.');
    } else {
      missing.forEach((entry) => {
        this.reporter.warn('FILE_MISSING', `Datei „${entry.path}“ fehlt (${entry.description}).`);
      });
    }
    return missing;
  }

  async installDependencies() {
    this.reporter.step('DEPENDENCY_CHECK', 'Prüfe Abhängigkeiten …');
    const result = await ensureDependencies({
      root: this.root,
      logger: this.logger,
      autoInstall: this.autoInstall
    });
    if (result.changed) {
      this.reporter.success('DEPENDENCIES', 'Abhängigkeiten frisch installiert.');
    } else if (result.installed) {
      this.reporter.success('DEPENDENCIES', 'Abhängigkeiten bereits vorhanden.');
    } else {
      this.reporter.warn('DEPENDENCIES', 'Abhängigkeiten konnten nicht automatisch installiert werden – bitte „npm install“ ausführen.');
    }
    return result;
  }

  async startServer() {
    this.reporter.step('PORT_SCAN', `Suche freien Port (Start bei ${this.defaultPort}) …`);
    const port = await findAvailablePort(this.defaultPort, this.portAttempts);
    const { server } = createStaticServer({
      root: this.root,
      onRequestError: (error) => {
        this.reporter.error('SERVER_ERROR', error.message);
      }
    });

    await new Promise((resolve, reject) => {
      const onError = (error) => {
        server.off('error', onError);
        reject(error);
      };
      server.once('error', onError);
      server.listen(port, '0.0.0.0', () => {
        server.off('error', onError);
        resolve();
      });
    });

    this.server = server;
    this.port = port;
    this.url = `http://localhost:${port}/`;
    this.reporter.success('SERVER_READY', `Server läuft unter ${this.url}`);
    return { server: this.server, port: this.port, url: this.url };
  }

  launchBrowser(url = this.url) {
    this.reporter.step('BROWSER_OPEN', 'Versuche Browser zu öffnen …');
    const state = openBrowser(url, { logger: this.logger });
    if (!state.opened) {
      this.reporter.warn('BROWSER_MANUAL', 'Bitte öffne die Adresse manuell im Browser.');
    } else {
      this.reporter.success('BROWSER_LAUNCH', 'Browser-Start ausgelöst.');
    }
    return state;
  }

  async stop() {
    if (!this.server) {
      return;
    }
    this.reporter.step('SERVER_STOP', 'Stoppe ModulTool …');
    await new Promise((resolve) => {
      this.server.close(() => {
        this.reporter.success('SERVER_STOPPED', 'Server beendet. Bis zum nächsten Mal!');
        resolve();
      });
    });
  }

  bindProcessSignals(proc = process) {
    if (!proc || typeof proc.on !== 'function') {
      return;
    }
    const handle = () => {
      this.stop().finally(() => {
        proc.exit(0);
      });
    };
    proc.on('SIGINT', handle);
    proc.on('SIGTERM', handle);
  }

  async run() {
    this.reporter.banner();
    const directories = await this.prepareDirectories();
    const missingFiles = await this.checkFiles();
    const dependencyState = await this.installDependencies();
    const serverState = await this.startServer();
    this.launchBrowser(serverState.url);
    this.reporter.summary('Alles bereit! Du kannst das ModulTool jetzt im Browser verwenden.');
    return {
      directories,
      missingFiles,
      dependencyState,
      server: serverState.server,
      port: serverState.port,
      url: serverState.url
    };
  }
}

module.exports = {
  StartPipeline
};
