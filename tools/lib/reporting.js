#!/usr/bin/env node
const os = require('node:os');

function formatLabel(prefix, id, message) {
  return `${prefix}:${id} – ${message}`;
}

function getHostname() {
  try {
    return os.hostname();
  } catch (error) {
    return 'unknown-host';
  }
}

function createReporter(logger = console, options = {}) {
  const startTime = Date.now();
  const prefix = options.prefix || '[Start-Routine]';
  const host = options.includeHost === false ? null : getHostname();

  function wrap(kind, id, message, method = 'log') {
    const hostLabel = host ? `@${host.trim()}` : '';
    const label = `${prefix} ${formatLabel(`${kind}${hostLabel ? ` ${hostLabel}` : ''}`, id, message)}`;
    if (typeof logger[method] === 'function') {
      logger[method](label);
    }
    return { kind, id, message, timestamp: new Date().toISOString() };
  }

  return {
    banner(title = 'ModulTool Start-Routine') {
      const border = '─'.repeat(Math.max(title.length + 2, 38));
      logger.log?.(`╭${border}╮`);
      logger.log?.(`│ ${title.padEnd(border.length - 1)}│`);
      logger.log?.(`╰${border}╯`);
    },
    step(id, message) {
      return wrap('EVENT', id, message);
    },
    success(id, message) {
      return wrap('OK', id, message);
    },
    warn(id, message) {
      return wrap('WARN', id, message, 'warn');
    },
    error(id, message) {
      return wrap('ERROR', id, message, 'error');
    },
    summary(message = 'ModulTool bereit.') {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      return wrap('DONE', `${duration}s`, message);
    }
  };
}

module.exports = {
  createReporter
};
