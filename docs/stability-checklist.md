# Aktuelle Stabilitäts- und Abnahmecheckliste

Stand: 21. Oktober 2026. Codegrundlage: V9.10, geprüft am Commit
`b372a42559e661f012d29c989ed10ba5f8afe460` (PR #427).

Diese Datei ist die aktuelle technische Checkliste. Den Einrichtungsfortschritt
führt [zusammenarbeit-roadmap.md](zusammenarbeit-roadmap.md). Frühere Sprint-Gates
sind historische Nachweise, keine zusätzlichen aktuellen Aufgabenlisten.
Ein Haken nennt den nachgewiesenen Umfang; er bestätigt nicht automatisch jeden
Bedienweg, alle Geräte oder den gesamten Funktionsbereich.

V9.10.2 ergänzt die Aufteilung von Speicherung und Monatseditor sowie den
synthetischen Browserablauf für Monatszellen und Abwesenheiten. Umfang,
Korrekturen und Prüfgrenzen: [month-input-maintenance-v9.10.2.md](month-input-maintenance-v9.10.2.md).

## Belegter Stand

- [x] Zeit-/Pausenregeln, Monatsgrenzen und Salden besitzen Regressionstests
  (`tests/time-logic.test.js`, `tests/month-boundaries.test.js`, `tests/balance.test.js`).
- [x] Normalisierung individueller Schichten ist getestet (`tests/individual-shift.test.js`).
- [x] Abwesenheitsbereiche werden auf vollständiges Entfernen, Trim und Split geprüft
  (`tests/absences.test.js`). Der reale Bedienweg bleibt gesondert zu testen.
- [x] Backup-Validierung, Legacy-Formate und der lokale Sicherungsrückweg sind
  getestet (`tests/backup-validation.test.js`, `tests/storage-safety.test.js`).
- [x] Import → Export → erneutes Öffnen, Rohdatenrettung, defekte Daten und ein
  veralteter Tab werden im Browser geprüft (`tools/browser-data-smoke.js`).
- [x] Persönlicher und gemeinsamer Online-Abgleich sind mit synthetischen Konten
  geprüft. Beide Online-Smokes bearbeiten eine Schicht über den sichtbaren Wocheneditor.
  Der zusätzliche Planning-Smoke prüft Favorit, Mehrfachplanung, Tauschen/Verschieben,
  Basisplan, Rücknahme, Stunden, Hinweise und Vorschlagsübernahme.
- [x] Serverseitige Rechte, Revisionen, Vertretungsablauf, Vorschläge und Rücknahmen
  sind lokal in PostgreSQL getestet (`tests/collaboration-database.test.js`).
- [x] Der Service Worker ist in `index.html` registriert. Der Precache-Prüfer
  bestätigt alle 41 lokalen HTML-Assets; Cache-Verhalten besitzt Regressionstests.
- [x] Keine doppelten globalen Helper-Namen: aktueller lokaler Prüflauf mit
  590 Top-Level-Helpern in 42 Dateien. Dies ist keine vollständige Duplikatanalyse.
- [x] Am genannten Quellstand bestehen [547 Tests und alle vier Browser-Smokes
  in Chromium und WebKit](https://github.com/Winterkuersche/wochenplan-pwa/actions/runs/39606813341).
  Helper-, Precache-, Syntax- und Versionsprüfung sind ebenfalls erfolgreich.
  Deployment und Live-Prüfung werden nach dem Merge gesondert nachgewiesen.

## Wochenplanung und Komfortfunktionen in V9.10

Die priorisierten sechs Aufgaben sind im Quellstand umgesetzt. Umfang und
Nachweise stehen in [filial-alltag-v9.10.md](filial-alltag-v9.10.md).

- [x] Zentraler Speicherabschluss für produktive Wochenplan-Eingaben mit Journal,
  Fehlermeldung, Stale-Tab-Prüfung und Online-Signal; synthetische Regressionen bestanden.
- [x] Schnellnavigation für mobile Verwaltung, Stundenaufschlüsselung, geschützte
  einmalige Rücknahme und gebündelte Wochenhinweise implementiert.
- [x] Vorschläge nur nach ausdrücklichem Einschalten und problembezogenem Abruf;
  Übernahme validiert den frischen Plan und speichert über den zentralen Abschluss.
- [x] Chromium-/WebKit-Prüfung dieses Quellstands abgeschlossen ([CI](https://github.com/Winterkuersche/wochenplan-pwa/actions/runs/39606813341)).
  Die Online-Smokes bedienen jetzt den tatsächlichen Wocheneditor. Der neue
  Planning-Smoke prüft zusätzlich Favorit, Mehrfachplanung, Tauschen/Verschieben,
  Basisplan, Rücknahme, Fehlerfälle und echten Offline-Start.

## Verbleibende praktische Abnahme

- [ ] Echte SV-Einladung, zwei Geräte, aktive und beendete Vertretung gemeinsam prüfen.
- [ ] Passwort-Wiederherstellung mit dem eigenen Konto praktisch prüfen.
- [x] Direkte Datumsparser-Regression: ungültige Tage und gültiger Schalttag
  sind in `tests/hour-breakdown.test.js` geprüft.
- [x] Monatszellen und Abwesenheits-Trim/Split besitzen mit V9.10.2 einen
  Browserablauf über die echte Oberfläche (`tools/browser-month-smoke.js`),
  einschließlich Verkürzen, Verlängern, Statuswechsel und erneutem Öffnen.
  Der Nachweis für einen konkreten Commit erfordert dessen erfolgreiche
  Chromium-/WebKit-Jobs; eine echte Geräteabnahme bleibt separat.
- [x] Offline-Start, Wochenplan-Eingabe und erneutes Öffnen mit aktivem Service Worker
  sind im Planning-Browserlauf für Chromium und WebKit geprüft.
- [ ] Einen echten Updatewechsel mit offenem Entwurf zusätzlich auf dem iPhone prüfen.
- [ ] Ersten automatischen externen Sicherungslauf kontrollieren. Einrichtung
  und einmaliger echter Rücklese-/Wiederherstellungstest sind bereits bestätigt.
- [ ] Aufbewahrung der externen Sicherungen und des Änderungsverlaufs festlegen;
  bis dahin keine vorhandenen externen Sicherungen automatisch löschen.

## Prüfgrenzen

547 lokale Tests bestehen einschließlich des Datenbanktests; GitHub prüft
zusätzlich Chromium und WebKit. Alle technischen Browserläufe verwenden
synthetische Daten und fangen externe Dienste ab. Sie ersetzen die noch offene
reale SV-/iPhone-Abnahme und den Updatewechsel mit offenem Entwurf nicht.

MEP-Tabelle, Druckgeometrie und PDF-/Druckausgabe sind durch diesen Auftrag
unverändert zu lassen. Ihre bestehenden Abnahmeregeln bleiben in
[mep-pdf-manual-smoke-test.md](mep-pdf-manual-smoke-test.md) und
[../CODE_REVIEW_TASKS.md](../CODE_REVIEW_TASKS.md) erhalten.
