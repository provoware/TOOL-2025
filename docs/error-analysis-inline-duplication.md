# Fehleranalyse: Inline-Skript-Duplikate blockieren Funktionen

## Kurzüberblick
- **Symptom:** Beim Laden von `index.html` bleibt das Dashboard statisch. Buttons, Dropzones und Konfigurationsschalter reagieren nicht – einzig das reine Anzeigen der Seite klappt.
- **Beobachtung:** Der Browser protokolliert einen `SyntaxError (Syntax-Fehler: Falscher Codeaufbau)` direkt beim Laden des Inline-Skripts. Danach wird kein weiterer JavaScript-Code ausgeführt.
- **Hauptursache:** Dreifache Definition derselben Konstanten und Hilfsfunktionen (u. a. `const state` und `function persist`) innerhalb des sofort ausgeführten Skriptblocks.

## Detailbefunde
1. **Mehrfaches `const state`:**
   - Moderne State-Struktur mit Versionsfeldern und Verlauf ab Zeile 2099.【F:index.html†L2089-L2113】
   - Zweite Version mit veraltetem Shape (`version: '1.1.4'`) ab Zeile 3105.【F:index.html†L3083-L3112】
   - Dritte Version (`version: '1.1.3'`) ab Zeile 3280.【F:index.html†L3260-L3292】
   - Der JavaScript-Parser bricht bei der zweiten Deklaration ab, weil `const` nicht mehrfach definiert werden darf.
2. **Doppelte Funktionsdefinitionen:**
   - `function persist(options={})` (neue Signatur mit Prozessereignissen) wird direkt von einer älteren Kurzversion `function persist(){…}` überschrieben.【F:index.html†L5170-L5194】
   - Gleiches Muster bei `runSelfTests`, `addToArchive`, `addMoods`, `addCategory` u. v. m.; spätere Kopien entfernen Parameter oder Logging-Aufrufe.【F:index.html†L4354-L4372】【F:index.html†L5170-L5202】
3. **Wiederholte Hilfsfunktionen:**
   - Blöcke wie `assertBackupSchema`, `slugify`, `uuid` tauchen in leicht abgewandelter Form mehrfach auf und verweisen teils auf nicht mehr existierende Felder.【F:index.html†L3068-L3116】【F:index.html†L3248-L3286】

## Auswirkungen
- **Gesamtausfall der Interaktion:** Weil der Parser schon beim zweiten `const state` stoppt, laufen weder Event-Bindings noch Render-Funktionen an.
- **Inkongruente Logik:** Selbst wenn der Syntaxfehler behoben würde, sorgen überlagerte Funktionsdefinitionen dafür, dass neue Schutzmechanismen (z. B. Prozessmeldungen im `persist`) verloren gehen.
- **Hohe Wartungsgefahr:** Die dreifachen Blöcke deuten auf einen Merge/Copy-Fehler. Ohne Build-Pipeline bleiben solche Fehler unentdeckt.

## Sofortmaßnahmen
1. **Skript bereinigen:**
   - Alte Doppelblöcke entfernen, sodass jede Konstante/Funktion nur einmal existiert.
   - Bei Unklarheit: auf die Version mit aktuellster Versionsnummer (`DEFAULT_STATE_VERSION`) und umfangreicher Signatur setzen.
2. **Smoke-Test im Browser:**
   - Entwicklertools öffnen (`F12`), Console leeren und Seite neu laden. Es darf kein `Identifier has already been declared` mehr erscheinen.
3. **Regressionstest:**
   - `npm run lint` und `npm test` lokal ausführen, um Syntaxfehler und doppelte Definitionen frühzeitig zu erkennen.

## Prävention
- **Build-Setup:** Den Inline-Code in modulare Dateien (z. B. `src/state.js`, `src/ui.js`) aufteilen und mit einem Bundler (Vite/Rollup) zusammenführen. Damit prüft ein Linter die Dateien vor dem Zusammenfügen.
- **CI-Schutz:** Git-Hook oder Pipeline anlegen, die `npm run lint` vor jedem Commit ausführt.
- **Code-Reviews:** Merge-Vorlagen ergänzen, die auf doppelte Blöcke in `index.html` achten (z. B. "Keine zweite `const state` Deklaration zulassen").
- **Langfristig:** Inline-Skript in ein echtes Modul migrieren, CSP-Härtung nutzen und automatische Tests (Playwright) für die wichtigsten Buttons hinterlegen.

## Weiterer Hinweis für Laien
- Sollte der Browser bereits mit einer alten Kopie geladen sein: Seite mit `Strg + F5` neu laden, um Cache zu umgehen.
- Wenn du unsicher bist, welche Zeilen gelöscht werden dürfen, erstelle vorher eine Sicherheitskopie (`cp index.html index.html.bak`).
