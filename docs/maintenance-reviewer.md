# Auftrag für einen zusätzlichen prüfenden Agenten

Zweck: den angegebenen Git-Commit unabhängig prüfen und begründete Fundstellen
melden. Dieser Auftrag definiert keine automatische Ausführung.

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

Für einen späteren automatischen Lauf müssen Umgebung, Modellzugang, Zeit-/
Kostenlimit, Auslöser und Berichtsablage eingerichtet werden. Empfohlen:
ausgewählte Pull Requests nach den normalen Tests und ein manueller Start.
Geplanter Wiederholungslauf erst, wenn Bericht und Fehleranzeige zuverlässig sind.
