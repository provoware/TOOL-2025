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
- **Performance:** Rendering-Strategien überdenken (z. B. Virtual DOM, Web Components, Svelte/React).
- **Security:** Eingaben escapen, JSON-Imports validieren, CSP definieren, um XSS zu verhindern.
- **Plugins:** Klar definierte Schnittstellen mit Sandbox (z. B. iframe oder Web Worker) vorsehen.

## Build- & Toolchain-Empfehlung
- **Bundler:** Vite (schnelles Dev-Server Setup, HMR).
- **Transpiler:** TypeScript für bessere Wartbarkeit und Typprüfung.
- **Styling:** Tailwind CSS oder CSS-Variablen beibehalten, aber modulare Struktur.
- **CI/CD:** GitHub Actions mit Linting, Tests, Build, Accessibility-Checks (Pa11y, axe-core).

## Datenmodelle (Ist-Zustand)
- `state.modules`: Array von `{id, name, category, tags, content}`.
- `state.categories`: Array von Strings (Kategorie-Namen).
- `state.genres`/`state.moods`: Arrays von Strings.
- `state.playlist`: Array von `{id, title, artist, src, _blob}`.
- `state.settings`: Abgedeckt durch `state.theme`, `state.autosave`, `state.selfrepair`, `state.toasts`.

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

