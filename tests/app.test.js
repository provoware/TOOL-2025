const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
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
