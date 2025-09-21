# ModulTool Analysebericht (Professional Edition)

## 1. Executive Summary
- **Produktstatus:** Funktionsreiches Offline-Dashboard mit Modul-, Archiv- und Playlistverwaltung in einer monolithischen HTML-Datei.
- **Reifegrad nach Domänen:** Architektur 2/5, Daten & Persistenz 2/5, Sicherheit 3/5, Barrierefreiheit 3/5, UX 3/5, Performance 2/5, Audio 3/5, Tests 3/5, Release & Governance 1/5.
- **Kernfortschritte:** Strenger Backup-Import mit JSON-Schema, gehärtete Plugin-Pipeline (Sanitizing + Sandbox-Iframes), verbesserte Tastatursteuerung, Live-Status (`aria-live`) und Systempräferenz-Handling (Motion/Kontrast) inklusive skalierbarer Typografie, laienfreundlicher Konfigurations-Assistent mit Preset-Buttons, Klartext-Zusammenfassung, Sofort-Feedback **und neuem Konfigurations-Export/-Import (JSON-Datei mit Preset, Layout und Schaltern)** sowie Test-API für automatisierte Prüfungen, ein prozessspezifisches Status-Monitoring (Backup/Import) mit sichtbaren Fokus-Rahmen auf allen Interaktionselementen, ein laienfreundliches Hilfe-Center (F1) mit Schritt-für-Schritt-Anleitungen, kopierbarem Spickzettel **und neuem Kapitel „Einstellungen sichern & teilen“, das Export/Import für Laien erklärt**, sowie flexible Layout-Vorlagen (Ausgewogen, Module-/Audio-Fokus, Arbeitsfläche, Stapeln) samt Sichtbarkeits-Assistent (Mini-Vorschau, Klartextstatus, Schnellbuttons), die sich per Button wechseln lassen und Backups/Manifeste mitschreiben, ergänzt um einen Smart-Error-Guard (globale Fehlerfänger, Datei-Prüfung, Feedback-Panel, Debug-Modus) mit `guardAction`-Hilfsfunktion, Plugin-Vorprüfung, Feedback-Zähler/Badge und Debug-Export, **Fokusfallen für Hilfe- und Konfigurationsdialog**, automatisierte Code-Prüfungen (`npm run verify` ruft jetzt automatisch `npm run lint` über `pretest`), **eine laienfreundliche Modul-Anlage mit Duplikatschutz und Präventionshinweisen**, **leere Zustände und Skeleton-Loader für Playlist/Module inklusive Dashboard-Zusammenfassung** sowie einen Event-Bus mit `STATE_CHANGED`/`LOG_ADDED`-Events samt gekürzten Autosave-Snapshots, Screenreader-Digest und neuem State-Digest-Dashboard (Zahlen, Tipps, Verlauf) im Header **sowie einen Start-Check, der Browser-Abhängigkeiten automatisch prüft, Speicher-Fallbacks aktiviert und die Ergebnisse laienverständlich im Dashboard protokolliert (inklusive Node-Test für den Report), während Backup und Manifest nun das vollständige State-Digest-Protokoll inklusive Verlauf transportieren und JSON-/Audio-Importe eine Signaturprüfung mit laienfreundlichen Fehlermeldungen besitzen sowie eine Start-Routine (`npm start`/`node tools/start-tool.js`), die Standardordner erzeugt, einen lokalen Server startet und den Browser automatisch öffnet. Neu hinzugekommen ist ein geschützter Löschpfad für Module und Plugins: `removeModule`/`removePlugin` laufen über `guardAction`, liefern Warn-Logs, Prozessansagen und Präventionstipps, damit Laien das Entfernen nachvollziehen und versehentliche Löschungen vermeiden.**
- **Hauptdefizite:** Fehlende Layer-Struktur, Event-Bus bisher ohne Namespaces/Statecharts, keine Undo/Redo-Mechanik, eingeschränkte Build-/Release-Prozesse und unvollständige Sicherheits- sowie A11y-Checks.
- **Priorisierte Sofortmaßnahmen:** (1) Architekturtrennung mit Store/Service-Layern + Event-Bus, (2) Transaktionskern mit stabilen IDs und atomaren Writes, (3) A11y-Advanced inkl. System-Preferences und Live-Regionen, (4) Worker-Offloading & Performance-Budgets, (5) Signierte, geprüfte Import-/Export-Kette.

