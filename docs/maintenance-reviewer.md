# Auftrag für einen zusätzlichen prüfenden Agenten

Zweck: den angegebenen Git-Commit unabhängig prüfen und begründete Fundstellen
melden. Der Auftrag wird von eingerichteten ChatGPT-Aufgaben verwendet.

Eingabe: Commit-SHA, Vergleichsbasis und Ergebnisse der normalen Prüfungen.
Zugriff: Quellcode, Dokumentation und synthetische Tests. Produktionspläne,
Anmeldetokens, persönliche Sicherungen und Kontozugänge sind nicht erforderlich.

Arbeitsauftrag:

1. Prüfen, ob Speicherung, Gerätewechsel und Offline-Cache zum gleichen Stand gehören.
2. Bei Änderungen an Rechten oder RPCs prüfen, ob Serverautorisierung und Konfliktprüfung greifen.
3. Verdächtig ähnliche Funktionen sowie überholte, ungenutzte Skripte suchen; dynamische Aufrufe und Vorschauseiten berücksichtigen.
4. Testlücken anhand konkreter Fehlerfälle benennen. Tests nicht allein nach Anzahl bewerten.
5. Bericht nach Schwere ordnen; pro Fundstelle Datei, Zeile, nachvollziehbaren Auslöser, Auswirkung und sinnvolle Abhilfe angeben.
6. Unsichere Vermutungen als solche markieren. Für denselben Commit vorhandene Meldungen zusammenführen.

Der Prüfer liest und berichtet. Er verändert weder Planungsdaten noch Rechte,
führt keine produktiven Migrationen aus und veröffentlicht keine Korrekturen.
Änderungsvorschläge werden als eigener geprüfter Entwicklungsschritt bearbeitet.

## Eingerichtete Ausführung

- ChatGPT mit bestehender GitHub-Verbindung; kein zusätzlicher externer API-Zugang.
- GitHub-Ereignis: neue prüfbereite PRs und aktualisierte Commits dieses Repositories.
- Zweite Aufgabe: montags morgens, Europe/Berlin, mit Kontrolle offener CI-Ergebnisse.
- Berichte ausschließlich in ChatGPT; keine GitHub-Kommentare, Änderungen oder Merges.
- Keine Supabase-, Drive-, E-Mail-, Produktionsplan- oder Zugangsdatenzugriffe.
- Ein Analyse-Durchgang mit höchstens 30 GitHub-Leseaufrufen und 5.000 geänderten
  Quelltextzeilen. Größeren oder abgeschnittenen Umfang ausdrücklich als ungeprüft melden.
- Prüfen, ob der Head während der Analyse gewechselt hat. Laufende oder fehlende
  Tests sind ausstehend, nicht bestanden. Unveränderte PR-Fundstellen zusammenführen.
- Der Wochenlauf muss immer einen lesbaren Bericht mit Commit, gelesenem Umfang
  und tatsächlichem CI-Status liefern. Fehlender Bericht ist kein Prüferfolg.

Die Begrenzungen sind Arbeitsanweisungen und kein hartes finanzielles Ausgabenlimit.
Es werden weder API-Schlüssel noch kostenpflichtige Zusatzdienste eingerichtet.
Die ersten Berichte kontrollieren; ein fehlgeschlagener oder stiller Lauf ist
zu korrigieren, bevor man sich auf diesen zusätzlichen Hinweisgeber verlässt.

Normale Funktions-/Browserprüfungen laufen davon unabhängig in GitHub Actions.
Der KI-Bericht ist keine Merge-Freigabe oder Garantie für Fehlerfreiheit.
