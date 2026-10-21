# Frühere Sprint-Ideen: abgeglichener Funktionsstand

Abgeglichen am 21. Oktober 2026 mit V9.9.3
(`a44677fe6d922af168cd38ddab3eb05fa6a47ff4`).

Dies ist ein Ideenbestand, kein aktiver Zwei-Sprint-Auftrag. Aktuelle Fehler und
Abnahme stehen in [stability-checklist.md](stability-checklist.md), die Einrichtung
in [zusammenarbeit-roadmap.md](zusammenarbeit-roadmap.md). Vorschläge werden erst
nach fachlicher Einordnung zu Umsetzungsaufgaben; bestehende Funktionen werden
nicht aufgrund dieser älteren Liste erneut gebaut.

| Frühere Idee | Heutiger Stand | Sinnvolle verbleibende Erweiterung |
| --- | --- | --- |
| Monats-Iststunden UX 2.0 / Bulk-Paste | Umgesetzt: Mehrzeilenfeld, Parser, Zeilenvalidierung und Persistenz; `manual-month-utils.js`, `tests/manual-month-bulk.test.js` sowie `tests/monthly-plan-persistence.test.js`. | Echte Bedienprüfung gemäß `manual-smoke-checks.md`, kein zweiter Parser. |
| Saldo je Person erklären | Monatssaldo, manueller Marker und Plan-/Ist-Hinweise vorhanden. | Aufklappbare Herkunft von Soll, Plan, Abwesenheiten, manuellem Ist und Übertrag. |
| Team-Schnellaktionen für mehrere Personen | Keine eigene Mehrfachauswahl für Vertragsmodell/Bonus im aktuellen Teamformular. | Nur bei wiederkehrendem Bedarf; Vorschau und Rückweg vor Massenänderungen. |
| CSV für Monats-Iststunden | Kein eigener CSV-Import/-Export für Monats-Iststunden vorhanden. JSON-Gesamtsicherung und Bulk-Paste existieren. | Optionales Austauschformat mit Zeilenfehlern und Vorschau; geringe Priorität ohne externe Datenquelle. |
| Plan-/Ist-Abweichungen warnen | Stunden-/Besetzungs-/Frei-/Öffnerhinweise und Basisplanabweichungen vorhanden. | Fachlich begründete Schwellen für zusätzliche Plan-/Ist-Warnungen festlegen; vorhandene Hinweise bündeln. |
| KPI-Widget Monatsabschluss | Stunden, Umsätze und Produktivität sind bereits in bestehenden Ansichten dargestellt. | Eine kompakte gemeinsame Abschlussübersicht statt zusätzlicher paralleler Rechenwege. |

## Reihenfolge für weitere Arbeit

1. Den abweichenden Speicherweg des neuen Wochenplaners korrigieren und über echte
   Schaltflächen prüfen. Vorhandene grüne Online-Tests verwenden bisher den zentralen Speicherweg.
2. Mobile Bedienung vereinfachen: tägliche Planung, Zusammenarbeit und seltene
   Wiederherstellungsaktionen leichter auffindbar machen.
3. Stundenherkunft verständlich erklären und gezieltes Rückgängigmachen erleichtern.
4. Planungsvorschläge erst fachlich und technisch abnehmen. Im aktuellen
   `planning2-live.js` sind sie mit `PLANNING2_SUGGESTIONS_ENABLED=false` deaktiviert.

MEP-Tabelle sowie Druck-/PDF-Ergebnis bleiben gemäß Nutzerauftrag unverändert.
