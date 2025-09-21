const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { test, before, after, beforeEach } = require('node:test');
const { JSDOM } = require('jsdom');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const projectRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(projectRoot, 'index.html');
const schemaPath = path.join(projectRoot, 'schemas', 'backup-schema.json');

let dom;
let api;

before(async () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'https://modultool.test/',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.__MODUL_TOOL_TEST__ = true;
      window.alert = () => {};
      window.confirm = () => true;
      window.matchMedia = window.matchMedia || (() => ({
        matches: false,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return false; }
      }));
      window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      if (window.HTMLMediaElement) {
        window.HTMLMediaElement.prototype.play = () => Promise.resolve();
        window.HTMLMediaElement.prototype.pause = () => {};
      }
    }
  });
  await new Promise((resolve) => {
    dom.window.document.addEventListener('DOMContentLoaded', resolve);
  });
  api = dom.window.ModulToolTestAPI;
  api.init();
});

after(() => {
  if (api && typeof api.teardown === 'function') {
    api.teardown();
  }
  if (dom) {
    dom.window.close();
  }
});

beforeEach(() => {
  api.actions.clearPlugins();
  api.state.log = [];
  api.events.resetDigestHistory();
  api.actions.activateConfigPreset('balanced', { announceSelection: false });
  api.actions.applyLayoutPreset('balanced', { announceSelection: false, persistChange: false });
  api.state.exportSequences = {};
});

