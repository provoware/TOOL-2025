#!/usr/bin/env node
const os = require('node:os');
const { spawn } = require('node:child_process');

function resolveBrowserCommand(url) {
  const platform = os.platform();
  if (platform === 'darwin') {
    return { command: 'open', args: [url] };
  }
  if (platform === 'win32') {
    return { command: 'cmd', args: ['/c', 'start', '', url] };
  }
  if (platform === 'linux') {
    return { command: 'xdg-open', args: [url] };
  }
  return null;
}

function openBrowser(url, options = {}) {
  const logger = options.logger || console;
  const command = resolveBrowserCommand(url);
  if (!command) {
    logger.warn?.(`[Start-Routine] WARN:BROWSER_OPEN – Automatisches Öffnen wird auf dieser Plattform nicht unterstützt. Bitte öffne ${url} manuell.`);
    return { opened: false, reason: 'unsupported-platform' };
  }

  const child = spawn(command.command, command.args, { stdio: 'ignore', detached: true });
  child.on('error', (error) => {
    logger.warn?.(`[Start-Routine] WARN:BROWSER_OPEN – Automatisches Öffnen fehlgeschlagen (${error.message}). Öffne bitte selbst: ${url}`);
  });
  child.unref();
  return { opened: true, reason: 'spawned' };
}

module.exports = {
  openBrowser,
  resolveBrowserCommand
};
