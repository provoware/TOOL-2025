#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { fileExistsSync } = require('./lib/prerequisites');

const ROOT = path.resolve(__dirname, '..');

const STEPS = [
  {
    id: 'lint',
    title: 'Code-Analyse (ESLint)',
    command: 'npm',
    buildArgs: (options) => {
      const args = ['run', 'lint', '--', '--max-warnings=0'];
      if (options.fix) {
        args.push('--fix');
      }
      return args;
    },
    mandatory: true
  },
  {
    id: 'tests',
    title: 'Unit- und Integrations-Tests',
    command: 'node',
    buildArgs: () => ['--test', 'tests'],
    mandatory: true
  }
];

function runStep(step, options) {
  const args = step.buildArgs(options);
  const result = spawnSync(step.command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  return result.status === 0;
}

function main() {
  const args = process.argv.slice(2);
  const options = {
    fix: args.includes('--fix'),
    skipTests: args.includes('--skip-tests')
  };

  if (!fileExistsSync('node_modules')) {
    console.warn('[Quality-Gate] node_modules fehlt. Bitte zuerst "npm install" ausführen.');
    process.exitCode = 1;
    return;
  }

  console.log('╭────────────────────────────────────────────╮');
  console.log('│ ModulTool Qualitätsprüfungen               │');
  console.log('╰────────────────────────────────────────────╯');

  for (const step of STEPS) {
    if (step.id === 'tests' && options.skipTests) {
      console.log(`→ Überspringe ${step.title} (manuell angefordert)`);
      continue;
    }

    console.log(`→ Starte ${step.title} …`);
    const success = runStep(step, options);
    if (!success) {
      console.error(`✗ ${step.title} fehlgeschlagen.`);
      process.exitCode = 1;
      return;
    }
    console.log(`✓ ${step.title} abgeschlossen.`);
  }

  console.log('Alle Qualitätsprüfungen erfolgreich bestanden.');
}

main();