function seedPlaylist(ids) {
  api.state.playlist = ids.map((id, index) => ({
    id,
    title: `Titel ${index + 1}`,
    artist: `Artist ${index + 1}`,
    src: `track-${id}.mp3`
  }));
  api.state._currentIndex = 1;
  api.actions.renderPlaylist();
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test('Start-Check meldet Speicher- und Importstatus laienverständlich', () => {
  const report = api.helpers.getDependencyReport();
  assert.ok(Array.isArray(report), 'Report sollte ein Array sein');
  assert.ok(report.length > 0, 'Report sollte mindestens einen Eintrag enthalten');
  const storageEntry = report.find((item) => item.id === 'storage');
  assert.ok(storageEntry, 'Speicher-Eintrag fehlt im Start-Check');
  assert.match(storageEntry.message, /Speicher/, 'Speicherhinweis fehlt');
  const rerun = api.actions.runDependencyCheck();
  assert.ok(Array.isArray(rerun.entries), 'Rerun liefert keine Einträge');
});

test('Alt+Pfeil Sortierung verschiebt Eintrag und aktualisiert Fokusindex', async () => {
  seedPlaylist(['a', 'b', 'c']);
  api.actions.reorderPlaylist(1, 0);
  await flush();
  assert.deepEqual(api.state.playlist.map((t) => t.id), ['b', 'a', 'c']);
  assert.equal(api.state._currentIndex, 0);
});

test('Entfernen löscht Track und setzt aktuellen Index zurück', async () => {
  seedPlaylist(['x', 'y']);
  api.state._currentIndex = 0;
  api.actions.removeTrackAt(0);
  await flush();
  assert.equal(api.state.playlist.length, 1);
  assert.equal(api.state._currentIndex, null);
});

test('createUserModule erzeugt eindeutige Namen und verhindert Duplikate', async () => {
  const initialCount = api.state.modules.length;
  const first = api.actions.createUserModule('Mein Modul');
  assert.ok(first.id, 'erstes Modul sollte angelegt werden');
  assert.equal(api.state.modules.length, initialCount + 1);

  const duplicate = api.actions.createUserModule('Mein Modul');
  assert.equal(duplicate.id, null, 'Duplikat darf kein Modul anlegen');
  assert.equal(duplicate.duplicate, true);
  assert.equal(api.state.modules.length, initialCount + 1, 'Anzahl bleibt nach Duplikat gleich');

  const fallback = api.actions.createUserModule('', { announce: false });
  assert.ok(fallback.id, 'Fallback-Name sollte Modul anlegen');
  assert.ok(fallback.usedFallback, 'Fallback-Kennzeichen sollte gesetzt sein');
  assert.match(fallback.name, /^Modul /);
  assert.equal(api.state.modules.length, initialCount + 2);

  await flush();

  api.state.modules = api.state.modules.filter((mod) => mod.id !== first.id && mod.id !== fallback.id);
  api.actions.ensureModuleRegistryMatchesState(api.state.activeModule || null);
});

test('Backup erfüllt JSON-Schema', () => {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const backup = api.actions.buildBackup();
  const valid = validate(backup);
  if (!valid) {
    assert.fail(ajv.errorsText(validate.errors, { separator: '\n' }));
  }
});

test('Export-Dateien erhalten eindeutige Zeitstempel und Zähler', () => {
  const first = api.helpers.generateExportFileName('modultool-backup', 'json', { key: 'backup' });
  const second = api.helpers.generateExportFileName('modultool-backup', 'json', { key: 'backup' });
  assert.match(first, /^modultool-backup_\d{8}-\d{6}_v001\.json$/);
  assert.match(second, /^modultool-backup_\d{8}-\d{6}_v002\.json$/);
  const sequences = api.helpers.getExportSequences();
  assert.ok(sequences.backup, 'Backup-Sequenz fehlt');
  assert.equal(sequences.backup.counter, 2);
  assert.match(sequences.backup.stamp, /^\d{8}-\d{6}$/);
});

test('Backup übernimmt Fehlerfänger-, Datei- und Debug-Einstellungen', async () => {
  const { document } = dom.window;
  const smartToggle = document.querySelector('#smartErrorsChk');
  const preventToggle = document.querySelector('#preventMistakesChk');
  const debugToggle = document.querySelector('#debugModeChk');
  const feedbackSelect = document.querySelector('#feedbackModeSel');

  smartToggle.checked = false;
  smartToggle.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  preventToggle.checked = false;
  preventToggle.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  debugToggle.checked = true;
  debugToggle.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  feedbackSelect.value = 'smart';
  feedbackSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

  await flush();

  const backup = api.actions.buildBackup();
  assert.equal(backup.state.smartErrors, false);
  assert.equal(backup.state.preventMistakes, false);
  assert.equal(backup.state.debugMode, true);
  assert.equal(backup.state.feedbackMode, 'smart');
  assert.equal(backup.manifest.settings.smartErrors, false);
  assert.equal(backup.manifest.settings.preventMistakes, false);
  assert.equal(backup.manifest.settings.debugMode, true);
  assert.equal(backup.manifest.settings.feedbackMode, 'smart');
});

test('Backup und Manifest enthalten Digest-Verlauf für Laienberichte', async () => {
  api.events.resetDigestHistory();
  const created = api.actions.createUserModule('Digest-Demo', { announce: false });
  await flush();
  const backup = api.actions.buildBackup();

  assert.ok(Array.isArray(backup.state.digestHistory), 'State-Digest-Historie fehlt');
  assert.ok(backup.state.digestHistory.length > 0, 'Digest-Historie sollte Einträge haben');
  const firstEntry = backup.state.digestHistory[0];
  assert.ok(Number.isFinite(Number(firstEntry.timestamp)), 'Zeitstempel muss numerisch sein');
  assert.ok(firstEntry.digest, 'Digest-Daten fehlen');
  assert.equal(
    firstEntry.digest.modules,
    backup.state.modules.length,
    'Digest muss Modul-Anzahl widerspiegeln'
  );

  assert.ok(backup.manifest.digest, 'Manifest-Digest fehlt');
  assert.equal(
    backup.manifest.digest.modules,
    backup.state.modules.length,
    'Manifest-Digest nutzt Modul-Anzahl'
  );
  assert.ok(Array.isArray(backup.manifest.digestHistory), 'Manifest-Historie fehlt');
  assert.ok(
    backup.manifest.digestHistory[0].summary.includes('Modul'),
    'Manifest fasst die Änderung laienverständlich zusammen'
  );

  if (created && created.id) {
    api.actions.removeModule(created.id);
    await flush();
  }
});

test('JSON-Signatur-Erkennung warnt vor HTML-Dateien', () => {
  const invalid = api.actions.validateJsonContent('<html><body></body></html>', { expectedRoot: 'object' });
  assert.equal(invalid.ok, false, 'HTML darf nicht als JSON durchgehen');
  assert.match(invalid.message, /Kein JSON/, 'Fehlermeldung sollte JSON erwähnen');

  const valid = api.actions.validateJsonContent('\uFEFF {"key":1}', { expectedRoot: 'object' });
  assert.equal(valid.ok, true, 'JSON mit BOM sollte akzeptiert werden');
});

test('Audio-Signatur-Prüfung erkennt falsche Dateien', async () => {
  const { File, Uint8Array } = dom.window;
  const mp3Header = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const validFile = new File([mp3Header], 'demo.mp3', { type: 'audio/mpeg' });
  const validResult = await api.actions.validateAudioFile(validFile);
  assert.equal(validResult.ok, true, 'gültiger MP3-Header sollte akzeptiert werden');

  const fakeContent = new Uint8Array([0x7b, 0x22, 0x78, 0x22]);
  const invalidFile = new File([fakeContent], 'fake.mp3', { type: 'audio/mpeg' });
  const invalidResult = await api.actions.validateAudioFile(invalidFile);
  assert.equal(invalidResult.ok, false, 'JSON-Inhalt darf nicht als Audio durchgehen');
  assert.match(invalidResult.message, /Audio-Signatur|Keine Audiodatei/, 'Fehlermeldung sollte Signatur nennen');
});

test('renderModules zeigt leeren Hinweis für Laien', () => {
  api.state.modules = [];
  api.actions.renderModules();
  const empty = dom.window.document.querySelector('#modulesList .empty-state');
  assert.ok(empty, 'Leerer Hinweis sollte angezeigt werden');
  assert.match(empty.textContent, /Noch keine Module angelegt/);
});

test('renderPlaylist nutzt Skeleton während des Imports', () => {
  api.state.playlist = [];
  api.state.loadingPlaylist = true;
  api.actions.renderPlaylist();
  const skeleton = dom.window.document.querySelector('#playlist .skeleton-row');
  assert.ok(skeleton, 'Skeleton-Reihe sollte vorhanden sein');
  api.state.loadingPlaylist = false;
  api.actions.renderPlaylist();
});

test('renderStats liefert laienfreundliche Zusammenfassung', () => {
  api.state.modules = [];
  api.state.categories = {};
  api.state.genres = [];
  api.state.moods = [];
  api.state.playlist = [];
  api.actions.renderStats();
  const summary = dom.window.document.querySelector('#statsSummary');
  assert.ok(summary, 'Zusammenfassungselement fehlt');
  assert.match(summary.textContent, /Noch alles leer/);
});

test('State-Digest-Panel zeigt Zahlen und kürzt die Historie', async () => {
  api.events.resetDigestHistory();
  api.state.modules = [];
  api.state.categories = {};
  api.state.genres = [];
  api.state.moods = [];
  api.state.playlist = [];
  api.actions.renderStats();
  const document = dom.window.document;
  const digestSummary = document.querySelector('#digestSummaryText');
  assert.ok(digestSummary, 'Digest-Zusammenfassung fehlt');
  assert.match(digestSummary.textContent, /Status/);

  for (let i = 0; i < 5; i += 1) {
    api.actions.createUserModule(`Digest Modul ${i}`);
  }
  await flush();

  const moduleCount = Number(document.querySelector('#digestModules').textContent);
  assert.equal(moduleCount, api.state.modules.length);

  const historyAfterCreate = api.events.getDigestHistory();
  assert.ok(historyAfterCreate.length >= 1, 'es sollte mindestens einen Digest-Eintrag geben');
  historyAfterCreate.forEach((entry) => {
    assert.ok(entry.timestamp, 'Digest-Eintrag benötigt Zeitstempel');
    assert.ok(entry.digest, 'Digest-Eintrag benötigt Zustand');
  });

  for (let i = 0; i < 12; i += 1) {
    api.actions.createUserModule(`Digest Extra ${i}`);
  }
  await flush();

  const trimmedHistory = api.events.getDigestHistory();
  assert.ok(trimmedHistory.length <= 8, 'Digest-Historie sollte begrenzt sein');

  api.state.modules = [];
  api.actions.renderModules();
  api.actions.renderStats();
  api.events.resetDigestHistory();
});

test('validateBackup liefert Bericht und korrigiert doppelte Einträge', () => {
  const dirtyBackup = {
    state: {
      theme: 'neo',
      autosave: true,
      selfrepair: true,
      toasts: true,
      respectSystemMotion: true,
      reduceMotion: false,
      respectSystemContrast: true,
      highContrast: false,
      fontScale: 16,
      configPreset: 'custom',
      layoutPreset: 'balanced',
      modules: [
        { id: 'dup', name: 'Alpha' },
        { id: 'dup', name: 'Beta' }
      ],
      categories: {
        ' ': { genres: ['Rock', 'Rock'], moods: ['Calm'] },
        Focus: { genres: ['Deep', 'Deep'], moods: ['Chill', 'Chill'] }
      },
      genres: ['Rock', 'Rock', 'Pop'],
      moods: ['Chill', 'Chill'],
      playlist: [
        { id: 'track', title: 'Song A', artist: 'Artist', src: 'track-a.mp3' },
        { id: 'track', title: 'Song B', artist: 'Artist', src: 'track-b.mp3' }
      ],
      plugins: [
        {
          id: 'plugin-1',
          name: 'Plugin One',
          description: 'desc',
          version: '1.0.0',
          author: 'Author',
          moduleId: 'dup',
          moduleName: 'Modul Name',
          sections: [{ title: '', content: 'Info' }],
          links: [
            { label: 'Site', url: 'ftp://invalid' },
            { label: 'Ok', url: 'https://valid.local' }
          ]
        }
      ],
      activeModule: 'missing',
      log: [
        { time: '', type: 'INFO', msg: '' },
        { time: '12:00:00', type: 'warn', msg: 'Warnung' },
        null
      ],
      logFilter: 'all',
      smartErrors: true,
      preventMistakes: true,
      debugMode: false,
      feedbackMode: 'full'
    }
  };

  const { state: sanitized, report } = api.actions.validateBackup(dirtyBackup, { collect: true });

  assert.ok(Array.isArray(sanitized.modules));
  const moduleIds = new Set(sanitized.modules.map((m) => m.id));
  assert.equal(moduleIds.size, sanitized.modules.length);
  assert.ok(!Object.prototype.hasOwnProperty.call(sanitized.categories, ''));
  assert.ok(Array.isArray(sanitized.genres));
  assert.deepStrictEqual(Array.from(sanitized.genres), ['Pop', 'Rock']);
  assert.deepStrictEqual(Array.from(sanitized.categories.Focus.genres), ['Deep']);
  assert.equal(new Set(sanitized.playlist.map((t) => t.id)).size, sanitized.playlist.length);
  assert.equal(sanitized.plugins.length, 1);
  assert.equal(sanitized.plugins[0].links.length, 1);
  assert.match(sanitized.plugins[0].links[0].url, /^https?:/);
  assert.equal(sanitized.activeModule, null);
  assert.equal(sanitized.log.length, 2);
  assert.equal(sanitized.smartErrors, true);
  assert.equal(sanitized.preventMistakes, true);
  assert.equal(sanitized.debugMode, false);
  assert.equal(sanitized.feedbackMode, 'full');
  assert.ok(report.fixes.length >= 1);
});

test('Hilfe-Dialog hält Fokus im Overlay und lässt nach dem Schließen los', async () => {
  const { document } = dom.window;
  const searchField = document.querySelector('#quickSearch');
  searchField.focus();

  api.actions.openHelp('quickstart');
  await flush();

  const helpDialog = document.querySelector('#helpDialog');
  const closeBtn = document.querySelector('#helpCloseBtn');
  await flush();
  assert.ok(helpDialog.contains(document.activeElement), 'Fokus sollte im Hilfe-Dialog landen');
  if (closeBtn) {
    assert.ok(
      document.activeElement === closeBtn || document.activeElement === helpDialog,
      'Schließen-Button oder Dialog erhält den Startfokus'
    );
  }

  searchField.focus();
  searchField.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true, composed: true }));
  await flush();
  assert.ok(helpDialog.contains(document.activeElement), 'Fokus sollte im Hilfe-Dialog gehalten werden');
  assert.notEqual(document.activeElement, searchField);
  if (closeBtn) {
    assert.ok(
      document.activeElement === closeBtn || document.activeElement === helpDialog,
      'Fokus landet auf Schließen-Button oder Dialog'
    );
  }

  api.actions.closeHelp();
  await flush();

  searchField.focus();
  searchField.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true, composed: true }));
  await flush();
  assert.equal(document.activeElement, searchField, 'Fokus darf nach dem Schließen frei wechseln');
});

