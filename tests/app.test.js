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
  api.actions.activateConfigPreset('balanced', { announceSelection: false });
  api.actions.applyLayoutPreset('balanced', { announceSelection: false, persistChange: false });
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
      logFilter: 'all'
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
  assert.ok(report.fixes.length >= 1);
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
