#!/usr/bin/env node
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

const { resolveProjectPath } = require('./prerequisites');

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function getTimestamp(target) {
  try {
    const stat = await fs.stat(target);
    return stat.mtimeMs;
  } catch {
    return 0;
  }
}

async function needsInstall(rootDir) {
  const root = rootDir ? path.resolve(rootDir) : resolveProjectPath();
  const nodeModules = path.join(root, 'node_modules');
  if (!(await pathExists(nodeModules))) {
    return true;
  }
  const lockFile = path.join(root, 'package-lock.json');
  const packageJson = path.join(root, 'package.json');
  const latestReference = Math.max(await getTimestamp(lockFile), await getTimestamp(packageJson));
  const modulesStamp = await getTimestamp(nodeModules);
  return latestReference > modulesStamp;
}

function installDependencies(rootDir, logger = console) {
  const root = rootDir ? path.resolve(rootDir) : resolveProjectPath();
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['install', '--prefer-offline'], {
      cwd: root,
      stdio: 'inherit',
      env: process.env
    });
    child.once('error', (error) => {
      logger.error?.(`[Dependency] Installation fehlgeschlagen: ${error.message}`);
      reject(error);
    });
    child.once('exit', (code) => {
      if (code === 0) {
        logger.log?.('[Dependency] Alle Pakete installiert.');
        resolve();
      } else {
        const error = new Error(`npm install endete mit Code ${code}`);
        logger.error?.(`[Dependency] Installation endete mit Fehlercode ${code}.`);
        reject(error);
      }
    });
  });
}

async function ensureDependencies(options = {}) {
  const root = options.root ? path.resolve(options.root) : resolveProjectPath();
  const logger = options.logger || console;
  const autoInstall = options.autoInstall !== false;
  const required = await needsInstall(root);
  if (!required) {
    logger.log?.('[Dependency] Abhängigkeiten bereits installiert.');
    return { installed: true, changed: false };
  }
  if (!autoInstall) {
    logger.warn?.('[Dependency] Abhängigkeiten fehlen – automatische Installation ist deaktiviert.');
    return { installed: false, changed: false };
  }
  logger.log?.('[Dependency] Installiere fehlende Pakete …');
  await installDependencies(root, logger);
  return { installed: true, changed: true };
}

module.exports = {
  ensureDependencies,
  installDependencies,
  needsInstall
};