test('Feedback-Panel sammelt Prozessmeldungen und lässt sich leeren', async () => {
  const { document } = dom.window;
  const list = document.querySelector('#feedbackList');
  api.actions.applyLayoutPreset('audio-only', { announceSelection: true, persistChange: false });
  await flush();
  const itemsAfterLayout = Array.from(list.querySelectorAll('li'));
  assert.ok(itemsAfterLayout.some((li) => /Audio/.test(li.textContent)), 'Audio-Hinweis sichtbar');
  const clearBtn = document.querySelector('#clearFeedbackBtn');
  clearBtn.click();
  await flush();
  const resetItems = Array.from(list.querySelectorAll('li'));
  assert.equal(resetItems.length, 1);
  assert.match(resetItems[0].textContent, /Noch keine Hinweise/);
});

test('Smart Errors fangen globale Fehler ab und loggen Meldung', async () => {
  const initialLogLength = api.state.log.length;
  const errorEvent = new dom.window.ErrorEvent('error', {
    message: 'Testfehler',
    filename: 'test.js',
    lineno: 42
  });
  dom.window.dispatchEvent(errorEvent);
  await flush();
  assert.ok(api.state.log.length > initialLogLength, 'Logeintrag wurde ergänzt');
  const lastEntry = api.state.log[api.state.log.length - 1];
  assert.equal(lastEntry.type, 'error');
  assert.match(lastEntry.msg, /Schutz: Fehler abgefangen/);
});

