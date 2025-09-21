# Release-Readiness Report ModulTool

## 1. Kurzfazit
- **Status:** Nicht release-fähig. Interaktive Funktionen sind weiterhin durch doppelte Inline-Skripte blockiert.
- **Qualitäts-Gate:** Neues Skript `npm run quality` führt Linting (Code-Analyse) und Node-Tests automatisiert aus. Bricht bei Fehlern oder Warnungen sofort ab.
- **Start-Prüfung:** Neues Skript `npm run preflight` prüft Node-Version, Pflichtdateien, Standardverzeichnisse, JSON-Validität sowie doppelte Inline-Skripte und kann optional das Qualitäts-Gate ausführen (`npm run preflight -- --with-quality`).

## 2. Release-Blocker (müssen vor einem Release behoben werden)
| Blocker | Auswirkung | Quick-Win |
| --- | --- | --- |
| Doppelte Inline-Skripte in `index.html` (`const state`, `function persist`) | Browser stoppt JavaScript-Ausführung → Buttons, Drag & Drop, Assistenten funktionieren nicht. | Duplikate entfernen, anschließend `npm run preflight -- --with-quality` erneut ausführen. |
| Beschädigtes JSON-Schema (`schemas/backup-schema.json`) | Backups lassen sich nicht gegen das Schema prüfen; Tests brechen mit Syntaxfehler ab. | Schema korrigieren (fehlende Kommata/Schlüssel ergänzen) und über `npm run preflight -- --with-quality` validieren. |
| Kein reproduzierbarer Build-Prozess | Keine geprüften Artefakte, keine Integritätssicherung. | Build-Setup (Vite/TypeScript) aufsetzen, Release-Playbook schreiben. |
| Fehlende Sicherheits-/A11y-Abnahmen | Risiko für Nutzer:innen mit Screenreader oder bei Plugin-Importen. | Automatisierte A11y-Tests (axe/Pa11y) und Sicherheits-Prüfsummen ergänzen. |
| Unvollständige Architekturtrennung | Hohe Wartungs- und Regressionsgefahr. | Layering und Event-Bus-Namespaces fertigstellen, Self-Repair modularisieren. |

## 3. Qualitäts-Automatisierung (neu)
| Kommando | Zweck | Schritte |
| --- | --- | --- |
| `npm run quality` | Vollautomatisches Qualitäts-Gate. | 1. Führt ESLint mit `--max-warnings=0` aus. 2. Startet die Node-Test-Suite (`node --test tests`). |
| `npm run quality -- --fix` | Gleiches Qualitäts-Gate, versucht vorher Format-/Stilfehler zu beheben. | 1. ESLint mit `--fix`. 2. Node-Tests. |
| `npm run preflight` | Start-/Release-Check ohne Tests. | 1. Prüft Node-Version ≥ 20. 2. Legt Standardverzeichnisse an. 3. Validiert Pflichtdateien. 4. Warnt bei doppelten Skripten. |
| `npm run preflight -- --with-quality` | Kombinierter Preflight + Qualitäts-Gate. | Führe Preflight aus; wenn erfolgreich, startet automatisch `npm run quality`. |

## 4. Release-Checkliste (Auszug)
1. `npm run preflight -- --with-quality` ohne Fehler ausführen.
2. Doppelte Skripte aus `index.html` entfernen und Regressionstest (`npm run quality`) wiederholen.
3. Build-/Bundle-Prozess aufsetzen und reproduzierbare Artefakte erzeugen.
4. Accessibility- und Sicherheitsprüfungen dokumentieren (axe-Scan, Signatur-Checks, Threat-Model).
5. Release-Playbook schreiben (Build → Tests → Preflight → Paket → Signatur → Verteilung).
6. Benutzer-Dokumentation aktualisieren (Schnellstart, Fehlerbehebung, Support-Kontakte).

## 5. Empfohlene Sofortmaßnahmen
1. Inline-Skriptbereinigung priorisieren, damit UI-Funktionen wieder lauffähig sind.
2. CI-Workflow entwerfen (GitHub Actions o. Ä.), der `npm run preflight -- --with-quality` bei jedem Commit ausführt.
3. Architektur-Refactor planen (UI ↔ State ↔ Services) inklusive Modul-Tests, um spätere Regressionen zu vermeiden.

## 6. Monitoring der Release-Reife
- **Täglicher Check:** `npm run preflight` ausführen, um lokale Abweichungen früh zu erkennen.
- **Vor jedem Merge:** `npm run quality` (bzw. `npm run preflight -- --with-quality`) Pflicht.
- **Fehlerreporting:** Ergebnisse des Preflight im Log (`fortschritt-info.txt`) festhalten, um Trends sichtbar zu machen.

> **Hinweis:** Die Preflight-Routine legt fehlende Standardverzeichnisse automatisch an und erstellt bei Bedarf eine Platzhalterdatei `fortschritt-info.txt`, damit Statusnotizen nicht vergessen werden. Alle Warnungen erscheinen laienverständlich im Terminal.
