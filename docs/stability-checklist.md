# Aktuelle Stabilitäts- und Abnahmecheckliste

Stand: 21. Oktober 2026. Codegrundlage: V9.9.3, main
`a44677fe6d922af168cd38ddab3eb05fa6a47ff4`.

Diese Datei ist die aktuelle technische Checkliste. Den Einrichtungsfortschritt
führt [zusammenarbeit-roadmap.md](zusammenarbeit-roadmap.md). Frühere Sprint-Gates
sind historische Nachweise, keine zusätzlichen aktuellen Aufgabenlisten.
Ein Haken nennt den nachgewiesenen Umfang; er bestätigt nicht automatisch jeden
Bedienweg, alle Geräte oder den gesamten Funktionsbereich.

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
  geprüft. Die Browsertests lösen Planänderungen dort über `saveAppState()` aus;
  das ist kein Nachweis für alle Schaltflächen des neuen Wochenplaners.
- [x] Serverseitige Rechte, Revisionen, Vertretungsablauf, Vorschläge und Rücknahmen
  sind lokal in PostgreSQL getestet (`tests/collaboration-database.test.js`).
- [x] Der Service Worker ist in `index.html` registriert. Der Precache-Prüfer
  bestätigt alle 41 lokalen HTML-Assets; Cache-Verhalten besitzt Regressionstests.
- [x] Keine doppelten globalen Helper-Namen: aktueller lokaler Prüflauf mit
  584 Top-Level-Helpern in 42 Dateien. Dies ist keine vollständige Duplikatanalyse.
- [x] Am genannten main-Commit sind [Tests einschließlich Chromium/WebKit](https://github.com/Winterkuersche/wochenplan-pwa/actions/runs/39590122404),
  [Helper](https://github.com/Winterkuersche/wochenplan-pwa/actions/runs/39590122422),
  [Precache](https://github.com/Winterkuersche/wochenplan-pwa/actions/runs/39590122426),
  [Pages](https://github.com/Winterkuersche/wochenplan-pwa/actions/runs/39590122609)
  und [Live-Prüfung](https://github.com/Winterkuersche/wochenplan-pwa/actions/runs/39590122409) erfolgreich.

## Wochenplanung und Komfortfunktionen in V9.10

Die priorisierten sechs Aufgaben sind im Quellstand umgesetzt. Umfang und
Nachweise stehen in [filial-alltag-v9.10.md](filial-alltag-v9.10.md).

- [x] Zentraler Speicherabschluss für produktive Wochenplan-Eingaben mit Journal,
  Fehlermeldung, Stale-Tab-Prüfung und Online-Signal; synthetische Regressionen bestanden.
- [x] Schnellnavigation für mobile Verwaltung, Stundenaufschlüsselung, geschützte
  einmalige Rücknahme und gebündelte Wochenhinweise implementiert.
- [x] Vorschläge nur nach ausdrücklichem Einschalten und problembezogenem Abruf;
  Übernahme validiert den frischen Plan und speichert über den zentralen Abschluss.
- [ ] Chromium-/WebKit-Prüfung dieses neuen Quellstands in GitHub Actions abschließen.
  Die Online-Smokes bedienen jetzt den tatsächlichen Wocheneditor. Der neue
  Planning-Smoke prüft zusätzlich Favorit, Mehrfachplanung, Tauschen/Verschieben,
  Basisplan, Rücknahme, Fehlerfälle und echten Offline-Start.

## Verbleibende praktische Abnahme

- [ ] Echte SV-Einladung, zwei Geräte, aktive und beendete Vertretung gemeinsam prüfen.
- [ ] Passwort-Wiederherstellung mit dem eigenen Konto praktisch prüfen.
- [ ] Direkte Datumsparser-Regression ergänzen: `fromIsoDate` muss beispielsweise
  `2026-02-30` und `2025-02-29` ablehnen und `2024-02-29` annehmen.
  Die vorhandenen Schaltjahrtests prüfen bisher das Monatsraster.
- [ ] Monatszellen und Abwesenheits-Trim/Split über die echte Oberfläche prüfen;
  Ablauf siehe [manual-smoke-checks.md](manual-smoke-checks.md).
- [ ] Offline-Start und Updatewechsel mit tatsächlich aktivem Service Worker
  im Browser prüfen. Die drei bestehenden Browser-Smokes blockieren Service Worker;
  Unit- und Asset-Prüfungen ersetzen diesen Lauf nicht.
- [ ] Ersten automatischen externen Sicherungslauf kontrollieren. Einrichtung
  und einmaliger echter Rücklese-/Wiederherstellungstest sind bereits bestätigt.
- [ ] Aufbewahrung der externen Sicherungen und des Änderungsverlaufs festlegen;
  bis dahin keine vorhandenen externen Sicherungen automatisch löschen.

## Grenzen dieses Dokumentationsabgleichs

Der aktuelle lokale Lauf meldete 531 bestandene Tests und einen nicht ausführbaren
Datenbanktest, weil `@electric-sql/pglite` in dieser lokalen Umgebung fehlt.
Das ist kein vollständig bestandener lokaler Lauf. Chromium und WebKit sind lokal
nicht installiert; für den genannten Commit liegen die oben verlinkten
GitHub-Ergebnisse vor. Ein grüner älterer Commit gilt nicht als Ergebnis neuer Änderungen.

MEP-Tabelle, Druckgeometrie und PDF-/Druckausgabe sind durch diesen Auftrag
unverändert zu lassen. Ihre bestehenden Abnahmeregeln bleiben in
[mep-pdf-manual-smoke-test.md](mep-pdf-manual-smoke-test.md) und
[../CODE_REVIEW_TASKS.md](../CODE_REVIEW_TASKS.md) erhalten.
