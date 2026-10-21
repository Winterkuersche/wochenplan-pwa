# Wochenplan: Ablauf für Zusammenarbeit und Wartung

Stand: 21. Oktober 2026. V9.9 ist veröffentlicht; V9.9.1 ergänzt einen Schutz beim Kontowechsel.

Dieses Dokument ist die abarbeitbare Aufgabenliste. V9.9 wurde über PR #419 veröffentlicht.
Persönliche Anmeldung und Übernahme des Online-Stands in die Home-App wurden vom Nutzer bestätigt.
Realer TL/SV-Praxistest und automatische externe Sicherung bleiben offen. Technische Tests
und tatsächliche Nutzerabnahme werden getrennt ausgewiesen.

## Ziel und vereinbarte Richtung

- Persönliche Konten für TL und SV, eine gemeinsame Filiale.
- SV darf ansehen und Änderungsvorschläge vorbereiten.
- TL erteilt zeitlich begrenzte direkte Bearbeitungsrechte und kann sie beenden.
- Änderungen bleiben mit Person, Zeitpunkt und Vorher/Nachher nachvollziehbar.
- Sicherungsstände und gezieltes Rückgängigmachen schützen die Planung.
- Wartungsprüfungen kontrollieren Änderungen und melden Auffälligkeiten.

Die veröffentlichte App unterstützt persönliche Online-Pläne und gemeinsame Filialpläne.
Lokale Speicherung, Dateisicherungen, Online-Verlauf, Konfliktschutz und Vertretungsrechte
sind vorhanden. Die echte Anmeldung und Geräteübernahme wurden bestätigt;
eine reale SV-Einladung wurde noch nicht bestätigt.

## Reihenfolge und Abschlusskriterien

| Nr. | Arbeitspaket | Fertig, wenn … | Beteiligung |
| --- | --- | --- | --- |
| 1 | Ausgangsstand sichern und Anmeldung prüfen | Export, bestätigte Anmeldung, erster Upload und Übernahme auf dem zweiten Gerät haben dieselben geprüften Schichten | Stephan am iPhone + Entwicklung |
| 2 | Entwicklungsgrundlage festigen | getrennte Testdaten, Vorschau, automatische Browserprüfungen und klare Modulgrenzen vorhanden sind | Entwicklung |
| 3 | Gemeinsame Filiale und Einladungen | zwei Testkonten denselben Filialplan sehen; ein fremdes Konto keinen Zugriff erhält | Entwicklung |
| 4 | Vertretungsrechte | SV außerhalb des Zeitraums nur lesen/vorschlagen kann; Freigabe und Entzug auf dem Server greifen | Entwicklung + Stephan prüft Bedienung |
| 5 | Änderungsverlauf und Wiederherstellung | jede bestätigte Änderung zugeordnet ist und sichere Rücknahmen möglich sind | Entwicklung |
| 6 | Vorschläge und verbindlicher Wochenstand | Vorschläge überprüfbar übernommen werden und spätere Abweichungen sichtbar sind | Entwicklung + Stephan |
| 7 | Wartung und unabhängige Sicherung | Prüfungen reproduzierbar laufen, ein externer Sicherungsstand wiederhergestellt werden kann | Entwicklung; Einrichtung mit Stephan |
| 8 | Gemeinsamer Praxistest und Veröffentlichung | TL/SV-Tests, Konflikte, Offline-Nutzung und iPhone-Darstellung bestanden sind | Stephan + SV + Entwicklung |

## 1. Ausgangsstand sichern und Anmeldung prüfen

- [x] Auf dem Gerät mit der vollständigen Planung eine aktuelle Dateisicherung erstellen.
- [x] Sicherungsdatum, Team- und Schichtanzahl vergleichen; gewünschter Ausgangsstand festlegen.
- [x] Persönliches Konto erstellen und Bestätigungs-E-Mail testen.
- [x] Den geprüften Geräte-Stand ausdrücklich erstmals online übernehmen.
- [x] Mit demselben Konto auf dem zweiten Gerät anmelden und den Online-Stand übernehmen.
- [ ] Team, mehrere konkrete Schichten und Zeitraum auf beiden Geräten vergleichen.
- [ ] Passwort-Wiederherstellung prüfen, ohne den lokalen Plan zu ersetzen.