## 2. Produkt- und Nutzerkontext
Das ModulTool adressiert Creator und Kuratoren, die offline Inhalte strukturieren, Audio-Playlisten pflegen und modulare Plugin-Inhalte konsumieren möchten. Primäre Nutzungsszenarien:
1. **Kuratiertes Archiv:** Module, Genres und Moods anlegen, klassifizieren und exportieren.
2. **Audio-Session-Steuerung:** Playlisten aus lokalen Dateien bauen, zufällige Empfehlungen abrufen und Wiedergabe verwalten.
3. **Plugin-Marktplatz lokal:** Externe Wissens- oder Hilfemodule importieren, sicher anzeigen und weiterverteilen.
4. **Auditing & Reporting:** Logbuch, Statistiken und Self-Repair für Transparenz und Fehlerbehebung.

## 3. Architektur-Tiefenblick
| Bereich | Ist-Zustand | Risiken | Maßnahmen (Zielbild) |
| --- | --- | --- | --- |
| Struktur | Single-File (`index.html`) mit Inline-Skripten. Logik in großen Funktionsblöcken (`init`, `bindEvents`, `render*`). | Hohe Kopplung, erschwerte Tests, CSP benötigt Inline-Ausnahmen. | Schichtenmodell (UI ↔ Store ↔ Services ↔ Integrationen), Module via ES-Module Bundling, CSP ohne `unsafe-inline`.
| State | Globales `state`-Objekt, Self-Repair korrigiert Inkonsistenzen. | Keine Transaktionen, fehlende Undo/Redo, Konflikte bei parallelen Aktionen. | Event-gesteuerter Store mit Immutability, Operation-Log, Snapshot- und Migration-Schicht.
| Kommunikation | Direkte Funktionsaufrufe, `bindEvents` verteilt Handler, Event-Bus liefert erste `STATE_CHANGED`/`LOG_ADDED`-Events. | Schwer erweiterbar, keine Beobachtung, Plugin-Integration ad hoc. | Event-Bus (Publish/Subscribe) mit Namespaces `ui/*`, `audio/*`, `storage/*` und Audit-Logging.
| Services | Storage-Operationen in UI-Layer eingebettet. | Mehrfachverwendung komplex, Tests schwer. | Services kapseln LocalStorage, Audio, Dateisystem, Backup-Validierung.
| Erweiterbarkeit | Plugin-Import + Sandbox vorhanden, Lifecycle nicht definiert. | Keine garantierte Abwärtskompatibilität, fehlende Capability-Prüfung. | Stabiler Plugin-Contract (Manifest, Capability Matrix, Lifecycle Hooks `init/activate/deactivate`).

