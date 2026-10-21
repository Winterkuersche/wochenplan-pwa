# Ergänzende Bedien- und Offline-Prüfung

Stand: 21. Oktober 2026. Aktuelle Ergebnisse und offene Aufgaben:
[stability-checklist.md](stability-checklist.md).

Playwright ist eingerichtet. `npm run test:browser` führt Daten-, persönlichen
Online- und Filial-Smoke aus; GitHub prüft Chromium und WebKit. Die Daten stammen
ausschließlich aus synthetischen Fixtures, externe Dienste werden abgefangen.
Die Online-Smokes verändern den Plan bisher per `saveAppState()`; sie bestätigen
noch nicht den Speicherweg aller tatsächlichen Wochenplan-Schaltflächen.

Die folgenden Abläufe ergänzen die Automation. Sie gelten erst nach protokollierter
Ausführung mit Commit, Browser/Gerät, Auslöser und Ergebnis als bestanden.
Ein Node-Test oder eine vorbereitete Anleitung ersetzt diesen Nachweis nicht.

## Vorbereitung

1. Den zu prüfenden Commit in einer isolierten lokalen Instanz öffnen.
2. Synthetische Daten und abgefangene Online-API verwenden; keine echten Konten,
   Sitzungen, Einladungen oder Produktionspläne für technische Tests einsetzen.
3. Änderungen über sichtbare Bedienelemente ausführen. Nicht durch direkte
   JavaScript-Aufrufe ersetzen, wenn gerade der Bedienweg geprüft werden soll.
4. Nach einem Speichervorgang neu öffnen und den gespeicherten Inhalt vergleichen.

## A. Monatszelle bearbeiten

1. In „Monat“ eine Zelle öffnen, Schicht/Status wählen und bestätigen.
2. Prüfen, ob der Eintrag und die Stundenberechnung passen.
3. Neu öffnen und denselben Eintrag kontrollieren.

## B. Urlaub/Krank ändern und teilen

1. Einen mehrtägigen Urlaub oder Krank-Zeitraum eintragen.
2. Einen mittleren Tag ändern beziehungsweise entfernen.
3. Neu öffnen und beide verbleibenden Teilintervalle prüfen.
4. Zusätzlich Beginn/Ende kürzen und vollständiges Entfernen durchspielen.

Die Bereichslogik besitzt Unit-Tests; dieser Ablauf prüft die Anbindung der Oberfläche.

## C. Monats-Iststunden mehrfach erfassen

1. „Monats-Iststunden“ öffnen und mehrere Zeilen wie `2026-01 120:00` einfügen.
2. Eine fehlerhafte Zeile einfügen: Zeilennummer und blockierte Übernahme prüfen.
3. Korrigieren, übernehmen und neu öffnen.
4. Werte und Kennzeichnung als manuelle Monats-Iststunden kontrollieren.

## D. Dateisicherung

Import → Export → erneutes Öffnen, Vorzustand, beschädigte Daten und Rohdatenrettung
sind in `tools/browser-data-smoke.js` automatisiert. Bei Änderungen am Import oder
Gerätespeicher diesen Browserlauf erneut ausführen. Einen echten iPhone-Dateidialog
als eigene Geräteprüfung protokollieren.

## E. Tatsächliche Wochenplan-Eingaben und gemeinsamer Plan

1. Mit zwei synthetischen Testkonten denselben Filialplan öffnen.
2. Im sichtbaren Wochenplaner eine Schicht über den Editor ändern.
3. Lokale Speicherung, Journal/Rückweg, Online-Revision und Planinhalt am zweiten
   Gerät kontrollieren; Erfolg erst nach tatsächlicher Speicherung anzeigen.
4. Favorit, Mehrfachplanung, Tauschen/Verschieben und Monatsbasisplan ebenso prüfen.
5. Veralteten Tab und einen absichtlich fehlschlagenden Speichervorgang testen:
   neuere Daten dürfen nicht still ersetzt werden.

Dieser Ablauf ist wegen des dokumentierten Planning-2-Speicherwegs offen.

## F. Service Worker: echter Offline-Start und Update

Die Registrierung in `index.html` ist aktiv. Keine Registrierung auskommentieren
oder für diese Prüfung verändern.

1. App lokal über HTTP öffnen, Registrierung/Aktivierung abwarten und neu laden,
   bis der Service Worker die Seite kontrolliert.
2. Netzwerk offline schalten, App neu öffnen und alle Planungsansichten aufrufen.
3. Eine Teständerung offline vornehmen und nach erneutem Öffnen kontrollieren.
4. Wieder online gehen und den ausstehenden Abgleich überprüfen.
5. Bei einem späteren Code-/Cache-Update einen offenen Entwurf erhalten und den
   Versionswechsel mit neuer Cache-Kennung prüfen.

Die drei aktuellen Browser-Smokes setzen `serviceWorkers: 'block'`. Ihre grünen
Ergebnisse bestätigen daher keinen erfolgreichen Ablauf F. Externe PDF-Bibliotheken
liegen bewusst außerhalb des lokalen Precache; PDF-/MEP-Ausgaben werden im
vorliegenden Auftrag nicht verändert oder erneut abgenommen.
