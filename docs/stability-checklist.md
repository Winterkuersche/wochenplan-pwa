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

## Vorrangig offen: Speicherweg des neuen Wochenplaners

- [ ] **P1: Planning 2 an den zentralen, journalgesicherten Speicherweg anbinden.**
  `planning2-data-adapter.js:49–51` schreibt den Plan direkt in localStorage.
  `planning2-live.js:8` meldet anschließend nur `planning2:plan-saved`;
  `app.js:3749–3757` liest und rendert, erzeugt aber kein zentrales
  `wochenplan:saved`. Erst dieses Signal startet in `data-panel.js` die automatische
  Online-Sicherung. Der Tausch-/Verschiebepfad in `planning2-live.js:126` ruft
  sogar nur den Adapter auf, ohne das Planning-2-Signal.
- [ ] Alle produktiven Eingaben einschließlich Favorit, Mehrfachplanung,
  Tauschen/Verschieben und Monatsbasisplan über denselben Speicherabschluss führen.
  Erst nach erfolgreichem Speichern Erfolg anzeigen und Online-Abgleich anstoßen.
- [ ] Regressionen für den tatsächlichen Bedienweg ergänzen: Änderung über eine
  Wochenplan-Schaltfläche → lokaler Rückweg → Online-Revision → zweites Gerät.
  Zusätzlich veralteter Tab, fehlgeschlagene Speicherung und Tausch/Verschieben.

Nachweis vom 21.10.2026: Lokaler synthetischer Aufruf der unveränderten
`saveProductivePlan`-Funktion und des zugehörigen App-Listeners änderte den Plan,
legte kein Journal an und erzeugte kein `wochenplan:saved`. Der nächste zentrale
Schreibversuch wurde als veralteter Stand abgewiesen. Der Listener wurde dabei
mit isolierten Render-/Normalisierungsfunktionen geprüft; ein echter Browserlauf
über diese Wochenplan-Schaltflächen ist noch offen. Dies ist keine Prüfung von
Produktionsplänen und kein Nachweis eines bereits eingetretenen Datenverlusts.

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