## 4. Daten-, Persistenz- und Integritätsanalyse
- **IDs:** Module und Playlist-Einträge nutzen slugifizierte Strings; Kollisionen werden sequentiell behoben. Für langfristige Stabilität fehlen UUID/ULID und zentrale Index-Maps.
- **Versionierung:** `state.version` existiert, Migrationen werden nicht dokumentiert oder automatisiert.
- **Persistenzpfad:** `localStorage` + `JSON.stringify`. Kein atomarer Commit, keine Fehlerbehandlung bei Quoten oder beschädigten Backups.
- **Neu:** Start-Check erkennt blockierten Speicher frühzeitig, schaltet automatisch auf einen temporären Speicher (Memory-Fallback) um, meldet dies im Dashboard und informiert Laien über nötige Backups.
- **Backup-Qualität:** Neues JSON-Schema deckt Pflichtfelder, Typen und Link-Validierung ab. Ergänzt durch UI-Prüfmodul.
- **Neu:** Validierungsreport fasst doppelte IDs, Playlist-Konflikte und bereinigte Logeinträge zusammen, zeigt sie laienverständlich im Backup-Prüfmodul an und speichert sie im Import-Log.
- **Neu:** Autosave erzeugt sanitisierte Snapshots (max. 200 Logeinträge, stabile IDs) und meldet einen Screenreader-Digest über `stateDigestLive`.
- **Neu:** State-Digest-Dashboard im Header fasst Module, Plugins, Playlist und Archivzahlen laienverständlich zusammen, gibt konkrete Tipps (z. B. „Lege dein erstes Modul an“) und führt ein begrenztes Verlaufsprotokoll (max. 8 Einträge) für Transparenz.
- **Neu:** Backups und Manifest führen das Digest-Resümee samt Zeitstempel-Verlauf mit, sodass Importe den Dashboard-Status laienverständlich erklären.
- **Neu:** Exportdateien erhalten automatisch sprechende Namen (`modultool-backup_YYYYMMDD-HHMMSS_vXYZ.ext`) samt fortlaufendem Zähler; das neue Feld `exportSequences` hält die Zählerstände für Manifest, Backup, Playlist, Plugins und Hilfetexte fest.
- **Empfohlene Maßnahmen:** Transaktionslog (append-only), Wiederherstellungsplan mit Migrationsliste, atomare Writes über temporäre Schlüssel und Undo/Redo-Stack (Dateinamens-Policy ist abgedeckt).

## 5. Sicherheits- und Compliance-Status
- **Import-Sicherheit:** `assertBackupSchema` + Sanitisierung von Plugin-HTML (Whitelist + `rel="noopener noreferrer"`). Sandbox-Iframes verhindern direkte DOM-Interaktion.
- **Neu:** Modul- und Plugin-Entfernung läuft über `guardAction` (Warn-Logs, Prozessfeedback, Präventionstipps) und ruft automatisch Self-Repair-Hinweise auf, falls Nutzer:innen versehentlich löschen.
- **Neu:** Smart-Error-Guard fängt globale JS-Fehler ab, prüft JSON-/Audio-Dateien vor dem Import, speichert Warnungen im Feedback-Panel, stellt `guardAction` für riskante UI-Aktionen bereit, prüft Plugin-Dateien vor dem Einlesen, erzeugt Debug-Schnappschüsse inkl. Download-Knopf für Supportfälle **und blendet jetzt laienverständliche Präventionshinweise ein** (z. B. für fehlerhafte Plugin-/Playlist-Dateien oder deaktivierte Datei-Prüfung) **sowie Schutz bei der Modul-Anlage (Duplikatvermeidung, Rückmeldung im Prozessbanner).**
- **Neu:** Start-Check-Panel prüft Browser-Fähigkeiten (Speicher, Datei-Import, Downloads, IDs, Audio, Clipboard) automatisch, listet laienfreundliche Hinweise auf, aktualisiert Logs/Prozessbanner und ist über einen Node-Test abgesichert.
- **Offene Punkte:** Kein globaler Sanitizer für alle Eingabefelder, Signaturprüfung deckt aktuell JSON- und Audio-Importe ab, aber keine Binärformate (z. B. Backups mit Anhängen), fehlendes Rechte-/Berechtigungsmodell und keine Threat-Model-Dokumentation.
- **Empfehlungen:** DOMPurify-Äquivalent offline kompilieren, Validierungspipeline (Header-Sniffing, Dateiendung) implementieren, Berechtigungskonzept (Schreibschutz, Papierkorb mit TTL) etablieren, signierte Releases und Integritätsanzeige bereitstellen.

