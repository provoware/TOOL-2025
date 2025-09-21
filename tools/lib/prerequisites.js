#!/usr/bin/env node
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');

const REQUIRED_DIRECTORIES = ['backups', 'exports', 'plugins', 'logs', 'data'];

const REQUIRED_FILES = [
  { path: 'index.html', description: 'Hauptoberfläche' },
  { path: 'schemas/backup-schema.json', description: 'Backup-Schema' },
  { path: 'docs/structure.txt', description: 'Struktur- und Manifestübersicht' },
  { path: 'todo.txt', description: 'Aktionsliste' }
];

function resolveProjectPath(relativePath = '.') {
  return path.join(ROOT, relativePath);
}

async function ensureDirectories(logger = console) {
  const results = [];
  for (const dir of REQUIRED_DIRECTORIES) {
    const target = resolveProjectPath(dir);
    try {
      await fs.mkdir(target, { recursive: true });
      results.push({ id: dir, status: 'ok', path: target });
    } catch (error) {
      const message = `Verzeichnis "${dir}" konnte nicht erstellt werden: ${error.message}`;
      results.push({ id: dir, status: 'error', path: target, message });
      logger.warn?.(`[Start-Prüfung] ${message}`);
    }
  }
  return results;
}

async function checkRequiredFiles() {
  const issues = [];
  for (const entry of REQUIRED_FILES) {
    const absolute = resolveProjectPath(entry.path);
    try {
      await fs.access(absolute);
    } catch (error) {
      issues.push({ ...entry, error: error.message });
    }
  }
  return issues;
}

async function readJsonFile(relativePath) {
  const absolute = resolveProjectPath(relativePath);
  const content = await fs.readFile(absolute, 'utf8');
  try {
    return JSON.parse(content);
  } catch (error) {
    error.message = `JSON in ${relativePath} fehlerhaft: ${error.message}`;
    throw error;
  }
}

function checkNodeVersion(minVersion) {
  const current = process.versions.node.split('.').map(Number);
  const required = minVersion.split('.').map(Number);
  for (let index = 0; index < Math.max(current.length, required.length); index += 1) {
    const cur = current[index] ?? 0;
    const req = required[index] ?? 0;
    if (cur > req) {
      return true;
    }
    if (cur < req) {
      return false;
    }
  }
  return true;
}

async function detectDuplicateDeclarations(relativePath, declarations) {
  const absolute = resolveProjectPath(relativePath);
  const content = await fs.readFile(absolute, 'utf8');
  const duplicates = [];
  for (const declaration of declarations) {
    const matches = content.match(declaration.pattern) || [];
    if (matches.length > 1) {
      duplicates.push({
        id: declaration.id,
        count: matches.length,
        message: declaration.message,
        sample: matches[0]
      });
    }
  }
  return duplicates;
}

function fileExistsSync(relativePath) {
  try {
    fsSync.accessSync(resolveProjectPath(relativePath));
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  ROOT,
  REQUIRED_DIRECTORIES,
  REQUIRED_FILES,
  ensureDirectories,
  checkRequiredFiles,
  readJsonFile,
  checkNodeVersion,
  detectDuplicateDeclarations,
  resolveProjectPath,
  fileExistsSync
};
