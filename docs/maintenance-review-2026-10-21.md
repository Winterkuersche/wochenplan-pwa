# Gezielte Wartungsprüfung vom 21.10.2026

Geprüfter main-Commit: `73b94b8be8c5e745ea4186ce553e2cdb8b7aa4ad`.
Kein vorheriger abgeschlossener Bericht dieser Aufgabe war verfügbar.

## Tatsächlicher CI-Stand an diesem Commit

- Tests, Chromium und WebKit: erfolgreich, [Lauf 39577942071](https://github.com/Winterkuersche/wochenplan-pwa/actions/runs/39577942071).
- Pages-Veröffentlichung: erfolgreich, [Lauf 39577941010](https://github.com/Winterkuersche/wochenplan-pwa/actions/runs/39577941010).
- Helper- und Precache-Prüfung: erfolgreich.
- Keine offenen PRs nach Übernahme der geprüften Dependabot-Updates #420, #421 und #422.
- Letzter gelesener Wartungsbericht: [PR-Prüfung 39577643312](https://github.com/Winterkuersche/wochenplan-pwa/actions/runs/39577643312)
  am virtuellen Merge `3fc95780333aa8942c2e5e1fe207c19b02e8be61`:
  keine Syntax-/Assetfehler, `npm audit` ohne gemeldete Schwachstellen;
  Hinweis auf fehlende HTML-Referenz von `planning2.js`.
- Historischer fehlgeschlagener WebKit-Test am 21.10. gehört zu einem älteren PR-Head;
  aktuelle Browserläufe bestehen. Historische Preview-Fehler vom August sind keine
  fehlgeschlagenen Veröffentlichungen des oben genannten main-Stands.

## Geprüfter Umfang

Gezielt gelesen: `docs/maintenance-reviewer.md`, `storage-utils.js`, `backup-utils.js`,
`backup-io.js`, `cloud-sync.js`, `collaboration.js`, `collaboration-panel.js`,
`data-panel.js`, `supabase/collaboration-schema.sql`, `sw.js`, `version.js`,
`tools/check-maintenance.js` und die betroffenen Speicher-/Abgleichtests.
Die Dependabot-Änderungen an Workflows wurden gesondert mit ihren tatsächlichen
Prüfergebnissen abgeglichen. Der main-Head blieb bis zum Abschluss dieses
Analyse-Durchgangs unverändert.

Das ist keine vollständige Prüfung des Repositories und keine Prüfung der
produktiven Datenbank. Produktionsdaten, Konten oder Sitzungen wurden für die
Codeprüfung nicht ausgelesen. Die separate Einrichtung eines echten externen
Backups ist noch blockiert und nicht Teil eines bestandenen Codeprüflaufs.

## P1: Alter Filialentwurf kann einen Kontowechsel überleben — behoben in V9.9.1

- Fundstelle im geprüften Stand: `collaboration.js:99–103`, nach
  `await fingerprint(payload)` und vor dem Schreibaufruf.
- Auslöser: Während Web Crypto die Prüfsumme eines alten Entwurfs berechnet,
  wechselt das angemeldete Konto und eine andere berechtigte Filiale wird ausgewählt.
  Der spätere `call("save", …)` verwendete den inzwischen aktuellen Kontext.
- Auswirkung: Der alte Entwurf konnte bei passender Revision an die neue Filiale
  geschickt werden. Die Serverberechtigung verhindert keinen falschen Zielplan,
  wenn auch das neue Konto dort schreiben darf.
- Abhilfe: Kontextgeneration unmittelbar nach der asynchronen Prüfsumme und vor
  jedem weiteren Speicherschritt prüfen. Ein Regressionstest verzögert Web Crypto,
  wechselt Konto/Filiale und verlangt null Schreibaufrufe. Der Test schlug vor der
  Korrektur fehl (ein falscher Schreibaufruf) und besteht danach.
- Cache-/Asset-Versionen werden mit der Korrektur auf V9.9.1 synchron angehoben.

## Bewerteter Wartungshinweis

`planning2.js` hat keinen direkten HTML-Verweis. Daraus allein folgt kein sicherer
Löschauftrag. Keine Datei wurde wegen Ähnlichkeit oder fehlender Direktreferenz gelöscht.

## Zusätzliche lokale Verifikation

520 Tests einschließlich gezieltem Kontowechsel-Regressionsfall und unabhängiger
Sicherungsprüfung bestanden; Helper-, Precache- und Wartungsprüfung bestanden.
Lokale Browserprüfung konnte wegen fehlender Playwright-Browserdatei nicht starten.
Die Korrektur benötigt deshalb ihre eigenen erfolgreichen Chromium-/WebKit-Läufe
am PR-Head vor dem Merge; alte grüne Ergebnisse gelten dafür nicht.

Die neue Offline-Sicherungsprüfung stellt alle importierten Felder in einem
frischen journalgesicherten Gerätespeicher wieder her und vergleicht sie nach
erneutem Öffnen. Manipulierte Prüfsummen und abgeschnittene Dateien werden abgewiesen.
Damit ist noch kein echter Drive-Upload mit anschließendem Rücklesen nachgewiesen.
