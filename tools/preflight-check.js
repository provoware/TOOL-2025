#!/usr/bin/env node
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const {
  ROOT,
  ensureDirectories,
  checkRequiredFiles,
  readJsonFile,
  checkNodeVersion,
  detectDuplicateDeclarations,
  resolveProjectPath,
  fileExistsSync
} = require('./lib/prerequisites');

const MIN_NODE_VERSION = '20.0.0';

const DUPLICATE_DECLARATIONS = [
  {
    id: 'state',
    pattern: /const\s+state\s*=/g,
    message: 'Mehrfache "const state" Deklarationen blockieren Skripte.'
  },
  {
    id: 'persist',
    pattern: /function\s+persist\s*\(/g,
    message: 'Doppelte "function persist" Definitionen verhindern das Laden.'
  }
];

async function ensureConfigDefaults() {
  const configPath = resolveProjectPath('fortschritt-info.txt');
  try {
    await fs.access(configPath);
  } catch (error) {
    const placeholder = [
      '# Fortschritt & Status',
      'Bitte ergänze hier kurze Status-Notizen zum aktuellen Sprint.'
    ].join('\n');
    await fs.writeFile(configPath, placeholder, 'utf8');
    console.log('→ Datei "fortschritt-info.txt" ergänzt (Platzhalter erstellt).');
  }
}

function runQualityGate(withFix) {
  const args = ['node', path.join('tools', 'quality-gate.js')];
  if (withFix) {
    args.push('--fix');
  }
  const result = spawnSync(process.execPath, args.slice(1), {
    cwd: ROOT,
    stdio: 'inherit'
  });
  return result.status === 0;
}

async function main() {
  const argv = process.argv.slice(2);
  const runQuality = argv.includes('--with-quality');
  const autoFix = argv.includes('--fix');

  console.log('╭────────────────────────────────────────────╮');
  console.log('│ ModulTool Start- und Prüf-Routine          │');
  console.log('╰────────────────────────────────────────────╯');

  if (!checkNodeVersion(MIN_NODE_VERSION)) {
    console.error(`✗ Node.js ${MIN_NODE_VERSION} oder neuer wird benötigt. Aktuell: ${process.version}`);
    process.exit(1);
  }
  console.log(`✓ Node.js Version geprüft (${process.version})`);

  if (!fileExistsSync('node_modules')) {
    console.warn('! node_modules fehlt. Bitte einmal "npm install" ausführen, bevor du weitermachst.');
  } else {
    console.log('✓ Abhängigkeiten vorhanden (node_modules gefunden).');
  }

  console.log('→ Ergänze/verifiziere Standardverzeichnisse …');
  await ensureDirectories(console);
  console.log('✓ Verzeichnisse überprüft.');

  await ensureConfigDefaults();

  console.log('→ Prüfe Pflichtdateien …');
  const missing = await checkRequiredFiles();
  if (missing.length > 0) {
    missing.forEach((item) => {
      console.error(`✗ Pflichtdatei fehlt: ${item.path} (${item.description})`);
    });
    process.exitCode = 1;
  } else {
    console.log('✓ Alle Pflichtdateien vorhanden.');
  }

  try {
    await readJsonFile('package.json');
    await readJsonFile('schemas/backup-schema.json');
    console.log('✓ JSON-Dateien formal gültig.');
  } catch (error) {
    console.error(`✗ JSON-Prüfung fehlgeschlagen: ${error.message}`);
    process.exitCode = 1;
  }

  console.log('→ Suche nach doppelten Inline-Skripten …');
  const duplicates = await detectDuplicateDeclarations('index.html', DUPLICATE_DECLARATIONS);
  if (duplicates.length > 0) {
    duplicates.forEach((entry) => {
      console.error(`✗ Doppeltes Skriptelement (${entry.id}): ${entry.message}`);
    });
    console.error('Bitte entferne Duplikate, damit das Tool interaktiv bleibt.');
    process.exitCode = 1;
  } else {
    console.log('✓ Keine blockierenden Duplikate in index.html gefunden.');
  }

  if (runQuality) {
    console.log('→ Führe Qualitäts-Gate aus …');
    const success = runQualityGate(autoFix);
    if (!success) {
      console.error('✗ Qualitäts-Gate fehlgeschlagen.');
      process.exitCode = 1;
    } else {
      console.log('✓ Qualitäts-Gate erfolgreich abgeschlossen.');
    }
  }

  if (process.exitCode === 1) {
    console.error('Preflight hat Probleme entdeckt. Bitte beheben und erneut ausführen.');
  } else {
    console.log('Preflight abgeschlossen. Du kannst "npm start" verwenden.');
  }
}

main().catch((error) => {
  console.error('[Preflight] Unerwarteter Fehler:', error);
  process.exit(1);
});