## 6. Barrierefreiheit & Inclusive Design
- **Positive Aspekte:** Mehrere High-Contrast-Themes, Tastaturzugriff auf Playlist und Dropzone (Enter/Space, Alt+Pfeile, Entf), neue `:focus-visible`-Rahmen für Buttons/Eingaben/Links, Unterstützung von `prefers-reduced-motion`/`prefers-contrast`, Live-Statusbanner (`aria-live`) sowie Prozess-Live-Region für Backup-Import/-Prüfung, skalierbare Schriftgrößen (14–20 px Presets) und ein modales Hilfe-Center mit Tastatur- und Screenreader-Unterstützung.
- **Neu:** Log-Bereich meldet jetzt eine zusammenfassende Screenreader-Ausgabe (sichtbar + `aria-live`) mit Filterstatus, Anzahl und letztem Eintrag; Self-Repair-Resultate sowie Backup-Prüfung aktualisieren parallel das Prozessbanner (`announceProcess`) und informieren Laien über Erfolg oder Korrekturen ohne Blick ins Log.
- **Neue Layout-Kontrolle:** Sieben vorkonfigurierte Layout-Buttons (Ausgewogen, Module/Audio breit, Nur Module, Nur Audio, Arbeitsfläche, Übereinander) lassen sich ohne Fachsprache bedienen, speichern sich im Backup/Manifest und geben nach dem Klick sofortige Statusmeldungen.
- **Sichtbarkeits-Assistent:** Mini-Layout-Vorschau, Klartextliste („links sichtbar“, „rechts ausgeblendet“) und Schnellbuttons („Alles anzeigen“, „Weiter zu…“) erklären die Fenster-Anordnung für Laien und erleichtern Korrekturen.
- **Neue Interaktionshilfe:** Konfigurations-Assistent mit vier Presets (Allround, Barrierefrei, Fokus, Performance), Klartext-Zusammenfassung und synchronisierten Buttons/Checkboxen, sodass Laien ohne Fachbegriffe Animationen, Kontrast, Schriftgröße und Sicherheitsoptionen konfigurieren können.
- **Defizite:** Fokusfallen existieren jetzt für Hilfe- und Konfigurationsdialoge, weitere Overlays benötigen denselben Schutz; Prozessregion deckt aktuell Backup/Import ab (weitere Langläufer wie Selbsttests sollten folgen), Farbkontraste werden noch nicht automatisiert verifiziert.
- **Offene Konfigurations-Themen:** Geführte Onboarding-Touren und eine automatisierte Prüfung der Preset-Beschreibungen auf Barrierefreiheit stehen noch aus.
- **Professionelle Zielsetzung:** A11y-Audit (WCAG 2.2 AA), Fokusfallen beseitigen, Dialoge mit Escape/Focus-Trap ergänzen, Live-Regionen für Langläuferprozesse ausbauen, automatisierte A11y-Regressionen und dokumentierte Tastaturkürzel.

## 7. Nutzererlebnis & Microcopy
- **Stärken:** Umfangreiche Tooltips, laienfreundliches Hilfe-Center mit Shortcut-Spickzettel, Logbuch mit farbcodierten Level-Icons, Manifest-Export und klare Buttons für Kernaktionen sowie ein Feedback-Badge mit Uhrzeit- und Typangaben, das Nutzer:innen sofort zeigt, wie viele Hinweise oder Fehler aktuell offen sind. Neu hinzugekommen sind automatische Tipp-Hinweise direkt im Feedback-Bereich, damit Laien nach einem Fehler sofort nachvollziehen können, wie sie den nächsten Versuch sicher gestalten, **sowie eine modulare Schutzlogik, die beim Anlegen neuer Module doppelte Namen verhindert und den Erfolg über Prozessbanner/Feedback kommuniziert. Leere Zustände mit Handlungsanweisung, Skeleton-Loader für laufende Audioimporte und ein Dashboard-Statustext erklären Einsteiger:innen jetzt, was zu tun ist. Die Log-Zusammenfassung liefert zusätzlich Klartext über Filter, Anzahl und letzte Meldung – sichtbar und für Screenreader, und das neue State-Digest-Dashboard zeigt Module/Plugins/Playlist/Archiv als Zahlenkarten mit Schritt-für-Schritt-Tipps und Änderungsverlauf. Das Hilfe-Center beantwortet jetzt auch gezielt die Frage „Einstellungen sichern & teilen“ mit Buttons für Export und Import.**
- **Neu:** Start-Check im Dashboard listet geprüfte Browser-Funktionen (Speicher, Import, Download, IDs, Audio, Clipboard) mit Ampelfarben, Icons und Klartexttipps auf und verweist Laien bei Einschränkungen auf nächste Schritte.
- **Layout-Flexibilität:** Bereichsvorlagen per Button (Ausgewogen, Fokus, Übereinander) inklusive sofortiger Ansage erhöhen Verständlichkeit und funktionieren auch auf kleinen Displays; die Sichtbarkeitsanzeige erläutert zusätzlich, welche Fenster aktuell eingeblendet sind.
- **Farbampel für Bereiche:** Farblegende im Kopfbereich plus Modul-, Arbeitsflächen-, Audio- und Archivkarten mit abgestimmten Akzentfarben heben nun jeden Fensterbereich konsistent hervor (Blau=Module/Info, Grün=Arbeitsfläche, Violett=Audio, Orange=Archiv) und erleichtern Laien die Orientierung.
- **Lücken:** Farbcodierung abseits der vier Hauptbereiche (Formulare, Dialoge, Statusleisten) bleibt uneinheitlich, Self-Repair kommuniziert Entscheidungen nur via Log und ein geführter Onboarding-Assistent fehlt weiterhin. Skeleton-Loader existieren bislang nur für Playlist-Importe (Module/Archiv folgen im Rahmen der Build-Umstellung).
- **Empfehlungen:** Empty States mit CTA, konsistentes Farbset (Grün Erfolg, Blau Info, Orange Aktion, Rot Fehler), Microcopy-Standards (Verb + Nutzen), Onboarding-Assistent mit geführten Touren und Feedback-Schleifen mit Nutzerbewertungen.

