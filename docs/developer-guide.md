# Entwicklerhandbuch ModulTool (Professional Edition)

## 1. Zweck
Dieses Handbuch richtet sich an Entwicklerinnen und Entwickler, die das ModulTool professionell warten und weiterentwickeln. Es beschreibt Architekturziele, empfohlene Toolchains, Qualitätsrichtlinien sowie die aktuelle Funktionsbasis.

## 2. Systemüberblick
- **Typ:** Single-File-Webanwendung (`index.html`) mit integriertem CSS/JavaScript.
- **Persistenz:** Browser `localStorage` mit Versionstempel (`state.version`).
- **Domänen:** Modul- und Archivverwaltung, Audio-Playlist, Plugin-Manager, Logging, Manifest-Export, Backup-Prüfung.
- **Anzeige & Feedback:** Systempräferenz-Optionen (Motion/Kontrast), Live-Status (`aria-live`), prozessspezifische Statusausgabe für Backup/Import, skalierbare Schriftgrößen (14–20 px Presets), farbcodierte Log-/Status-Icons für `info`/`ok`/`warn`/`error`, Farblegende + Bereichskarten (Module, Arbeitsfläche, Audio, Archiv) mit abgestimmten Akzentfarben, sieben Layout-Presets (Ausgewogen, Module-/Audio-Fokus, Arbeitsfläche, Übereinander) mit Statusmeldung & Persistenz, Sichtbarkeits-Assistent (Mini-Vorschau, Klartextliste, Schnellbuttons) für die Fenster-Anordnung, laienfreundliches Hilfe-Center (F1) mit Shortcut-Spickzettel **und Themenkarten für Schnellstart, Plugins, Einstellungen („Einstellungen sichern & teilen“) sowie Audio**, sowie ein Konfigurations-Assistent mit Preset-Buttons, Klartext-Zusammenfassung, synchronisierten Checkboxen **und Konfigurations-Export/-Import (JSON-Datei mit Preset, Layout und Sicherheitsschaltern)**. Neu hinzugekommen sind ein Smart-Error-Guard (globale Fehlerfänger, Datei-Prüfungen, Feedback-Panel mit Zeitstempel/Badge, `guardAction` für sichere UI-Aktionen samt Präventionshinweisen) und ein Debug-Panel mit Kopier- sowie Download-Funktion für Zustandssnapshots **sowie Fokusfallen (Focus-Traps) für Hilfe- und Konfigurationsdialoge, damit Tastaturnutzer:innen nicht aus dem Overlay fallen, laienfreundliche Leerstaaten für Module/Playlist inklusive Skeleton-Loader während Audio-Imports, ein Klartext-Statustext im Dashboard, eine Log-Zusammenfassung, die Filter, Anzahl und letzte Meldung sowohl sichtbar als auch über Screenreader meldet, das State-Digest-Dashboard im Kopfbereich (`#stateDigestPanel`), das Module/Plugins/Playlist/Archiv als Karten anzeigt, Tipps formuliert und einen auf acht Einträge begrenzten Verlauf führt, **und das Start-Check-Panel (`#dependencyPanel`), das Browser-Fähigkeiten (Speicher, Import, Download, IDs, Audio, Clipboard) automatisch prüft, Hinweise loggt und bei Bedarf Speicher-Fallbacks aktiviert. Die neuen Entfernen-Routinen (`removeModule`/`removePlugin`) laufen über `guardAction`, erzeugen Warn-Logs, Prozessmeldungen und Präventionshinweise (z. B. Self-Repair-Tipp) und sichern so laienfreundliche Rückmeldungen beim Löschen.** Self-Repair sendet zusätzlich Prozessfeedback (Success/Info) über `announceProcess`, der Event-Bus meldet Layout-/Einstellungswechsel und `stateDigestLive` fasst Module/Playlist/Plugins screenreaderfreundlich zusammen.**

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
4. Qualitäts-Gate (Linting + Tests) in einem Schritt starten:
   ```bash
   npm run quality
   ```
5. Qualitäts-Gate mit automatischer Korrektur (ESLint `--fix`):
   ```bash
   npm run quality -- --fix
   ```