test('guardAction fängt Fehler ab und liefert Feedback für Laien', async () => {
  const list = dom.window.document.querySelector('#feedbackList');
  const badge = dom.window.document.querySelector('#feedbackBadge');
  api.actions.guardAction('Testaktion', () => {
    throw new Error('Absichtlicher Fehler');
  });
  await flush();
  const items = Array.from(list.querySelectorAll('li'));
  assert.ok(items.some((item) => /Testaktion/.test(item.textContent)), 'Hinweis für Testaktion sichtbar');
  const lastLog = api.state.log[api.state.log.length - 1];
  assert.equal(lastLog.type, 'error');
  assert.match(lastLog.msg, /Testaktion/);
  if (badge) {
    assert.match(badge.textContent, /Hinweise/, 'Badge zeigt Hinweisanzahl an');
  }
});

test('guardAction blendet Präventionshinweise nur einmal ein', async () => {
  const { document } = dom.window;
  const list = document.querySelector('#feedbackList');
  api.actions.guardAction('Plugin-Test', () => {
    throw new Error('Fehlerhafte Plugin-Datei');
  }, { hint: 'plugin-import' });
  await flush();
  const firstTexts = Array.from(list.querySelectorAll('li')).map((li) => li.textContent);
  const initialHints = firstTexts.filter((text) => /Tipp:/.test(text));
  assert.ok(initialHints.length >= 1, 'Mindestens ein Tipp-Hinweis sichtbar');
  api.actions.guardAction('Plugin-Test erneut', () => {
    throw new Error('Fehlerhafte Plugin-Datei');
  }, { hint: 'plugin-import' });
  await flush();
  const secondTexts = Array.from(list.querySelectorAll('li')).map((li) => li.textContent);
  const hintsAfterSecondRun = secondTexts.filter((text) => /Tipp:/.test(text));
  assert.equal(hintsAfterSecondRun.length, initialHints.length, 'Hinweis erscheint nur einmal');
});

