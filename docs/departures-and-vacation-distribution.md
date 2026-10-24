# Austritte und Urlaubsverteilung

## Korrektur V9.13.3

Der integrierte Planer liest Stammdaten aus dem gespeicherten Stand. Nach Änderungen im Teamformular wurde seine bereits geöffnete Ansicht bisher nicht neu gezeichnet. Das Austrittsfeld wird gespeichert, die veraltete Ansicht zeigt ausgeschiedene Personen aber weiter bis zur Navigation oder zum Neuladen.

Der Datenadapter beobachtet jetzt erfolgreiches Speichern sowie Stammdatenänderungen anderer Tabs. Nur tatsächlich geänderte Stammdaten lösen die Aktualisierung des bereits eingeblendeten Planers aus. Reine Planänderungen und identische Speicherereignisse erzeugen kein zusätzliches Rendering.

Austrittsmonat gilt einschließlich: Oktober bedeutet ab November ausgeblendet. Frühere Pläne und Schichten bleiben erhalten. Im Stammdatenformular bleibt die Person für Korrekturen verfügbar. Keine Serveränderung.

Prüfung: Austritt, Wiederaktivierung, unveränderte historische Schichten, wiederholte Ereignisse und andere Tabs. Browserfall mit tatsächlichem Monatsfeld, sofortiger Aktualisierung nach dem Speichern, historischem Monat und Neuladen.

## Entwurf: Urlaubsverteilung ohne eigene Wünsche (noch nicht implementiert)

- Aktive Mitarbeiter ohne Wünsche für das gewählte Jahr auswählen. Zu verteilende Tage je Person sichtbar und korrigierbar anzeigen; bereits genehmigten Urlaub berücksichtigen.
- Mindestens ein zusammenhängender Block mit 12 anrechenbaren Urlaubstagen im Jahr. Sonntage und gesetzliche Feiertage Schleswig-Holstein zählen nicht mit; der Kalenderzeitraum kann dadurch länger als zwei Wochen sein. Ein-/Austritt und die zu verteilende Tageszahl begrenzen die Termine. Reicht das Kontingent nicht für 12 Tage, ist ein ausdrücklicher Hinweis statt einer vorgetäuschten Erfüllung nötig.
- Bis einschließlich 30. Juni möglichst mindestens die Hälfte des Jahresurlaubs einplanen (bei 30 Tagen: 15; bei ungerader Zahl auf ganze Tage aufrunden). Bereits genehmigte oder manuell erfasste Zeiträume berücksichtigen. Bei unvermeidbaren Konflikten Zielabweichung sichtbar machen; keine manuellen Wünsche überschreiben.
- Verbleibende Tage möglichst über das restliche Jahr verteilen. Alle Vorschläge einzeln manuell änderbar lassen.
- Termine ohne Überschneidung mit bestehenden Wünschen und genehmigtem Urlaub bevorzugen. Sonst möglichst wenige gleichzeitige Abwesenheiten und sichtbare Überschneidungshinweise. Die Kalenderverteilung ersetzt keine Prüfung der späteren Schichtbesetzung.
- Zunächst Vorschau mit Person, Zeitraum und Tagezahl; Vorschläge einzeln ändern oder verwerfen. Erst ausdrücklich übernehmen, vorhandene Wünsche nicht ersetzen.
- Übernommene Vorschläge bleiben jederzeit über Bearbeiten/Löschen änderbar. Manuelle Eingaben bei erneuter Verteilung schützen. Keine automatische Genehmigung oder Änderung von Schichten und Urlaubskonten.
- Optionale Sperrzeiten und Blockaufteilung vor dem Verteilen einstellen. Bei fehlenden Feiertagsdaten keine scheinbar vollständige Verteilung berechnen.