## 8. Performance & Robustheit
- **Status quo:** Rendering erfolgt synchron, Parsing/Validierung auf dem Main-Thread, keinerlei Debounce/Throttle, keine Messpunkte.
- **Risiken:** UI-Jank bei großen Backups oder Audiodateien, Speicherlimit von `localStorage` unbewacht, Audio-Kontext immer aktiv.
- **Roadmap:** Worker für JSON-Validierung, Audio-Wellenform und große Dateiscans; Performance-Budgets definieren (TTI < 1,5 s, Interaktionslatenz < 100 ms); Messpunkte via `performance.now()`. Speicher-Wächter mit Preflight-Größenschätzung und Alternativen (Teil-Export, Dateisystem-API).

## 9. Audio-Engine
- **Ist:** Audio wird über `<audio>`-Element gesteuert, Autoplay respektiert Nutzerinteraktion implizit, jedoch keine explizite Freigabe.
- **Risiken:** Keine Latenzsteuerung, Pufferung begrenzt, kein Fehlerhandling bei Dateiproblemen.
- **Empfehlungen:** AudioContext lazy initialisieren, Preloading + Fehlerpfade, Marker/Regions persistieren und editierbar machen.

## 10. Testing, Tooling & Release
- **Tests:** `npm test` (Node `node --test`) prüft Playlist-Kürzel, Backup-Schema, Plugin-Lebenszyklus und ruft dank `pretest` automatisch `npm run lint` vor jedem Testlauf auf. `npm run verify` ist ein Shortcut auf `npm test`. Neu prüft ein Guard-Test, dass Präventionshinweise nur einmal angezeigt werden. Keine UI-, visuelle oder Performance-Tests.
- **Tooling:** ESLint ist integriert (`npm run lint` via `pretest`), und eine Start-Routine (`npm start`) richtet Standardordner ein, startet den lokalen Server und öffnet den Browser automatisch; Bundler, CI/CD-Pipeline und Pre-Commit-Hooks fehlen weiterhin.
- **Release:** Keine reproduzierbaren Builds, keine Signaturen oder Checksummen, keine Mehrformat-Exporte.
- **Professionelle Vorgaben:** Jest + Playwright + axe für A11y, fast-check für Property-Tests, visuelle Regression via Playwright/Pixelmatch, Performance-Smoketests, Build-Pipeline (Vite) mit deterministischem Output, Release-Signaturen (SHA256 + Signaturdatei) und Integritätshinweis im UI.

