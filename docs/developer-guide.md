# Entwicklerhandbuch ModulTool (Professional Edition)

## 1. Zweck
Dieses Handbuch richtet sich an Entwicklerinnen und Entwickler, die das ModulTool professionell warten und weiterentwickeln. Es beschreibt Architekturziele, empfohlene Toolchains, Qualitätsrichtlinien sowie die aktuelle Funktionsbasis.

## 2. Systemüberblick
- **Typ:** Single-File-Webanwendung (`index.html`) mit integriertem CSS/JavaScript.
- **Persistenz:** Browser `localStorage` mit Versionstempel (`state.version`).
- **Domänen:** Modul- und Archivverwaltung, Audio-Playlist, Plugin-Manager, Logging, Manifest-Export, Backup-Prüfung.
- **Anzeige & Feedback:** Systempräferenz-Optionen (Motion/Kontrast), Live-Status (`aria-live`), prozessspezifische Statusausgabe für Backup/Import, skalierbare Schriftgrößen (14–20 px Presets), farbcodierte Log-/Status-Icons für `info`/`ok`/`warn`/`error`, Farblegende + Bereichskarten (Module, Arbeitsfläche, Audio, Archiv) mit abgestimmten Akzentfarben, sieben Layout-Presets (Ausgewogen, Module-/Audio-Fokus, Arbeitsfläche, Übereinander) mit Statusmeldung & Persistenz, Sichtbarkeits-Assistent (Mini-Vorschau, Klartextliste, Schnellbuttons) für die Fenster-Anordnung, laienfreundliches Hilfe-Center (F1) mit Shortcut-Spickzettel sowie ein Konfigurations-Assistent mit Preset-Buttons, Klartext-Zusammenfassung, synchronisierten Checkboxen **und Konfigurations-Export/-Import (JSON-Datei mit Preset, Layout und Sicherheitsschaltern)**. Neu hinzugekommen sind ein Smart-Error-Guard (globale Fehlerfänger, Datei-Prüfungen, Feedback-Panel mit Zeitstempel/Badge, `guardAction` für sichere UI-Aktionen samt Präventionshinweisen) und ein Debug-Panel mit Kopier- sowie Download-Funktion für Zustandssnapshots **sowie Fokusfallen (Focus-Traps) für Hilfe- und Konfigurationsdialoge, damit Tastaturnutzer:innen nicht aus dem Overlay fallen, laienfreundliche Leerstaaten für Module/Playlist inklusive Skeleton-Loader während Audio-Imports, ein Klartext-Statustext im Dashboard, eine Log-Zusammenfassung, die Filter, Anzahl und letzte Meldung sowohl sichtbar als auch über Screenreader meldet, das State-Digest-Dashboard im Kopfbereich (`#stateDigestPanel`), das Module/Plugins/Playlist/Archiv als Karten anzeigt, Tipps formuliert und einen auf acht Einträge begrenzten Verlauf führt, **und das Start-Check-Panel (`#dependencyPanel`), das Browser-Fähigkeiten (Speicher, Import, Download, IDs, Audio, Clipboard) automatisch prüft, Hinweise loggt und bei Bedarf Speicher-Fallbacks aktiviert. Die neuen Entfernen-Routinen (`removeModule`/`removePlugin`) laufen über `guardAction`, erzeugen Warn-Logs, Prozessmeldungen und Präventionshinweise (z. B. Self-Repair-Tipp) und sichern so laienfreundliche Rückmeldungen beim Löschen.** Self-Repair sendet zusätzlich Prozessfeedback (Success/Info) über `announceProcess`, der Event-Bus meldet Layout-/Einstellungswechsel und `stateDigestLive` fasst Module/Playlist/Plugins screenreaderfreundlich zusammen.**

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
- Start-Check & Storage-Service: `autoResolveDependencies()` prüft Speicher, Datei-/Download-, ID-, Audio- und Clipboard-Funktionen, aktualisiert `#dependencyPanel`, schreibt Hinweise ins Log/Process-Banner und nutzt `storageSetItem`/`storageGetItem` als Service-Schicht mit Memory-Fallback bei blockiertem `localStorage`.
- Plugin-Sandbox: Inhalte werden sanitisiert, in Sandbox-Iframes gerendert und erhalten Theme-Snapshots.
- Live-Status & Display-Settings: `announce()` aktualisiert eine `aria-live`-Region, `announceProcess()` liefert Laufzeit-Feedback für Import/Backup/Selbsttest, Display-Präferenzen respektieren `prefers-*` und lassen sich per UI steuern; das Hilfe-Center (F1) bietet leicht verständliche Schrittlisten, Fokussteuerung und Kopier-/Download-Funktionen.
- Smart-Error-Guard & Feedback: `attachGlobalErrorGuards()` fängt globale Fehler ab, `validateJsonFile`/`validateJsonContent`/`validateAudioFile` stoppen ungeeignete Dateien (inkl. Signaturprüfung von JSON- und Audio-Importen), `guardAction(label, fn, { level, hint, requirePreventMistakes })` kapselt riskante UI-Aktionen, blendet laienfreundliche Tipps aus `PREVENTIVE_HINTS` nur einmal ein und erinnert an die Datei-Prüfung, `captureFeedback` führt Meldungen im `#feedbackList`-Panel (Zeitstempel, Typanzeige, Badge-Zähler) zusammen; Exporte (Manifest, Backup, Playlist, Plugins, Debug) laufen jetzt über `guardAction` und erzeugen Erfolgsfeedback, das Debug-Panel (`state.debugMode`) bietet Kopier- und Download-Funktionen für Snapshots. **`createUserModule()` nutzt denselben Schutz und verhindert doppelte Modulnamen (Hinweis + Prozessansage). `createEmptyState(options)` und `createSkeletonList(count, message)` liefern wiederverwendbare UI-Helfer für Leerstaaten bzw. laufende Importe.**
- Dashboard-Zusammenfassung: `buildStatsSummary()` fasst Module, Kategorien, Archiv- und Playlist-Anzahl in Klartext zusammen und aktualisiert `#statsSummary`.
- Event-Bus & Persistenz: `createEventBus()`/`notifyStateChange()` senden Digest-Details über `STATE_CHANGED`; `persist({ reason, detail, forceSave })` nutzt `createPersistableState()` (Loglimit 200) und `applyLoadedState()` sanitisierte Snapshots. Das State-Digest-Dashboard (`renderStateDigestPanel` + Historie mit max. 8 Einträgen) wird hierüber aktuell gehalten und via Test-API (`events.getDigestHistory()`) prüfbar.
- Playlist-Import: `addFiles(files)` setzt `state.loadingPlaylist`, zeigt via `renderPlaylist()` einen Skeleton-Loader (`aria-busy`), prüft jede Datei asynchron über `validateAudioFile()` (Header-Signatur + Größe + Dateityp) und meldet Fortschritte mit `announceProcess()`.
- Modul-Anlage: `createUserModule(name,{ renderer, announce })` erstellt sprechende Modulnamen (Fallback „Modul n“), prüft Duplikate laienfreundlich, ruft `registerModule` über `guardAction` auf, protokolliert Feedback/Prozess und wird vom UI-Event-Handler `onAddModule` sowie der Test-API genutzt.
- Modul-/Plugin-Entfernung: `removeModule(id,{ announce=true, label, reason, log, capture, hint })` läuft über `guardAction` (Warn-Log, Feedback, Prozessansage, Self-Repair-Hinweis) und akzeptiert optionale Flags zum Unterdrücken von Log/Feedback, z. B. wenn `removePlugin` intern das Modul mit entfernt; `removePlugin(id,{ announce=true, log=true, capture=true, hint='plugin-remove' })` ruft bei Erfolg automatisch `removeModule` (ohne zusätzliche Prozessansage), persistiert den Schritt (`reason: 'plugin-removed'`) und blendet Präventionstipps („Plugin exportieren“) sowie einen Self-Repair-Hinweis ein. `clearPlugins()` nutzt diese Optionen, um mehrere Plugins still zu entfernen und anschließend eine zusammengefasste Warnmeldung auszugeben.
- Konfigurations-Assistent: Vier Presets (Allround, Barrierefrei, Fokus, Performance) triggern bestehende Checkbox-/Select-Handler, `state.configPreset` hält den aktuellen Modus, `findPresetMatch` erkennt manuelle Anpassungen und synchronisiert Klartext-Zusammenfassung sowie Buttons. **`exportConfigSettings()` erzeugt eine laienfreundliche JSON-Datei mit Preset, Layout, Theme, Sicherheits- und Komfortschaltern (Dateiname via `generateExportFileName` + Präventionstipp), `importConfigFromJson()`/`applyConfigFromSnapshot()` lesen diese Dateien ein, validieren Struktur & Werte und passen State, UI-Schalter, Layout sowie Feedbackmeldungen an. `updateConfigTransferStatus()` aktualisiert den Hinweistext im Dialog nach Export/Import.**
- Layoutsteuerung: `applyLayoutPreset` (Buttons + Test-API) setzt CSS-Variablen (`--left-col`, `--right-col`), toggelt Seitenleisten, aktualisiert `data-layout`, schreibt das Layout in Backup & Manifest und sendet Statusmeldungen.
- Layout-Sichtbarkeit: `renderLayoutVisibility` aktualisiert Mini-Vorschau & Klartextstatus, `updateLayoutCycleButton` pflegt den Fortschalt-Button, `layoutShowAllBtn` stellt den Standard wieder her; neue Tests sichern die laienfreundliche Beschreibung der sichtbaren Bereiche.
- Fokusführung: Einheitliche `:focus-visible`-Rahmen für Buttons, Eingaben, Links und Dropzone unterstützen Tastaturnutzung; `Escape` holt ausgeblendete Seitenleisten zurück; **`activateFocusTrap()`/`deactivateFocusTrap()` sichern Hilfe- und Konfigurationsdialog (Focus-Trap, Rücksprung auf auslösendes Element).**