6. Preflight-Prüfung inkl. Qualitäts-Gate (Release-Vorbereitung):
   ```bash
   npm run preflight -- --with-quality
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
- `npm run quality`: Qualitäts-Gate (ESLint mit `--max-warnings=0` + Node-Test-Suite). Bricht bei Warnungen/Fehlern ab.
- `npm run quality -- --fix`: Gleiches Qualitäts-Gate, führt vorher automatisch ESLint im Fix-Modus aus.
- `npm test`: Reiner Node-Testlauf (nützlich für schnelle Regressionstests ohne Linting).
- `npm run preflight -- --with-quality`: Start-/Release-Check (Node-Version, Pflichtdateien, JSON, doppelte Skripte) plus anschließendes Qualitäts-Gate.
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
# Entwicklerhandbuch ModulTool

## Zielsetzung
Dieses Handbuch hilft Entwicklern, das Projekt zu verstehen, lokal zu starten und sicher zu erweitern.

## Projektüberblick
- **Typ:** Single-File-Webanwendung (HTML, CSS, JavaScript in `index.html`).
- **Persistenz:** Browser `localStorage` mit Versionierung.
- **Funktionalität:** Modulverwaltung, Archiv (Genres, Moods), Playlist mit Audio-Player, Zufallsgeneratoren, Logging, Selbsttests sowie eine integrierte Backup-Prüfung.
- **Funktionalität:** Modulverwaltung, Archiv (Genres, Moods), Playlist mit Audio-Player, Zufallsgeneratoren, Logging, Selbsttests.

## Start & Nutzung
1. Öffne `index.html` direkt im Browser (Doppelklick oder `file://`-Pfad).
2. Aktiviere bei Bedarf Self-Repair, um inkonsistente Daten zu korrigieren.
3. Nutze Export-/Import-Buttons, um Sicherungen zu erstellen oder einzuspielen.
4. Steuere die Playlist wahlweise per Maus (Drag & Drop) oder Tastatur: `Enter`/`Leertaste` startet die Wiedergabe, `Alt` + `Pfeil hoch/runter` sortiert, `Entf` entfernt Einträge.

## Strukturvorschlag
Um zukünftige Arbeiten zu erleichtern, sollte das Projekt in folgende Verzeichnisse gegliedert werden:
```
TOOL-2025/
├─ public/          # HTML-Grundgerüst, statische Assets
├─ src/
│  ├─ styles/       # CSS/SCSS Dateien
│  ├─ scripts/      # JavaScript-Module
│  └─ components/   # Wiederverwendbare UI-Komponenten
├─ tests/           # Unit- und UI-Tests
├─ docs/            # Dokumentation
├─ tools/           # Build-/Analyse-Skripte
└─ package.json     # Konfiguration, Scripts, Abhängigkeiten
```

## Entwicklungsrichtlinien
- **Code-Qualität:** ESLint/Prettier einrichten, um Stil und Qualität zu erzwingen.
- **Testing:** Jest/Playwright für Unit- und End-to-End-Tests verwenden. Selbsttests im Tool als Smoke-Tests beibehalten.
- **Internationalisierung:** Strings extrahieren und Übersetzungsdateien nutzen.
- **Barrierefreiheit:** WCAG 2.2 berücksichtigen, Tastatursteuerung und Screenreader-Unterstützung sicherstellen.
  - Bestehende Kurzbefehle: Dropzone reagiert auf `Enter`/`Space`, Playlist-Elemente besitzen Fokusrahmen sowie Alt+Pfeiltasten zum Sortieren.
- **Performance:** Rendering-Strategien überdenken (z. B. Virtual DOM, Web Components, Svelte/React).
- **Security:** Eingaben escapen, JSON-Imports validieren und die bestehende CSP (`default-src 'self'`, `object-src 'none'`) beibehalten. Plugin-Inhalte werden per Sanitizer bereinigt (erlaubt Standard-Textformatierungen, blockiert Skripte/Events) und zusätzlich in Sandbox-Iframes ohne Same-Origin-Kontext angezeigt.
- **Security:** Eingaben escapen, JSON-Imports validieren, CSP definieren, um XSS zu verhindern.
- **Plugins:** Klar definierte Schnittstellen mit Sandbox (z. B. iframe oder Web Worker) vorsehen.

## Build- & Toolchain-Empfehlung
- **Bundler:** Vite (schnelles Dev-Server Setup, HMR).
- **Transpiler:** TypeScript für bessere Wartbarkeit und Typprüfung.
- **Styling:** Tailwind CSS oder CSS-Variablen beibehalten, aber modulare Struktur.
- **CI/CD:** GitHub Actions mit Linting, Tests, Build, Accessibility-Checks (Pa11y, axe-core).