## 11. Governance & Dokumentation
- **Vorhanden:** Analysebericht, Entwicklerhandbuch, ToDo-Backlog, Strukturübersicht.
- **Fehlend:** Threat-Model (STRIDE), Styleguide (Naming, Error-Codes), Benutzer-Richtlinien (Datenschutz offline), Manifest für Distribution.
- **Ziel:** Governance-Handbuch mit Review-Checkliste, Coding-Guidelines, Release-Playbook, Contributor-Setup.

## 12. Risiko-Heatmap
| Domäne | Risiko | Auswirkung | Dringlichkeit |
| --- | --- | --- | --- |
| Persistenz ohne Transactions | Datenverlust bei Speicherfehlern | Hoch | Kritisch |
| Monolithische Architektur | Wartungsstau, Regressionen | Mittel | Hoch |
| Fehlende Sicherheitsprüfungen (Drag & Drop) | Schadcode oder fehlerhafte Dateien | Hoch | Hoch |
| Unvollständige A11y | Nutzer können Tool nicht bedienen | Mittel | Hoch |
| Keine Build-/Release-Prozesse | Inkonsistente Auslieferung | Mittel | Mittel |

## 13. Professional Roadmap (12 Wochen Vorschlag)
1. **Phase 1 – Fundament (Wochen 1–3):** Projektstruktur aufspalten, Build/Toolchain (Vite, TypeScript, ESLint, Prettier, Jest) einrichten, Event-Bus & Store-Grundlage, DOMPurify-Äquivalent integrieren.
2. **Phase 2 – Datenkern (Wochen 4–6):** Transaktionslog, Undo/Redo, atomare Storage-Schicht, UUID/ULID und Index-Maps, Dateinamenspolitik.
3. **Phase 3 – Experience & A11y (Wochen 7–9):** Prefers-* Unterstützung, Fokus-Management, Live-Regionen, Shortcut-Overlay, Empty States, Farbsemantik, Drag-/Resize-fähige Layoutsteuerung.
4. **Phase 4 – Performance & Release (Wochen 10–12):** Worker-Offloading, Performance-Budgets & Monitoring, Testsuite erweitern (Playwright, axe, visuelle Regression), signierte Builds + Release-Playbook.