## 5. Lokale Entwicklungsumgebung einrichten
1. Node.js ≥ 20 installieren.
2. Repository klonen und Abhängigkeiten installieren:
   ```bash
   npm install
   ```
3. Start-Routine ausführen (legt Standardordner an, startet Server & öffnet Browser automatisch):
   ```bash
   npm start
   ```
   Alternativ ohne npm-Skript:
   ```bash
   node tools/start-tool.js
   ```
4. Tests ausführen (führt dank `pretest` automatisch `npm run lint` vor dem Testlauf aus):
   ```bash
   npm test
   ```
5. Linting separat ausführen (wenn nur Analyse ohne Tests gewünscht):
   ```bash
   npm run lint
   ```
6. Kompletten Qualitätslauf starten (`npm run verify` alias für `npm test`):
   ```bash
   npm run verify
   ```

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
- `npm test`: Node-gestützte Tests (Playlist-Kurzbefehle, Backup-Schema, Plugin-Registrierung, Self-Repair-Basics, Präventionshinweis-Deduplizierung, Modul-Duplikatschutz, Modul-/Plugin-Löschschutz, Fokusfalle im Hilfe-Dialog, Start-Check-Report, JSON-/Audio-Signatur-Checks) inklusive automatischem Lint-Lauf via `pretest`.
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
- **Manifest:** Zusammenfassung des Zustands (Version, Theme, Statistiken) plus Digest-Resümee und Verlauf (Zeitstempel + Klartext) via Button; `downloadManifest()` nutzt `guardAction` und liefert Erfolgs-Feedback + Präventionstipp.
- **Backup:** Enthält Manifest + bereinigte Daten (Module, Kategorien, Genres, Moods, Playlist, Plugins, Logs, Log-Filter, Layout-Preset) sowie das Digest-Resümee inklusive Verlaufseinträge (Zeitstempel, Reason, Zählwerte). Export nutzt `sanitizeStateForExport(state,{logLimit:50})`, läuft über `guardAction` und erinnert Nutzer:innen daran, das Backup sicher abzulegen.
- **Import & Validierung:** `validateBackup(raw,{collect:true})` ruft dieselbe Normalisierung auf, liefert ein Report-Objekt (`fixes`, `warnings`, `notes`) und wird im Backup-Prüfmodul sowie beim Import-Log ausgegeben. `Object.assign(state, validState)` übernimmt die Sanitizergebnisse (inklusive Digest-Verlauf), danach laufen Self-Repair, Layout-Synchronisierung und Plugin-Registry.
- **Backup-Prüfmodul:** UI-Modul mit Schema-Validierung, Fehlerlisten, Statistiken und Statusmeldungen über `aria-live`; Ergebnisse werden fokussiert und `announceProcess()` kündigt Start/Erfolg/Fehler an.
- **Dateinamenspolitik:** `generateExportFileName()` vergibt sprechende Namen mit Zeitstempel + `_vXYZ`; die Zähler landen in `state.exportSequences` und werden beim Speichern/Import sanitisiert. Signaturen bleiben als nächster Schritt offen.

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

