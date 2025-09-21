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