Ergebnis: bestätigter Ausgangsstand und funktionierende persönliche Online-Nutzung.
Persönliche Sicherungen, E-Mail-Adressen und Personaldaten gehören nicht in dieses
öffentliche Repository oder in öffentliche Prüfberichte.

## 2. Entwicklungsgrundlage festigen

- [x] Die Aufgaben in kleine Änderungen mit jeweils eigenem Prüfergebnis aufteilen.
- [x] Lokale Vorschau mit synthetischen Daten und separatem PostgreSQL (PGlite); Auth-HTTP in den Browsertests simulieren.
- [x] Bestehende Datenformate und Sicherungsimporte als Kompatibilitätsgrenze festhalten.
- [x] Aus app.js schrittweise Zuständigkeiten auslagern; Planung nicht nebenbei neu schreiben.
- [x] Klare Module für Speicherung/Abgleich, Filialzugriff, Verlauf und Oberfläche vorsehen.
- [x] Browserprüfungen in GitHub ergänzen: Öffnen/Schließen, Speichern, Import/Export, Anmeldung mit Test-API, Gerätewechsel.
- [x] Chromium und WebKit automatisch prüfen.
- [ ] Gemeinsame TL/SV-Bedienung auf dem echten iPhone prüfen (siehe Schritt 8).
- [x] Rückkehr zur vorherigen App-Version samt kompatiblem Datenstand dokumentieren.

Ergebnis: Erweiterungen lassen sich außerhalb des laufenden Plans entwickeln und prüfen.

## 3. Gemeinsame Filiale und Einladungen

- [x] Datenmodell für Filiale, Mitgliedschaft und gemeinsamen Plan entwerfen.
- [x] TL als Filialverwaltung und SV als Mitglied mit Grundrecht Lesen abbilden.
- [x] Persönlichen Plan nach bewusster Auswahl in einen gemeinsamen Filialplan kopieren; Quellstand erhalten.
- [x] Mitgliedschaften und Datentrennung in der Datenbank durchsetzen.
- [x] Befristeten Einladungslink mit einmaliger Annahme und Widerruf vorsehen.
- [x] Einladung zunächst per kopierbarem Link ermöglichen; automatischer E-Mail-Versand ist ein eigener Einrichtungsschritt.
- [x] Einladung, Annahme, Widerruf und Zugriff durch unbeteiligte Konten mit Testkonten prüfen.

Ergebnis: Persönliche Zugänge greifen kontrolliert auf dieselbe Filiale zu.

## 4. Vertretungsrechte

- [x] Oberfläche: Person auswählen, Beginn/Ende festlegen, Freigabe erteilen oder beenden.
- [x] Anzeige: „Du darfst ansehen“ bzw. „Bearbeiten bis …“.
- [x] Datumsgrenzen verständlich in Europe/Berlin anzeigen und technische Grenzen eindeutig speichern.
- [x] Bei jedem Online-Schreibvorgang serverseitig Mitgliedschaft und aktuelle Freigabe prüfen.
- [x] SV darf keine eigenen Rechte verlängern oder Filialmitglieder verwalten.
- [x] Geöffnete Sitzung, Ablauf, vorzeitigen Entzug und Offline-Änderungen nach Ablauf testen.
- [x] Abgewiesene lokale Änderungen als Entwurf erhalten und verständlich erklären.
- [x] Standard festgelegt: Ohne ausdrückliche TL-Freigabe bleiben Änderungen Vorschläge; kein automatisches Notfallrecht.

Ergebnis: Freigaben gelten zuverlässig über Geräte und App-Neustarts hinweg.

## 5. Änderungsverlauf und Wiederherstellung

- [x] Server erfasst handelndes Konto, Zeitpunkt, Planrevision und fachliche Änderung zusammen mit der Speicherung.
- [x] Verlauf zeigt z. B. Datum/Person/Schicht, alten und neuen Wert; optional Änderungsgrund.
- [x] Auch Teamdaten, Abwesenheiten, größere Importe und Wiederherstellungen berücksichtigen.
- [x] Verlauf für normale Konten unveränderlich halten und Aufbewahrung ausdrücklich festlegen.
- [x] Personenbezogenen Änderungsverlauf vom begrenzt aufbewahrten Vollversionsverlauf unterscheiden.
- [x] Vor Vertretungsbeginn einen benannten Sicherungsstand anlegen.
- [x] Übersicht „Seit meinem letzten Besuch“ und Filter nach Person/Woche ergänzen.
- [x] Rücknahme als neue protokollierte Änderung ausführen; zwischenzeitliche Änderungen vorher vergleichen.
- [x] Gleichzeitiges Speichern mit zwei Konten testen: keine stillen Überschreibungen.