test('Layout-Preset steuert Seitenleisten und landet im Backup', async () => {
  api.actions.applyLayoutPreset('audio-only', { announceSelection: false, persistChange: false });
  await flush();
  assert.equal(api.state.layoutPreset, 'audio-only');
  const body = dom.window.document.body;
  assert.equal(body.getAttribute('data-layout'), 'audio-only');
  assert.equal(body.classList.contains('collapsed-left'), true);
  assert.equal(body.classList.contains('collapsed-right'), false);
  const backup = api.actions.buildBackup();
  assert.equal(backup.state.layoutPreset, 'audio-only');
  assert.equal(backup.manifest.settings.layoutPreset, 'audio-only');
});

test('Layout-Sichtbarkeit erklärt Bereiche für Laien', async () => {
  const { document } = dom.window;
  api.actions.applyLayoutPreset('audio-only', { announceSelection: false, persistChange: false });
  await flush();
  const messages = Array.from(document.querySelectorAll('#layoutVisibilityList li')).map((li) => li.textContent.trim());
  assert.ok(messages.some((text) => text.startsWith('Module links: ausgeblendet')), 'Linker Bereich wird als ausgeblendet beschrieben.');
  assert.ok(messages.some((text) => text.startsWith('Audio rechts: sichtbar')), 'Rechter Bereich wird als sichtbar beschrieben.');
  const cycleBtn = document.querySelector('#layoutCycleBtn');
  assert.ok(cycleBtn, 'Cycle-Button existiert');
  assert.ok(/Weiter zu: /.test(cycleBtn.textContent), 'Cycle-Button nennt das nächste Layout.');
  const nextLayout = cycleBtn.dataset.nextLayout;
  assert.ok(nextLayout, 'Next-Layout-Datensatz gesetzt');
  api.actions.applyLayoutPreset(nextLayout, { announceSelection: false, persistChange: false });
  await flush();
  assert.equal(api.state.layoutPreset, nextLayout);
});