## 14. Realisierte Arbeiten dieser Iteration (Referenz)
- Manifest-Download, Log-Filter-Persistenz sowie farbcodiertes Log-Rendering mit Level-Icons implementiert.
- Plugin-Manager mit Validierung, Sanitizing, Sandbox-Iframes, Export- und Entfernen-Funktion integriert.
- Backup-Import verstärkt (Normalisierung von Modulen/Kategorien/Playlist), Self-Repair erweitert und Tests ergänzt.
- Test-API exponiert (`window.ModulToolTestAPI`) inkl. Playlist-/Plugin-Helfer.
- Backup-Schema (`schemas/backup-schema.json`) erstellt und Node-Tests (`npm test`) für Schema- und Shortcut-Prüfungen angelegt.
- Dokumentation (Analyse, Entwicklerhandbuch, ToDo) aktualisiert und strukturierte Follow-ups eingetragen.
- Systempräferenz-Optionen (Motion/Kontrast), Live-Statusbanner und skalierbare Typografie im Dashboard ergänzt.
- Prozess-Live-Region für Import/Backup mit Screenreader-Feedback eingeführt und Fokus-Styling (`:focus-visible`) vereinheitlicht.
- Laienfreundliches Hilfe-Center (F1) mit Schritt-für-Schritt-Erklärungen, Shortcut-Spickzettel sowie Kopier-/Download-Funktion ergänzt.
- Konfigurations-Assistent mit Preset-Buttons, laienverständlichen Beschreibungen, synchronisierten Checkboxen und Klartext-Zusammenfassung implementiert.
- Layout-Steuerung mit sieben Buttons (Ausgewogen bis Übereinander) inklusive Backup-/Manifest-Unterstützung und Statusmeldungen ergänzt.
- Sichtbarkeits-Assistent für Bereiche & Fenster (Mini-Preview, Klartextstatus, Schnellbuttons) mit Tests zur laiengerechten Erklärung implementiert.
- Validierungs- und Import-Workflow erkennt nun doppelte IDs, ungültige Links sowie fehlende Quellen, fasst Korrekturen im Log zusammen und zeigt sie im Backup-Prüfmodul an.
- Feedback-Zentrale erhielt Zeitstempel, Typangaben und einen Status-Badge mit Hinweiszählung; `guardAction` schützt manuelle Aktionen, Plugin-Dateien werden vor dem Lesen validiert und Debug-Daten lassen sich direkt als JSON exportieren. Neu sorgen präventive Guard-Hinweise für laienverständliche Tipps (Playlist-/Plugin-Import, Manifest-/Backup-/Playlist-Export, Debug-Datei), und Exporte laufen jetzt ebenfalls über `guardAction` inklusive Erfolgsfeedback.
- **Aktuelle Iteration:** Modul-Anlage nutzt nun `guardAction` samt Präventionshinweisen, verhindert doppelte Namen, liefert automatische Erfolgsfeedbacks und erzeugt fallbackbasierte sprechende Modulnamen; Hilfe- und Konfigurationsdialog besitzen Fokusfallen (Focus-Traps) mit Rücksprung auf das auslösende Element, wodurch Tastaturnutzer:innen sicher innerhalb des Overlays bleiben. **Playlist und Modulübersicht erhalten laienfreundliche Leerstaaten samt Skeleton-Loader und das Dashboard fasst Kennzahlen jetzt in Klartext zusammen.**
- **Aktuelle Iteration (Fortsetzung):** Kopfbereich bietet jetzt ein State-Digest-Dashboard mit Karten für Module, Plugins, Playlist und Archiv, laienfreundlichen Tipps sowie einem begrenzten Änderungsverlauf; Tests prüfen die Historienbegrenzung, und Backups sowie Manifest sichern das Digest-Protokoll inklusive Verlauf, damit Importe den Status laienverständlich erklären.
- **Aktuelle Iteration (neu):** Start-Check automatisiert die Prüfung der Browser-Abhängigkeiten (Speicher, Import, Downloads, IDs, Audio, Clipboard), zeigt sie im Dashboard samt Klartexttipps an und fällt bei Speicherproblemen auf einen temporären Speicher zurück – abgesichert durch einen Node-Test.
- **Aktuelle Iteration (Start-Routine):** `npm start`/`node tools/start-tool.js` legen Standardverzeichnisse an, starten einen lokalen HTTP-Server, öffnen automatisch den Browser und geben laienfreundliches Terminal-Feedback für den gesamten Ablauf.
- **Aktuelle Iteration (Löschschutz):** `removeModule` und `removePlugin` laufen jetzt über `guardAction`, erzeugen Warn-Logs, Prozessmeldungen und Feedback-Hinweise (inklusive Self-Repair-Tipp) und sind durch neue Node-Tests abgesichert.
- **Aktuelle Iteration (Konfiguration):** Ein Konfigurations-Export/-Import erzeugt laienverständliche JSON-Dateien mit Preset, Layout und Sicherheitsschaltern, zeigt Statusmeldungen im Assistenten an und ist über neue Node-Tests abgesichert.

## 15. Nächste Schritte (Top 5)
1. **Architektur neu schneiden:** UI in modulare Komponenten überführen, Event-Bus + Statecharts einbauen, Services isolieren.
2. **Transaktionskernel bauen:** UUID/ULID, Operation-Log, Undo/Redo, atomare Writes, Migrationen dokumentieren.
3. **A11y-Advanced finalisieren:** Fokusfallen schließen, Dialogsteuerung per Escape, Live-Regionen für Langläufer und automatisierte Screenreader-/Kontrast-Tests.
4. **Worker & Performance-Budgets:** CPU-intensive Aufgaben auslagern, Messpunkte setzen, Speicher-Wächter implementieren.
5. **Sichere Import-/Export-Pipeline:** Bestehende Signaturprüfung auf weitere Formate ausweiten, Dry-Run mit Nutzerfeedback, signierte Backups inkl. Verifikation im UI.