Ergebnis: TL und SV können Änderungen erklären und nachvollziehbar korrigieren.

## 6. Vorschläge und verbindlicher Wochenstand

- [x] SV kann außerhalb einer Freigabe Vorschläge mit Begründung speichern.
- [x] TL sieht Vorher/Nachher und kann annehmen oder ablehnen.
- [x] Vorschläge gegen inzwischen geänderte Schichten vor Übernahme erneut prüfen.
- [x] Einen bewusst freigegebenen Wochenstand mit Datum/Version kennzeichnen.
- [x] Änderungen nach Freigabe sichtbar vom freigegebenen Stand unterscheiden.
- [x] Standard festgelegt: Wochenfreigabe bleibt ein separat zu erteilendes, zunächst ausgeschaltetes Zusatzrecht.

Ergebnis: Es ist erkennbar, was verbindlich ist und was noch entschieden werden muss.

## 7. Wartung und unabhängige Sicherung

- [x] Bestehende Funktions-, Helper- und Offline-Asset-Prüfungen weiterverwenden.
- [x] Abhängigkeitsupdates und Sicherheitsmeldungen einrichten; Updates vor Übernahme testen.
- [x] Prüfung auf verdächtig ähnliche Funktionen, ungenutzte Skripte und unpassende Asset-/Cache-Versionen ergänzen.
- [x] Fundstellen mit Datei, Grund und Priorität melden; technische Ähnlichkeit ist noch kein Beweis für Doppelarbeit.
- [x] Optionalen KI-Prüfer erst nach funktionierenden normalen Prüfungen ergänzen.
- [x] Für KI-Prüfer Auftrag, ausführende Umgebung, Zugriffe, Laufzeit/Kostenlimit und Berichtsablage festlegen.
- [x] Prüfer zunächst auf Quellcode und synthetische Testdaten begrenzen; keine Personaldaten erforderlich.
- [x] Ergebnisse für denselben Commit zusammenfassen, wiederholte Meldungen vermeiden.
- [x] Fehler des Prüflaufs selbst sichtbar machen; kein Ergebnis ist keine erfolgreiche Prüfung.
- [ ] Separate Sicherung außerhalb der laufenden Datenbank einrichten; Ziel und Turnus mit Stephan festlegen.
- [ ] Wiederherstellung aus dieser Kopie in einer Testumgebung durchführen.

Ergebnis: Wartungsbedarf wird sichtbar, Sicherung ist praktisch wiederherstellbar.
Wartungs- und Browser-Workflows sowie Dependabot sind aktiv. Die zusätzlichen ChatGPT-Prüfaufträge
für offene PRs und die wöchentliche Wartung sind eingerichtet: nur Quelltext und synthetische
Daten, keine Schreibzugriffe, keine Produktionsdaten, höchstens 30 GitHub-Leseaufrufe
und 5.000 geänderte Quelltextzeilen je Lauf. Keine zusätzlichen Modell-APIs.
Ein erster gezielter Wartungsbericht liegt in `docs/maintenance-review-2026-10-21.md`.
Der externe Sicherungsablauf ist lokal vorbereitet und getestet, aber nach blockierter
Freigabeprüfung noch nicht mit echten Daten und Google Drive verbunden; siehe `docs/independent-backup.md`.

## 8. Gemeinsamer Praxistest und Veröffentlichung

- [x] Zwei persönliche Testkonten: gemeinsamer Stand, Leserecht, aktive/abgelaufene Vertretung.
- [x] Gleichzeitige Änderungen, Offline-Entwurf und Wiederverbindung prüfen.
- [x] Einladungswiderruf, manipulierte Rechte und fremde Filiale testen.
- [x] Vorschlag, Annahme, Rücknahme und Wiederherstellung vollständig durchspielen.
- [ ] Auf dem echten iPhone in Safari und Home-Bildschirm-App prüfen.
- [ ] Erst danach reale Filiale verbinden, SV persönlich einladen und Stand vergleichen.
- [x] Veröffentlichung von V9.9 mit erfolgreichen Tests und Rückweg dokumentiert; reale SV-Abnahme bleibt offen.