## Automatische Tests & Validierung (Stand)
- **Node-Testlauf (`node --test`)** prüft das Tool in einer kopf-losen Umgebung (ohne echten Browser) mit `jsdom` (Browser-Simulation in Node) und deckt derzeit folgende Fälle ab:
  - `Alt` + `Pfeil` (Sortierkürzel) verschiebt Einträge korrekt und aktualisiert den aktuellen Index.
  - `Entf` (Löschtaste) entfernt den gewählten Track und setzt den Fokusindex zurück.
  - `validatePluginData` normalisiert Plugin-Dateien (Leerräume, ungültige Links, leere Abschnitte).
  - `registerPlugin` registriert Module und Renderer, doppelte Versionen werden abgefangen.
  - `removePlugin` löscht Plugin + Modul aus Zustand und Registry.
  - `assertBackupSchema` stoppt defekte Sicherungen (z. B. ohne Modulliste) bevor sie importiert werden.
- **JSON-Schema (`schemas/backup-schema.json`)** beschreibt jetzt das komplette Backup-Format. Die Tests validieren automatisch, ob `buildBackup()` dieses Schema erfüllt. Nutze `npm test`, um die Prüfungen lokal auszuführen.
- **Vorbereitung für weitere Checks:** Das Testsetup kann um zusätzliche Szenarien (z. B. Import-Fehler, Modul-Registry) erweitert werden. Die exponierte Test-API `window.ModulToolTestAPI` stellt zentrale Funktionen (`renderPlaylist`, `reorderPlaylist`, `validateBackup`) sowie Plugin-Helfer (`validatePluginData`, `registerPlugin`, `removePlugin`, `clearPlugins`, `moduleRendererExists`) bereit.

- **Plugin-Schnittstelle (Stand nach Optimierung)**
  - **Importformat:** JSON-Datei mit Mindestfeldern `name`, optional `description`, `version`, `author`, `moduleName`, `moduleId`, `sections`, `links`.
  - **Sections:** Array aus Objekten `{"title": string, "content": string}`. Texte werden im Tool bereinigt; erlaubte Auszeichnungen bleiben erhalten, Zeilenumbrüche werden zu `<br>`.
  - **Sicherheit:** Plugin-Ansichten akzeptieren nur einen freigegebenen HTML-Teilumfang (`<strong>`, `<em>`, Listen, Links). Alle Skript-/Event-Attribute sowie unsichere Protokolle werden verworfen und Links erhalten automatisch `rel="noopener noreferrer"`.
  - **Darstellung:** Plugin-Abschnitte erscheinen in Sandbox-Iframes (`sandbox="allow-popups allow-popups-to-escape-sandbox"`, `referrerpolicy="no-referrer"`). Themefarben werden beim Rendern in das Iframe übernommen, damit Inhalte konsistent aussehen.
- **Node-Testlauf (`node --test`)** prüft seit dieser Iteration die wichtigsten Playlist-Aktionen. Dazu wird das Tool in einer Kopf-los-Umgebung (ohne echten Browser) mit `jsdom` (Browser-Simulation in Node) geladen und folgende Abläufe werden überprüft:
  - `Alt` + `Pfeil` (Sortierkürzel) verschiebt Einträge korrekt und aktualisiert den aktuellen Index.
  - `Entf` (Löschtaste) entfernt den gewählten Track und setzt den Fokusindex zurück.
- **JSON-Schema (`schemas/backup-schema.json`)** beschreibt jetzt das komplette Backup-Format. Die Tests validieren automatisch, ob `buildBackup()` dieses Schema erfüllt. Nutze `npm test`, um die Prüfungen lokal auszuführen.
- **Vorbereitung für weitere Checks:** Das Testsetup kann um zusätzliche Szenarien (z. B. Import-Fehler, Modul-Registry) erweitert werden. Dabei hilft die exponierte Test-API `window.ModulToolTestAPI`, die zentrale Funktionen (z. B. `renderPlaylist`, `reorderPlaylist`, `validateBackup`) bereitstellt.