test('validatePluginData normalisiert Inhalte', () => {
  const pluginData = api.actions.validatePluginData({
    name: '  Referenz-Plugin  ',
    description: ' Testbeschreibung ',
    version: ' 1.0.0 ',
    author: ' A. Dev ',
    moduleName: '  ',
    moduleId: '  Referenz Modul ',
    sections: [
      { title: '  Abschnitt ', content: ' Inhalt mit\nZeile ' },
      { title: ' ', content: ' ' }
    ],
    links: [
      { label: ' Webseite ', url: ' https://example.com/info ' },
      { label: 'FTP', url: 'ftp://invalid.local' }
    ]
  });
  assert.equal(pluginData.name, 'Referenz-Plugin');
  assert.equal(pluginData.sections.length, 1);
  assert.equal(pluginData.sections[0].title, 'Abschnitt');
  assert.equal(pluginData.links.length, 1);
  assert.equal(pluginData.links[0].label, 'Webseite');
  assert.equal(pluginData.links[0].url, 'https://example.com/info');
});

test('registerPlugin registriert Modul und Renderer', async () => {
  const baseModules = api.state.modules.length;
  const candidate = api.actions.validatePluginData({
    name: 'Statistik Plugin',
    description: 'Zeigt Statistiken.',
    version: '2.0.0',
    author: 'Team Tool',
    moduleName: 'Statistik Übersicht',
    moduleId: 'stats-mod',
    sections: [{ title: 'Info', content: 'Zeigt Werte.' }],
    links: []
  });
  const plugin = api.actions.registerPlugin(candidate);
  await flush();
  assert.ok(api.state.plugins.some((p) => p.id === plugin.id));
  assert.equal(api.state.modules.length, baseModules + 1);
  assert.ok(api.actions.moduleRendererExists(plugin.moduleId));
  assert.throws(() => api.actions.registerPlugin(candidate), /bereits vorhanden/i);
});

test('removePlugin entfernt Plugin inkl. Modul', async () => {
  const candidate = api.actions.validatePluginData({
    name: 'Entfern-Test',
    description: 'Testfall für das Entfernen.',
    version: '1.1.0',
    author: 'QA',
    moduleName: 'Entferner',
    moduleId: 'remove-me',
    sections: [],
    links: []
  });
  const plugin = api.actions.registerPlugin(candidate);
  await flush();
  const moduleId = plugin.moduleId;
  api.actions.removePlugin(plugin.id);
  await flush();
  assert.ok(!api.state.plugins.some((p) => p.id === plugin.id));
  assert.ok(!api.state.modules.some((m) => m.id === moduleId));
  assert.equal(api.actions.moduleRendererExists(moduleId), false);
});

