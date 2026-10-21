# Abgleich früherer Code-Review-Aufgaben

Stand: 21. Oktober 2026, V9.9.3 (`a44677fe6d922af168cd38ddab3eb05fa6a47ff4`).
Aktuelle technische Aufgaben: [docs/stability-checklist.md](docs/stability-checklist.md).
Historische Funde bleiben nachvollziehbar, erzeugen aber keine zweite offene Liste.

| Früherer Punkt | Abgeglichener Status / Nachweis |
| --- | --- |
| 1. Uneinheitlicher Seitentitel | Erledigt. `index.html` nutzt den neutralen Titel „Wochenplan“; `app.js` setzt die sichtbare Version aus `APP_META`. Siehe `docs/versioning.md`. |
| 2. Fehlende Offline-Assets | Erledigt für das Inventar. Der Precache-Prüfer bestätigt alle 41 lokalen HTML-Assets. Die Registrierung ist aktiv. Ein echter Offline-Browserlauf besteht mit V9.10; der Updatewechsel auf dem iPhone bleibt separat offen. |
| 3. Mo–Sa und Sonntag im MEP-Formular | Kein eigenständiger Lösch- oder Layoutauftrag. Die Planung bleibt Mo–Sa; das bestehende MEP-Formular einschließlich Druck-/Exportgestaltung bleibt gemäß Nutzerauftrag unverändert. |
| 4. Abwesenheits- und Datumstests | Bereichsfälle sind in `tests/absences.test.js`, Monatsgrenzen/Schaltjahr in `tests/month-boundaries.test.js` abgedeckt. Direkte Datumsparser-Tests sind in V9.10 ergänzt; die zusätzliche Abwesenheitsbedienprüfung bleibt offen. |

Der Planning-2-Speicherbefund ist in V9.10 behoben und über echte Bedienelemente
geprüft. Nachweise und verbleibende Geräteabnahme stehen in der aktuellen Checkliste.

## Bestehende MEP-Vorgaben

Der folgende Abschnitt bleibt als bestehende Layout-/Abnahmeregel unverändert.
Er ist kein Auftrag, MEP-Tabelle, Druck oder Export im aktuellen Arbeitspaket umzubauen.

## 5) Aufgabe: MEP-Geometrie auf eine Autorität festlegen (CSS-only)
**Entscheidung:** Für die MEP-Seitengeometrie gilt ausschließlich die feste CSS-Berechnung (mm-basierte Variablen). Die bisherige JS-Nachmessung und das nachträgliche Überschreiben von `--mep-table-height` / `--mep-subrow-height` entfallen vollständig.

**Akzeptanzkriterien:**
- Auf jeder MEP-Seite sind alle 9 MA-Zeilen vollständig sichtbar.
- Der Footer wird vollständig angezeigt (kein Abschneiden).
- Die unten definierte QA-Prüfkette für MEP-PDFs ist vollständig durchgeführt und dokumentiert (inkl. Viewer-Vergleich und Befundklassifikation).

### Verbindliche QA-Prüfkette für MEP-PDF-Änderungen
1. Export erzeugen.
2. Datei in `Dateien` speichern.
3. Dieselbe Datei in einem **externen PDF-Viewer** öffnen (z. B. Adobe Acrobat, Foxit, Files-Viewer) – **nicht nur** in der Safari-Tab-Vorschau.
4. Dieselbe Datei in **mindestens zwei iOS-Viewern** vergleichen (z. B. Safari-Preview + Adobe/Foxit/Files-Viewer).
5. Ergebnis eindeutig dokumentieren mit der Klassifikation:
   - **„Safari-Preview-Abweichung“** (Viewer-spezifisches Rendering-Problem), oder
   - **„Dateiinhalt korrekt“** (PDF-Datei selbst ist korrekt, Abweichung nur in einzelner Vorschau).

**Gate für MEP-PDF-PRs:**
- Ohne diese Prüfkette gilt die Abnahme als **nicht erfüllt**.
- Layoutfixes dürfen nicht allein auf Basis einer einzelnen Safari-Vorschau blockiert werden, wenn die Datei in externen Viewern korrekt ist.
