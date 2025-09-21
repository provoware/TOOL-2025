# Entwicklerhandbuch ModulTool (Professional Edition)

## 1. Zweck
Dieses Handbuch richtet sich an Entwicklerinnen und Entwickler, die das ModulTool professionell warten und weiterentwickeln. Es beschreibt Architekturziele, empfohlene Toolchains, Qualitätsrichtlinien sowie die aktuelle Funktionsbasis.

## 2. Systemüberblick
- **Typ:** Single-File-Webanwendung (`index.html`) mit integriertem CSS/JavaScript.
- **Persistenz:** Browser `localStorage` mit Versionstempel (`state.version`).
- **Domänen:** Modul- und Archivverwaltung, Audio-Playlist, Plugin-Manager, Logging, Manifest-Export, Backup-Prüfung.
- **Anzeige & Feedback:** Systempräferenz-Optionen (Motion/Kontrast), Live-Status (`aria-live`), prozessspezifische Statusausgabe für Backup/Import, skalierbare Schriftgrößen (14–20 px Presets), farbcodierte Log-/Status-Icons für `info`/`ok`/`warn`/`error`, Farblegende + Bereichskarten (Module, Arbeitsfläche, Audio, Archiv) mit abgestimmten Akzentfarben, sieben Layout-Presets (Ausgewogen, Module-/Audio-Fokus, Arbeitsfläche, Übereinander) mit Statusmeldung & Persistenz, Sichtbarkeits-Assistent (Mini-Vorschau, Klartextliste, Schnellbuttons) für die Fenster-Anordnung, laienfreundliches Hilfe-Center (F1) mit Shortcut-Spickzettel sowie ein Konfigurations-Assistent mit Preset-Buttons, Klartext-Zusammenfassung und synchronisierten Checkboxen. Neu hinzugekommen sind ein Smart-Error-Guard (globale Fehlerfänger, Datei-Prüfungen, Feedback-Panel mit Zeitstempel/Badge, `guardAction` für sichere UI-Aktionen samt Präventionshinweisen) und ein Debug-Panel mit Kopier- sowie Download-Funktion für Zustandssnapshots **sowie Fokusfallen (Focus-Traps) für Hilfe- und Konfigurationsdialoge, damit Tastaturnutzer:innen nicht aus dem Overlay fallen, laienfreundliche Leerstaaten für Module/Playlist inklusive Skeleton-Loader während Audio-Imports und ein Klartext-Statustext im Dashboard.**

## 3. Architektur-Zielbild
1. **Layering:**
   - **UI-Layer:** Web Components oder modulare View-Funktionen, ausschließlich für Darstellung und Input-Verarbeitung zuständig.
   - **State-Layer:** Event-getriebener Store (z. B. Zustand + Reducer), Transaktionslog, Undo/Redo, Snapshot-Support.
   - **Service-Layer:** Storage, Audio, File-Handling, Sanitizing, Worker-Bridge.
   - **Integration-Layer:** Plugin-Host, Import-/Export-Adapter, Telemetrie.
2. **Event-Bus:** Publish/Subscribe mit Namespaces (`ui/*`, `audio/*`, `storage/*`). Jeder Layer kommuniziert ausschließlich über Events.
3. **Statecharts:** Kritische Flows (Backup-Import, Plugin-Installation, Drag & Drop, Playback) als endliche Automaten modellieren (Guards, Recovery-Pfade).
4. **Plugin-Contract:** Manifest (`id`, `version`, `capabilities`), Lifecycle (`init`, `activate`, `deactivate`), Capability-Handshake (z. B. `requires: ['storage:read']`).