test('Plugin-Inhalte werden sanitisiert', async () => {
  const candidate = api.actions.validatePluginData({
    name: 'Sicherheits-Plugin',
    description: 'Demo.',
    version: '1.0.0',
    author: 'Security',
    moduleName: 'Sicherheitsansicht',
    moduleId: 'sec-mod',
    sections: [
      {
        title: 'Hinweis',
        content:
          '<strong>Fett</strong><script>alert(1)</script><a href="javascript:alert(1)">böse</a><a href="https://example.com">gut</a>'
      }
    ],
    links: []
  });
  const plugin = api.actions.registerPlugin(candidate);
  await flush();
  api.actions.openModule(plugin.moduleId);
  await flush();
  const canvas = dom.window.document.querySelector('#canvas');
  const frame = canvas.querySelector('.plugin-frame');
  assert.ok(frame, 'Plugin-Inhalt wird in Sandbox-Iframe gerendert');
  assert.equal(
    frame.getAttribute('sandbox'),
    'allow-popups allow-popups-to-escape-sandbox'
  );
  assert.equal(frame.getAttribute('referrerpolicy'), 'no-referrer');
  const srcdoc = frame.getAttribute('srcdoc') || '';
  assert.match(srcdoc, /<strong>Fett<\/strong>/);
  assert.ok(!/script/i.test(srcdoc));
  assert.ok(!/javascript:/i.test(srcdoc));
  assert.match(srcdoc, /rel="noopener noreferrer"/);
  assert.match(srcdoc, /target="_blank"/);
  assert.equal(frame.dataset.pluginName, 'Sicherheits-Plugin');
  assert.equal(frame.dataset.sectionTitle, 'Hinweis');
});

test('Event-Bus meldet Layout-Wechsel mit Digest', async () => {
  const events = [];
  const stopListening = api.events.bus.subscribe(api.events.names.STATE_CHANGED, (detail) => {
    if (detail && detail.reason === 'layout-changed') {
      events.push(detail);
    }
  });

  api.actions.applyLayoutPreset('audio-only', { announceSelection: false });
  await flush();
  api.actions.applyLayoutPreset('balanced', { announceSelection: false });
  await flush();
  stopListening();

  assert.ok(events.length >= 1, 'es sollte mindestens ein Layout-Event geben');
  const first = events[0];
  assert.equal(first.layout, 'audio-only');
  assert.equal(first.digest.modules, api.state.modules.length);
  assert.equal(first.digest.playlist, api.state.playlist.length);
});

test('Persistenter Zustand kürzt Log und behält Version', () => {
  api.state.version = '9.9.9';
  api.state.log = Array.from({ length: 350 }, (_, index) => ({
    id: `entry-${index}`,
    time: `12:00:${index.toString().padStart(2, '0')}`,
    type: 'info',
    msg: `Nachricht ${index}`
  }));

  const snapshot = api.helpers.createPersistableState();

  assert.equal(snapshot.version, '9.9.9');
  assert.ok(snapshot.log.length <= 200, 'Log sollte für Speicherungen gekürzt werden');
  const newest = snapshot.log[snapshot.log.length - 1];
  assert.match(newest.msg, /Nachricht 349/);
  assert.ok(snapshot.log.every((entry) => entry.id), 'Logeinträge besitzen IDs');
});

test('Konfigurations-Preset lässt sich anwenden und erkennt individuelle Änderung', async () => {
  api.actions.activateConfigPreset('accessibility', { announceSelection: false });
  await flush();
  assert.equal(api.state.configPreset, 'accessibility');
  assert.equal(api.state.fontScale, 18);
  assert.equal(api.state.reduceMotion, true);
  assert.equal(api.state.highContrast, true);
  const toastsToggle = dom.window.document.querySelector('#toastsChk');
  toastsToggle.checked = false;
  toastsToggle.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await flush();
  assert.equal(api.state.configPreset, 'custom');
});

test('assertBackupSchema erkennt fehlende Modul-Liste', () => {
  const backup = api.actions.buildBackup();
  delete backup.state.modules;
  assert.throws(() => api.actions.assertBackupSchema(backup), /state\.modules/);
});

test('help center liefert Themenliste und Plaintext', async () => {
  assert.equal(api.actions.isHelpOpen(), false);
  api.actions.openHelp('audio');
  await flush();
  assert.equal(api.actions.isHelpOpen(), true);
  const topics = api.actions.getHelpTopics();
  assert.ok(topics.includes('quickstart'));
  assert.ok(topics.includes('audio'));
  const plain = api.actions.buildHelpPlainText();
  assert.match(plain, /Hilfe-Center/);
  assert.match(plain, /Schnell loslegen/);
  api.actions.closeHelp();
  await flush();
  assert.equal(api.actions.isHelpOpen(), false);
});
