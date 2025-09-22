#!/usr/bin/env node
const path = require('node:path');

const { resolveProjectPath } = require('./lib/prerequisites');
const { createReporter } = require('./lib/reporting');
const { StartPipeline } = require('./lib/start-pipeline');

const DEFAULT_PORT = 4173;
const ROOT = path.resolve(resolveProjectPath());

async function start() {
  const reporter = createReporter(console, { prefix: '[Start-Routine]' });
  const pipeline = new StartPipeline({
    root: ROOT,
    defaultPort: DEFAULT_PORT,
    reporter,
    logger: console
  });

  try {
    const context = await pipeline.run();
    pipeline.bindProcessSignals(process);

    process.once('uncaughtException', (error) => {
      reporter.error('UNCAUGHT_EXCEPTION', error.message);
      console.error(error);
      process.exit(1);
    });

    process.once('unhandledRejection', (reason) => {
      reporter.error('UNHANDLED_REJECTION', reason instanceof Error ? reason.message : String(reason));
      console.error(reason);
      process.exit(1);
    });

    return context;
  } catch (error) {
    reporter.error('START_FAILED', error.message || 'Unbekannter Fehler');
    console.error(error);
    process.exit(1);
    return null;
  }
}

start();
