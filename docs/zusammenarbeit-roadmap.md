# Wochenplan: Ablauf für Zusammenarbeit und Wartung

Stand: 21. Oktober 2026. Veröffentlicht: V9.9.3 über PR #425.
Codegrundlage: `a44677fe6d922af168cd38ddab3eb05fa6a47ff4`.
Aktuelle technische Befunde: [stability-checklist.md](stability-checklist.md).

Dieses Dokument führt die Einrichtung und gemeinsame Abnahme. V9.9.3 ist veröffentlicht,
persönlicher Login und Übernahme in die Home-Bildschirm-App wurden bestätigt.
Der reale TL/SV-Test bleibt offen. Die unabhängige Sicherung über das gewünschte
separate Google-Konto wurde einschließlich Rücklesen und echter App-Wiederherstellung
geprüft; die tägliche Sicherungsaufgabe ist aktiviert. Pro Schritt werden Ergebnis, Prüfung und nächster
Schritt festgehalten; ein neuer Chat kann hier anknüpfen.

## Ziel und vereinbarte Richtung

- Persönliche Konten für TL und SV, eine gemeinsame Filiale.
- SV darf ansehen und Änderungsvorschläge vorbereiten.
- TL erteilt zeitlich begrenzte direkte Bearbeitungsrechte und kann sie beenden.
- Änderungen bleiben mit Person, Zeitpunkt und Vorher/Nachher nachvollziehbar.
- Sicherungsstände und gezieltes Rückgängigmachen schützen die Planung.
- Wartungsprüfungen kontrollieren Änderungen und melden Auffälligkeiten.

Die App wird ausschließlich für die Filiale verwendet. TL und SV arbeiten mit
eigenen Anmeldungen an einem Filialplan; ein zusätzlicher privater Planungsbereich
ist nicht gewünscht. Der Teamzugang baut auf dem vorhandenen Plan auf. Eine bereits
zugeordnete einzelne Filiale wird nach Anmeldung automatisch ausgewählt, auch auf
einem neuen Gerät. Ein abweichender Geräte-Entwurf wird dabei nicht automatisch ersetzt.
Vorhandene frühere Online-Stände bleiben als Rückweg erhalten. Lokale
Speicherung, Dateisicherungen, Online-Versionsverlauf und Konfliktschutz sind
vorhanden. Die erste persönliche Online-Sicherung und Übernahme wurden geprüft.

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

- [x] Auf dem Gerät mit der vollständigen Planung eine aktuelle Dateisicherung erstellen; Nutzer bestätigt.
- [x] Sicherungsdatum, Team- und Schichtanzahl vergleichen; Nutzer wählt den Stand mit 1.075 Schichten und trägt spätere Änderungen manuell nach.
- [x] Persönliches Konto erstellen und Bestätigungs-E-Mail testen.
- [x] Den geprüften Geräte-Stand ausdrücklich erstmals online übernehmen; serverseitig geprüft.
- [x] Mit demselben Konto im anderen Speicher-Kontext anmelden und den Online-Stand übernehmen; Home-Bildschirm-App bestätigt.
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
- [x] Chromium und WebKit in der GitHub-Matrix prüfen; persönliche Anmeldung/Übernahme auf dem echten iPhone durchführen.
- [ ] Neue gemeinsame Filialabläufe zusätzlich auf dem echten iPhone prüfen.
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
- [x] Grundregel für spontane Vertretung: ohne ausdrückliche TL-Freigabe kein direktes Schreibrecht; SV kann Vorschläge vorbereiten.

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
- [x] Wochenfreigaben als separates, standardmäßig ausgeschaltetes Zusatzrecht vorsehen; TL entscheidet beim Erteilen der Vertretung.

Ergebnis: Es ist erkennbar, was verbindlich ist und was noch entschieden werden muss.

## 7. Wartung und unabhängige Sicherung

- [x] Bestehende Funktions-, Helper- und Offline-Asset-Prüfungen weiterverwenden.
- [x] Abhängigkeitsupdates und Sicherheitsmeldungen einrichten; Updates vor Übernahme testen.
- [x] Prüfung auf verdächtig ähnliche Funktionen, ungenutzte Skripte und unpassende Asset-/Cache-Versionen ergänzen.
- [x] Fundstellen mit Datei, Grund und Priorität melden; technische Ähnlichkeit ist noch kein Beweis für Doppelarbeit.
- [x] Zusätzliche KI-Prüfung nach funktionierenden normalen Prüfungen als ChatGPT-Aufgaben einrichten.
- [x] Auftrag, Ausführung über bestehende GitHub-Verbindung, Aufrufs-/Umfangsgrenzen und Bericht in ChatGPT festlegen; kein neuer externer API-Zugang.
- [x] Prüfer auf Quellcode und synthetische Testdaten begrenzen; keine Produktionskonten oder Personaldatenzugriffe.
- [x] Auftrag: Ergebnisse für denselben Commit zusammenfassen und wiederholte Meldungen vermeiden.
- [x] Ersten vollständigen KI-Bericht kontrollieren; nach einem stillen Probelauf zweiter Lauf mit zwei reproduzierten Offline-Befunden. V9.9.2 ergänzt deren Korrektur und Regressionstests. V9.9.1 schützt zusätzlich den Kontowechsel während der Prüfsumme.
- [x] Fehler des Prüflaufs selbst sichtbar machen; kein Ergebnis ist keine erfolgreiche Prüfung.
- [x] Zielrichtung: separates Google-Konto für tägliche externe Sicherungen; manuelle iCloud-Exporte zusätzlich erhalten.
- [x] Richtige Google-Verbindung prüfen und separate Sicherung außerhalb der laufenden Datenbank einrichten. Shop-Konto dafür ausdrücklich ausgeschlossen.
- [x] Wiederherstellung aus dieser Kopie in einer Testumgebung durchführen; echter App-Import und erneutes Öffnen zusätzlich bestätigt.

