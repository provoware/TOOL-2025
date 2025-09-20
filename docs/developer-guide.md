# Entwicklerhandbuch ModulTool

## Zielsetzung
Dieses Handbuch hilft Entwicklern, das Projekt zu verstehen, lokal zu starten und sicher zu erweitern.

## Projektüberblick
- **Typ:** Single-File-Webanwendung (HTML, CSS, JavaScript in `index.html`).
- **Persistenz:** Browser `localStorage` mit Versionierung.
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
- **Security:** Eingaben escapen, JSON-Imports validieren, CSP definieren, um XSS zu verhindern.
- **Plugins:** Klar definierte Schnittstellen mit Sandbox (z. B. iframe oder Web Worker) vorsehen.

## Build- & Toolchain-Empfehlung
- **Bundler:** Vite (schnelles Dev-Server Setup, HMR).
- **Transpiler:** TypeScript für bessere Wartbarkeit und Typprüfung.
- **Styling:** Tailwind CSS oder CSS-Variablen beibehalten, aber modulare Struktur.
- **CI/CD:** GitHub Actions mit Linting, Tests, Build, Accessibility-Checks (Pa11y, axe-core).

## Automatische Tests & Validierung (Stand)
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