## Auslöser für Prüfungen und Agenten

Ein Unteragent während unserer Unterhaltung bearbeitet einen begrenzten Auftrag.
Für spätere automatische Läufe braucht es zusätzlich eine dauerhaft eingerichtete
Automatisierung und eine ausführende Umgebung. Eine bloße App-Verbindung startet
keinen Hintergrund-Agenten und setzt diesen Chat nicht automatisch fort.

| Bedarf | Geeigneter Auslöser | Ausführung / Ergebnis |
| --- | --- | --- |
| Geänderter App-Code | Push oder Pull Request in GitHub | GitHub Actions startet Tests; Prüfbericht am Commit |
| Wartung ohne neue Änderung | eingerichteter Zeitplan oder manueller Start | GitHub Actions prüft den aktuellen Stand |
| Zusätzliche KI-Codeprüfung | ausgewählter Prüfauftrag nach den Tests | eingerichteter KI-Lauf bewertet Code und erstellt einen Bericht |
| Neues Formular-/Tabellenereignis | Google Forms/Sheets mit Apps Script oder Automatisierungsdienst | z. B. n8n startet den zuvor eingerichteten Ablauf |
| Eingegangene E-Mail | Gmail-Ereignisprüfung z. B. in n8n | gefilterte Nachricht startet einen eingerichteten Ablauf |
| Lesbare Besprechungsunterlage | Google Docs | optionaler Dokumentationsort; Auslöser separat einrichten |

Empfehlung für diese App: GitHub ist der gemeinsame Entwicklungs- und Prüfstand;
Supabase speichert Filialdaten und Rechte. Google-Dienste sind bei Bedarf Ein- oder
Ausgabekanäle. Für automatische Codeprüfungen werden sie nicht benötigt.

Apps-Script-Besonderheit: Änderungen über Skripte oder APIs lösen installierbare
Bearbeitungstrigger im Allgemeinen nicht aus. Ein automatischer Schreibvorgang
in Sheets ist deshalb nicht automatisch eine funktionierende Triggerkette.

## Fortschritt

- [x] Ausgangslage und Reihenfolge dokumentiert.
- [x] Schritt 1: Dateisicherung, Konto und Übernahme in die Home-App bestätigt; zusätzliche Stichproben/Passwort-Rückweg bleiben separat offen.
- [x] Schritt 2: Entwicklungsgrundlage einschließlich Chromium/WebKit abgeschlossen.
- [x] Schritt 3: Gemeinsame Filiale technisch umgesetzt und mit synthetischen Konten geprüft.
- [x] Schritt 4: Vertretungsrechte technisch umgesetzt; Grundregel: Freigabe ausschließlich durch TL.
- [x] Schritt 5: Änderungsverlauf und Wiederherstellung technisch geprüft.
- [x] Schritt 6: Vorschläge und Wochenfreigabe technisch geprüft; SV-Publikation ist ein ausdrückliches Zusatzrecht.
- [ ] Schritt 7: Wartung und unabhängige Sicherung abgeschlossen.
- [ ] Schritt 8: Gemeinsamer Praxistest und Veröffentlichung abgeschlossen.

Nächster Einrichtungsschritt: den vorbereiteten, lesenden Export und die Ablage im bestätigten
Drive-Konto ausdrücklich freigeben, dann Upload/Rücklesen und Wiederherstellung praktisch prüfen.
Die Freigabeprüfung hat Produktionszugriff und Ordneranlage mit Verweis auf den getrennten
Nur-Code-Prüfauftrag blockiert. Reale TL/SV-Abnahme und persönliche Einladung bleiben offen.

Technische Ergebnisse und offene Einrichtung: siehe `docs/collaboration-release.md`.

## Technische Quellen

- GitHub-Workflow-Auslöser: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Google-Apps-Script-Trigger und Einschränkungen: https://developers.google.com/apps-script/guides/triggers/installable
- Gmail-Auslöser in n8n: https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.gmailtrigger/