Ergebnis: Wartungsbedarf wird sichtbar, Sicherung ist praktisch wiederherstellbar.
Wartungs- und Browser-Workflows sowie Dependabot sind nach dem Merge aktiv.
Die zusätzliche KI-Prüfung ist eingerichtet und hat einen vollständigen ersten
Bericht geliefert. Die externe Sicherung liegt im geprüften separaten Google-Konto;
Export und Download sind identisch und die echte App-Wiederherstellung ist bestätigt.
Die separate tägliche Sicherungsaufgabe ist aktiv; ihr erster automatischer Lauf steht noch aus.
Der lokale Sicherungsprüfer und der Ablauf stehen in `docs/independent-backup.md`.

## 8. Gemeinsamer Praxistest und Veröffentlichung

- [x] Zwei persönliche Testkonten: gemeinsamer Stand, Leserecht, aktive/abgelaufene Vertretung.
- [x] Gleichzeitige Änderungen, Offline-Entwurf und Wiederverbindung prüfen.
- [x] Einladungswiderruf, manipulierte Rechte und fremde Filiale testen.
- [x] Vorschlag, Annahme, Rücknahme und Wiederherstellung vollständig durchspielen.
- [ ] Auf dem echten iPhone in Safari und Home-Bildschirm-App prüfen.
- [x] Teamzugang mit dem vorhandenen Plan eingerichtet; Nutzer-Screenshots zeigen Filialverwaltung und Ausgangsstand. Dies bestätigt noch keinen Vergleich aller Planinhalte.
- [ ] SV persönlich einladen und denselben Stand auf beiden Geräten vergleichen.
- [x] V9.9.3 über PR #425 veröffentlicht; Tests, Chromium/WebKit, Deployment und Live-Prüfung am main-Commit erfolgreich. Neuer TL/SV-Praxistest bleibt offen.

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
- [x] Schritt 1: Sicherung, echter Anmeldetest und Übernahme bestätigt; Passwort-Wiederherstellung bleibt gesonderter Praxistest.
- [x] Schritt 2: Entwicklungsgrundlage und Chromium-/WebKit-Prüfung abgeschlossen.
- [x] Schritt 3: Gemeinsame Filiale technisch umgesetzt und mit synthetischen Konten geprüft.
- [x] Schritt 4: Vertretungsrechte technisch umgesetzt; Grundregel: Freigabe ausschließlich durch TL.
- [x] Schritt 5: Änderungsverlauf und Wiederherstellung technisch geprüft.
- [x] Schritt 6: Vorschläge und Wochenfreigabe technisch geprüft; SV-Publikation ist ein ausdrückliches Zusatzrecht.
- [x] Schritt 7: Wartung und unabhängige Sicherung eingerichtet und praktisch geprüft; ersten automatischen Sicherungslauf noch kontrollieren.
- [x] Schritt 8a: Veröffentlichung von V9.9.3 einschließlich technischer Prüfungen abgeschlossen.
- [ ] Schritt 8b: Gemeinsamer Praxistest mit der SV abgeschlossen.

Nächster gemeinsamer Schritt: Am 22. Oktober 2026 bei der Arbeit die SV gezielt einladen und
den Plan auf beiden Geräten vergleichen. Die Oberfläche ist auf einen Filialplan
vereinfacht und der Teamzugang ist eingerichtet. Den offenen Speicherweg des neuen
Wochenplaners vor einer vollständigen Abnahme gemäß Stabilitätscheckliste korrigieren.
Keine Einladungsnachrichten automatisch versenden.

Technische Ergebnisse und offene Einrichtung: siehe `docs/collaboration-release.md`.

## Technische Quellen

- GitHub-Workflow-Auslöser: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Google-Apps-Script-Trigger und Einschränkungen: https://developers.google.com/apps-script/guides/triggers/installable
- Gmail-Auslöser in n8n: https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.gmailtrigger/