- **Plugin-Schnittstelle (Stand nach Optimierung)**
  - **Importformat:** JSON-Datei mit Mindestfeldern `name`, optional `description`, `version`, `author`, `moduleName`, `moduleId`, `sections`, `links`.
  - **Sections:** Array aus Objekten `{"title": string, "content": string}`. Texte werden im Tool HTML-escaped und Zeilenumbrüche in `<br>` umgewandelt.
  - **Links:** Nur `http`/`https`-URLs werden akzeptiert. Label wird automatisch aus `label` oder `title` gezogen.
  - **Registrierung:** Importierte Plugins erhalten eine eindeutige ID, werden als eigenständiges Modul (`Plugin – <Name>`) registriert und im Plugin-Manager gelistet. Kollisionen mit vorhandenen Modul-IDs werden automatisch durch neue Slugs (`plugin-name-2`, `plugin-name-3`, …) gelöst.
  - **Export:** Im Plugin-Manager steht pro Plugin ein Button „Exportieren“. Er erzeugt ein bereinigtes JSON inklusive `moduleName`/`moduleId`, sodass Plugins auf anderen Installationen erneut eingespielt werden können.
  - **Entfernung:** Über den Plugin-Manager kann ein Plugin inklusive Modul gelöscht werden; Self-Repair räumt verwaiste Einträge auf.

## Datenexport & Manifest
- **Manifest-Button:** Exportiert eine schlanke Übersicht (Version, Theme, Modul-/Plugin-Anzahl, Archivgrößen, Einstellungen).
- **Backup-Export:** Enthält Manifest + bereinigten Zustand (Module, Kategorien, Genres, Moods, Playlist, Plugins, Logs, Log-Filter).
- **Importprüfung:** Backups werden via `assertBackupSchema` strikt validiert (Schema, Pflichtfelder, URL-Check). Playlisteinträge werden beim Import normalisiert (`id`, `title`, `artist`, `src`).
- **Backup-Prüfung im UI:** Das Modul „Backup-Prüfung“ erlaubt es, JSON-Dateien, Texteingaben oder den aktuellen Zustand gegen das Schema zu testen. Ergebnisse werden farblich markiert und mit Statistiken (Module, Plugins, Playlist-Länge, Archivgrößen) dargestellt.
- **Importprüfung:** Backups werden validiert (Arraytypen, Pflichtfelder, URL-Check). Playlisteinträge werden beim Import normalisiert (`id`, `title`, `artist`, `src`).
- **Log-Filter:** Nutzer können im Header zwischen `Alles`, `Erfolge`, `Hinweise`, `Fehler` wechseln. Einstellung wird im Backup gespeichert und beim Import wiederhergestellt.

- **Datenmodelle (Ist-Zustand)**
  - `state.modules`: Array von Objekten `{id, name}`. IDs werden slugifiziert und bei Duplikaten automatisch erweitert.
  - `state.categories`: Objekt `{[kategorieName]: {genres: string[], moods: string[]}}`.
  - `state.genres`/`state.moods`: Sortierte Arrays eindeutiger Strings.
  - `state.playlist`: Array von `{id, title, artist, src, _blob?}`.
  - `state.settings`: Abgedeckt durch `state.theme`, `state.autosave`, `state.selfrepair`, `state.toasts`.
  - `state.plugins`: Array sanierter Plugin-Definitionen `{id, name, description, version, author, moduleId, moduleName, sections, links}`.

## Erweiterungsschritte
1. Bestehenden Code analysieren (`index.html`).
2. Funktionen isolieren und in Module aufteilen.
3. Tests schreiben, bevor Refactorings durchgeführt werden.
4. Neue Features nur über dokumentierte Schnittstellen hinzufügen.
5. Barrierefreiheit prüfen (Screenreader, Tastatur, Kontraste).

## Logging & Monitoring
- Logeinträge enthalten `time`, `type`, `msg`.
- Empfehlung: Log-Level vereinheitlichen (`info`, `warning`, `error`), Filtermöglichkeiten implementieren.
- Export als JSON ergänzen, um maschinelle Auswertung zu erleichtern.

## Deployment & Portabilität
- Offline-Betrieb ermöglichen (Service Worker für Caching, PWA-Manifest).
- Portable Distribution als ZIP inklusive Dokumentation und Beispielkonfigurationen.

## Anhang
- Weitere Dokumentation siehe `docs/analysis-report.md` und `docs/structure.txt`.

