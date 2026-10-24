# Urlaubswünsche: Tagezahlen und Datumsauswahl (V9.13.1)

- Im Formular wird die Tagezahl für den eingegebenen Zeitraum angezeigt, ebenso bei jedem gespeicherten Wunsch.
- Die Jahressumme je Person umfasst ausschließlich das gewählte Kalenderjahr. Ein Zeitraum über Silvester zeigt zusätzlich seinen Anteil im gewählten Jahr. Importierte Überschneidungen zählen je Person nur einmal.
- Zählung: Montag bis Samstag einschließlich, ohne gesetzliche Feiertage Schleswig-Holstein; Schulferien werden mitgezählt. Feiertage auf Sonntagen werden nur einmal ausgeschlossen. UTC-Tage verhindern Fehler bei Sommer-/Winterzeitwechseln.
- Die vorhandenen Feiertagsdaten decken 2026 und 2027 ab. Für andere Jahre erscheint ausdrücklich „Keine verlässliche Tagezahl“, statt Feiertage stillschweigend mitzuzählen. Bei jahresübergreifenden Wünschen kann der verifizierte Anteil eines abgedeckten Jahres weiterhin angezeigt werden.
- Neue Datumsfelder starten am 1. Januar des gewählten Jahres. Das Enddatum folgt dem Beginn bis zur ersten eigenen Eingabe. Bearbeiten erhält die gespeicherten Daten, auch über Jahresgrenzen. Ein Jahreswechsel während einer offenen Eingabe wird mit verständlichem Hinweis blockiert.
- Die Summen werden berechnet und nicht als zusätzliche Planfelder gespeichert. Bestehende Urlaubskonten, Rechte, Online-Speicherung und das Kalender-Drucklayout bleiben unverändert. Keine Servermigration erforderlich.

Prüffälle: Februarwoche aus dem Screenshot, Samstage, Sonntage, Feiertage am Samstag/Sonntag, Ostern/Himmelfahrt/Pfingsten, Schulferien, beide Zeitumstellungen, Schaltjahr, Silvester, importierte Doppelbelegung, fehlende Feiertagsdaten; Browserprüfung in Chromium/WebKit bei 390/1440 px für Eingabe, Jahreswechsel, Bearbeiten/Löschen und Summen.

Feiertagsliste: § 2 SFTG, https://www.gesetze-rechtsprechung.sh.juris.de/bssh/document/jlr-FeiertGSH2004V3P2
HTML-Datumswerte: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date