## 4. Aktuelle Codebasis verstehen
- Einstiegspunkt: `index.html` enthält HTML-Markup, Styles, Skripte und Inline-Templates.
- `window.ModulToolTestAPI`: Brücke für automatisierte Tests (Playlist-/Plugin-Helfer, Backup-Validierung, Timersteuerung).
- Self-Repair: Korrigiert IDs, Module, Plugins, Log-Filter und stellt Registry-Synchronität wieder her.
- Plugin-Sandbox: Inhalte werden sanitisiert, in Sandbox-Iframes gerendert und erhalten Theme-Snapshots.
- Live-Status & Display-Settings: `announce()` aktualisiert eine `aria-live`-Region, `announceProcess()` liefert Laufzeit-Feedback für Import/Backup/Selbsttest, Display-Präferenzen respektieren `prefers-*` und lassen sich per UI steuern; das Hilfe-Center (F1) bietet leicht verständliche Schrittlisten, Fokussteuerung und Kopier-/Download-Funktionen.
- Smart-Error-Guard & Feedback: `attachGlobalErrorGuards()` fängt globale Fehler ab, `validateJsonFile`/`validateAudioFile` stoppen ungeeignete Dateien, `guardAction(label, fn, { level, hint, requirePreventMistakes })` kapselt riskante UI-Aktionen, blendet laienfreundliche Tipps aus `PREVENTIVE_HINTS` nur einmal ein und erinnert an die Datei-Prüfung, `captureFeedback` führt Meldungen im `#feedbackList`-Panel (Zeitstempel, Typanzeige, Badge-Zähler) zusammen; Exporte (Manifest, Backup, Playlist, Plugins, Debug) laufen jetzt über `guardAction` und erzeugen Erfolgsfeedback, das Debug-Panel (`state.debugMode`) bietet Kopier- und Download-Funktionen für Snapshots. **`createUserModule()` nutzt denselben Schutz und verhindert doppelte Modulnamen (Hinweis + Prozessansage).**
- Smart-Error-Guard & Feedback: `attachGlobalErrorGuards()` fängt globale Fehler ab, `validateJsonFile`/`validateAudioFile` stoppen ungeeignete Dateien, `guardAction(label, fn, { level, hint, requirePreventMistakes })` kapselt riskante UI-Aktionen, blendet laienfreundliche Tipps aus `PREVENTIVE_HINTS` nur einmal ein und erinnert an die Datei-Prüfung, `captureFeedback` führt Meldungen im `#feedbackList`-Panel (Zeitstempel, Typanzeige, Badge-Zähler) zusammen; Exporte (Manifest, Backup, Playlist, Plugins, Debug) laufen jetzt über `guardAction` und erzeugen Erfolgsfeedback, das Debug-Panel (`state.debugMode`) bietet Kopier- und Download-Funktionen für Snapshots. **`createUserModule()` nutzt denselben Schutz und verhindert doppelte Modulnamen (Hinweis + Prozessansage).** `createEmptyState(options)` und `createSkeletonList(count, message)` liefern wiederverwendbare UI-Helfer für Leerstaaten bzw. laufende Importe.
- Dashboard-Zusammenfassung: `buildStatsSummary()` fasst Module, Kategorien, Archiv- und Playlist-Anzahl in Klartext zusammen und aktualisiert `#statsSummary`.
- Playlist-Import: `addFiles(files)` setzt `state.loadingPlaylist`, zeigt via `renderPlaylist()` einen Skeleton-Loader (`aria-busy`) und meldet Fortschritte mit `announceProcess()`.
- Modul-Anlage: `createUserModule(name,{ renderer, announce })` erstellt sprechende Modulnamen (Fallback „Modul n“), prüft Duplikate laienfreundlich, ruft `registerModule` über `guardAction` auf, protokolliert Feedback/Prozess und wird vom UI-Event-Handler `onAddModule` sowie der Test-API genutzt.
- Konfigurations-Assistent: Vier Presets (Allround, Barrierefrei, Fokus, Performance) triggern bestehende Checkbox-/Select-Handler, `state.configPreset` hält den aktuellen Modus, `findPresetMatch` erkennt manuelle Anpassungen und synchronisiert Klartext-Zusammenfassung sowie Buttons.
- Layoutsteuerung: `applyLayoutPreset` (Buttons + Test-API) setzt CSS-Variablen (`--left-col`, `--right-col`), toggelt Seitenleisten, aktualisiert `data-layout`, schreibt das Layout in Backup & Manifest und sendet Statusmeldungen.
- Layout-Sichtbarkeit: `renderLayoutVisibility` aktualisiert Mini-Vorschau & Klartextstatus, `updateLayoutCycleButton` pflegt den Fortschalt-Button, `layoutShowAllBtn` stellt den Standard wieder her; neue Tests sichern die laienfreundliche Beschreibung der sichtbaren Bereiche.
- Fokusführung: Einheitliche `:focus-visible`-Rahmen für Buttons, Eingaben, Links und Dropzone unterstützen Tastaturnutzung; `Escape` holt ausgeblendete Seitenleisten zurück; **`activateFocusTrap()`/`deactivateFocusTrap()` sichern Hilfe- und Konfigurationsdialog (Focus-Trap, Rücksprung auf auslösendes Element).**

## 5. Lokale Entwicklungsumgebung einrichten
1. Node.js ≥ 20 installieren.
2. Repository klonen und Abhängigkeiten installieren:
   ```bash
   npm install
   ```
3. Tests ausführen (führt dank `pretest` automatisch `npm run lint` vor dem Testlauf aus):
   ```bash
   npm test
   ```
4. Linting separat ausführen (wenn nur Analyse ohne Tests gewünscht):
   ```bash
   npm run lint
   ```
5. Kompletten Qualitätslauf starten (`npm run verify` alias für `npm test`):
   ```bash
   npm run verify
   ```
4. Bis zur Einführung des Bundlers kann `index.html` direkt im Browser geöffnet werden (`file://`-Pfad).

## 6. Geplante Projektstruktur (Post-Refactor)
```
TOOL-2025/
├─ public/              # Ausgelieferte Assets (index.html, icons, manifest)
├─ src/
│  ├─ app/              # App-Shell, Routing, Bootstrap
│  ├─ ui/               # Komponenten (View Layer)
│  ├─ state/            # Store, Reducer, Statecharts, Events
│  ├─ services/         # Storage-, Audio-, File-, Sanitizing-Services
│  ├─ plugins/          # Plugin-SDK, Contracts, Registries
│  └─ workers/          # Web Worker Entry-Points
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
├─ tools/               # Build-, Lint-, Analyse-Skripte
├─ docs/
└─ package.json
```

## 7. Coding-Standards & Richtlinien
- **Sprache:** TypeScript (Strikter Modus). Kein `any`, eindeutige Interfaces.
- **Stil:** ESLint (Airbnb Base + Security Plugins) und Prettier. Commit-Hooks via Husky (`lint-staged`).
- **Benennung:** Kebab-Case für Dateien, PascalCase für Komponenten, camelCase für Funktionen/Variablen, SCREAMING_SNAKE_CASE für Konstanten.
- **Fehlerbehandlung:** Services werfen spezifische Fehlerobjekte mit `code`, `message`, `context`.
- **Logging:** Zentrales Logger-Modul mit Leveln (`debug`, `info`, `warn`, `error`). Alle Events erzeugen nachvollziehbare Audit-Logs.
- **Security:** Stets Eingaben sanitizen, `Content-Security-Policy` ohne `unsafe-inline`, Trusted Types vorbereiten.

## 8. Qualitätsmaßnahmen
| Kategorie | Werkzeuge | Ziel |
| --- | --- | --- |
| Linting | ESLint, eslint-plugin-security, eslint-plugin-jsdoc | Stil, Sicherheitsregeln, Dokumentationspflicht |
| Formatierung | Prettier | Einheitliche Formatierung |
| Typen | TypeScript, tsconfig strict | Früherkennung von Fehlern |
| Unit-Tests | Jest + Testing Library | Store, Services, Sanitizer |
| Integration | Playwright (UI), axe-core (A11y) | Nutzerflows, Tastatur, Screenreader |
| Property-Tests | fast-check | Daten- und Importrobustheit |
| Visuelle Regression | Playwright Screenshot + Pixelmatch | Layout-Stabilität |
| Performance | Lighthouse CI, Web Vitals, eigene `performance.now()`-Messungen | Budget-Überwachung |
| Security | npm audit, OWASP ZAP (offline), Signatur-Checks | Schwachstellenprüfung |

## 9. Tests & Automatisierung (Ist-Stand)
- `npm test`: Node-gestützte Tests (Playlist-Kurzbefehle, Backup-Schema, Plugin-Registrierung, Self-Repair-Basics, Präventionshinweis-Deduplizierung, Modul-Duplikatschutz, Fokusfalle im Hilfe-Dialog) inklusive automatischem Lint-Lauf via `pretest`.
- JSON-Schema in `schemas/backup-schema.json` validiert Backups und wird in den Tests automatisiert geprüft.
- Erweiterungsoptionen: Playwright-Szenarien für Import/Export, axe-Integration, Performance-Smoke-Test, Property-Tests.

## 10. Plugin-Contract (aktuell)
- **Dateiformat:** JSON mit Feldern `name`, optional `description`, `version`, `author`, `moduleName`, `moduleId`, `sections`, `links`.
- **Darstellung:** Sanitizing-Whitelist (typografische Tags, Listen, Links), automatische Link-Härtung (`rel="noopener noreferrer"`, `target="_blank"`).
- **Sandbox:** Iframes mit `sandbox="allow-popups allow-popups-to-escape-sandbox"`, `referrerpolicy="no-referrer"`, Theme-Snapshot.
- **Registry:** `ensureModuleRegistryMatchesState` erzeugt Platzhalter für fehlende Renderer und beseitigt ID-Konflikte.
- **Export/Import:** Plugin-Manager erlaubt sicheren Export (bereinigtes JSON) und Entfernen. Self-Repair räumt verwaiste Einträge.
- **Weiterentwicklung:** SDK definieren (Lifecycle-Hooks, Capability-Check, Messaging über Event-Bus, Versionierung, Kompatibilitätsmatrix).

## 11. Datenexport, Manifest & Backup
- **Manifest:** Zusammenfassung des Zustands (Version, Theme, Statistiken) via Button; `downloadManifest()` nutzt `guardAction` und liefert Erfolgs-Feedback + Präventionstipp.
- **Backup:** Enthält Manifest + bereinigte Daten (Module, Kategorien, Genres, Moods, Playlist, Plugins, Logs, Log-Filter, Layout-Preset). Export nutzt `sanitizeStateForExport(state,{logLimit:50})`, läuft über `guardAction` und erinnert Nutzer:innen daran, das Backup sicher abzulegen.
- **Import & Validierung:** `validateBackup(raw,{collect:true})` ruft dieselbe Normalisierung auf, liefert ein Report-Objekt (`fixes`, `warnings`, `notes`) und wird im Backup-Prüfmodul sowie beim Import-Log ausgegeben. `Object.assign(state, validState)` übernimmt die Sanitizergebnisse, danach laufen Self-Repair, Layout-Synchronisierung und Plugin-Registry.
- **Backup-Prüfmodul:** UI-Modul mit Schema-Validierung, Fehlerlisten, Statistiken und Statusmeldungen über `aria-live`; Ergebnisse werden fokussiert und `announceProcess()` kündigt Start/Erfolg/Fehler an.
- **Dateinamenspolitik:** Noch offen – empfohlen sind inkrementelle Suffixe (`_v001`) und Signaturen.

## 12. Erweiterungsleitfaden
1. Analyse: Betroffene Bereiche identifizieren (UI, State, Services, Plugins).
2. Tests: Bestehende Tests erweitern oder neue schreiben (TDD bevorzugt).
3. Implementierung: Über Event-Bus und Service-Schnittstellen integrieren, Self-Repair erweitern falls nötig.
4. Dokumentation: Entwicklerhandbuch, Benutzerhilfe, Changelog, ToDo aktualisieren.
5. Barrierefreiheit & i18n prüfen (Tastatur, Screenreader, Kontrast, Übersetzbarkeit).

## 13. Logging, Monitoring & Telemetrie
- Aktuelle Logs: `time`, `type`, `msg`, Filter im UI (`Alles`, `Infos`, `Erfolge`, `Hinweise`, `Fehler`) mit konsistenter Icon- und Farbcodierung.
- Roadmap: Strukturierte Events (`eventId`, `payload`), Export als JSON/CSV, Option für anonymisierte Telemetrie (opt-in).
- Debugging: Detail-Logs für Import/Export, Plugin-Lifecycle, Worker-Tasks.

## 14. Deployment, Release & Portabilität
- Kurzfristig: Offline-Distribution als ZIP mit `public/` und `dist/`.
- Mittelfristig: Service Worker + PWA-Manifest, reproduzierbare Builds mit Hash im Footer, Release-Signaturen (SHA256 + Signaturdatei), Integritätsprüfung im UI.
- Tooling: GitHub Actions Pipeline (Install → Lint → Test → Build → Pa11y/Axe → Release-Artefakte signieren).

## 15. Dokumentation & Governance
- Dokumente: Analysebericht, dieses Handbuch, `docs/structure.txt`, `todo.txt`.
- Ausstehend: Threat-Model (STRIDE), Styleguide, Benutzer-Richtlinien (Offline-Datenschutz), Review-Checklisten.
- Pflegeprozess: Jede Änderung aktualisiert Dokumentation, Tests und ToDo-Liste. Pull-Requests erfordern Review + Checkliste (Security, A11y, Performance, Tests, Docs).

## 16. Referenzen
- Weitere Details: `docs/analysis-report.md`, `schemas/backup-schema.json`, `tests/app.test.js`.

