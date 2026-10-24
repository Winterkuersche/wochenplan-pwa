# Austritte und Urlaubsverteilung

## Korrektur V9.13.3

Der integrierte Planer liest Stammdaten aus dem gespeicherten Stand. Nach Änderungen im Teamformular wurde seine bereits geöffnete Ansicht bisher nicht neu gezeichnet. Das Austrittsfeld wird gespeichert, die veraltete Ansicht zeigt ausgeschiedene Personen aber weiter bis zur Navigation oder zum Neuladen.

Der Datenadapter beobachtet jetzt erfolgreiches Speichern sowie Stammdatenänderungen anderer Tabs. Nur tatsächlich geänderte Stammdaten lösen die Aktualisierung des bereits eingeblendeten Planers aus. Reine Planänderungen und identische Speicherereignisse erzeugen kein zusätzliches Rendering.

Austrittsmonat gilt einschließlich: Oktober bedeutet ab November ausgeblendet. Frühere Pläne und Schichten bleiben erhalten. Im Stammdatenformular bleibt die Person für Korrekturen verfügbar. Keine Serveränderung.

Prüfung: Austritt, Wiederaktivierung, unveränderte historische Schichten, wiederholte Ereignisse und andere Tabs. Browserfall mit tatsächlichem Monatsfeld, sofortiger Aktualisierung nach dem Speichern, historischem Monat und Neuladen.

## Urlaubsverteilung V9.14.0

Unter Urlaub → Urlaubswünsche · Jahreskalender → Urlaub verteilen für Mitarbeiter ohne Wünsche wird eine lokale Vorschau berechnet. Aktive Personen ohne Wünsche im gewählten Jahr sind vorausgewählt und können abgewählt werden. Jahreskontingente sind vor der Berechnung anpassbar; Ein-/Austritte werden bei den Terminen berücksichtigt, eine zeitanteilige Kürzung des Kontingents muss der Anwender bestätigen bzw. selbst eintragen. Frühester Beginn ist mindestens heute oder Jahresbeginn; vergangene Zeiträume werden nicht vorgeschlagen.

Vorgaben:

- Ein zusammenhängender Block mit mindestens 12 anrechenbaren Urlaubstagen, wenn mit Kontingent und freien Terminen möglich. Montag–Samstag ohne gesetzliche Feiertage SH; Sonntage/Feiertage unterbrechen den Block nicht. Der Kalenderzeitraum kann länger als zwei Wochen sein.
- Möglichst mindestens die Hälfte des Jahreskontingents bis 30. Juni (ungerade Tage aufrunden). Bereits genehmigte Abwesenheiten und direkte U-Zellen zählen mit, doppelte Abdeckung je Person/Tag nur einmal. Ein vorhandener kürzerer Block kann durch neue Tage ergänzt werden.
- Restliche Tage in kleineren Blöcken über das Jahr verteilen; bevorzugt Termine ohne andere Urlaube, andernfalls geringere Überschneidungen. Dies ist eine deterministische, schrittweise Suche, keine Garantie für das globale Optimum oder die spätere Schichtbesetzung.
- Höchstens 50:00 Wochen-Sollstunden aller gleichzeitig beurlaubten Personen pro Kalendertag, jeweils `employee.target`. Beispiel: 20:00 + 20:00 + 9:30 = 49:30. Vorhandene Wünsche und genehmigte Urlaube zählen mit, dieselbe Person nur einmal. Unbekannte Sollstunden (auch archivierter Personen) sperren die betroffenen Tage für zusätzliche Vorschläge. Bereits manuell erfasste Überschreitungen werden angezeigt und bleiben erhalten.
- Eigene Krankmeldungen, Beschäftigungsgrenzen und frühester Beginn sperren Termine. Fehlende Feiertagsdaten verhindern die Berechnung. Bei zu wenig Kapazität bleiben Tage offen; fehlender 12-Tage-Block und Halbjahresziel werden ausdrücklich angezeigt.

Jeder vorgeschlagene Zeitraum ist in der Vorschau bearbeitbar und einzeln verwerfbar. Zusammenfassung je Person: vorhandene/neue/Jahrestage, Halbjahresziel, längster Block, maximale gleichzeitige Wochenstunden und Überschneidungstage. Fehler (z. B. Überschneidung eigener Zeiträume, mehr als 50 Stunden, Überschreiten des Kontingents) sperren die Übernahme. Nicht erfüllbare Ziele sind sichtbare Hinweise und verhindern die bewusste Übernahme eines Teilplans nicht.

Erst „Vorschläge als Urlaubswünsche übernehmen“ speichert atomar über den bestehenden Speicherweg. Bestehende manuelle Wünsche werden nicht ersetzt; danach sind auch die neuen Einträge gewöhnliche Wünsche und über Bearbeiten/Löschen änderbar. Eine erneute Verteilung überspringt Personen mit solchen Wünschen. Keine automatische Genehmigung, kein Schreiben in Schichten oder Urlaubskonten; keine Änderungen an Backend, Rechten oder Planformat. Jahreskontingente in der Vorschau ändern nur die Vorschlagsberechnung und werden nicht als zusätzliche Stammdaten gespeichert.

Eine offene Verteilung schützt wie eine offene manuelle Eingabe vor automatischem Austausch durch Cloud-Daten/App-Neuladen. Änderungen an Team, Urlaubswünschen oder Abwesenheiten zwischen Berechnung und Übernahme sperren die Übernahme. Schreibfehler erhalten Vorschau und zuvor gespeicherten Stand. Schließen/Verwerfen speichert nichts. Die Vorschau selbst ist flüchtig und wird bei einem ausdrücklich erzwungenen Neuladen verworfen.

## Rückweg aus der Druckansicht V9.14.0

Das Exportfenster enthält „Zurück zum Wochenplan“. Zuerst wird versucht, das per Skript geöffnete Fenster zu schließen; verweigert der Browser das (z. B. PWA), navigiert es zur ursprünglichen App-Adresse. Die Bildschirmvorschau passt sich der verfügbaren Breite an. Der Ausdruck bleibt A4 quer; Bedienelemente werden nicht mitgedruckt. Native iPhone-Druck-/Teilen-Dialoge benötigen weiterhin einen Test am Gerät.

## Validierung

Synthetische Tests für Kontingente, Halbjahresziel, Blocklänge, Stundenlimit (einschließlich Minuten, vorhandenen Überlastungen und unbekannten Werten), Schutz manueller Wünsche, genehmigte Bereiche/Deduplizierung, Beschäftigungsgrenzen, fehlende Feiertage und fehlerhafte Vorschauänderungen. Browserregressionen ergänzen Vorschau ohne Speicherung, direkte U-Zellen, Änderungen während der Vorschau, Schreibfehler, Übernahme und spätere manuelle Änderung sowie den Rückweg bei verweigertem Fensterschließen und unveränderte A4-Pagination.

## V9.14.1: Direkte PDF-Datei und jahresbezogene Personenauswahl

Der Kalender wird lokal aus den vorhandenen SVG-Blättern mit 2526 × 1785 Pixeln pro Blatt in den bereits vorhandenen A4-PDF-Writer geschrieben. Keine Browser-Druckansicht, Browser-Fußzeile, externe Capture-Dienste oder neuen Bibliotheken. Das PDF enthält pro Kalenderblatt genau eine Querformatseite und wird über den bestehenden lokalen Downloadweg angeboten. Gedruckt wird anschließend die PDF-Datei in tatsächlicher Größe bzw. an den bedruckbaren Bereich angepasst. Temporäre Bildadressen und Canvas-Flächen werden auch bei Fehlern freigegeben. Der Rasterexport erhält kleine Namen mit hoher Auflösung, jedoch keinen auswählbaren PDF-Text.

Die Auswahl für neue Urlaubswünsche enthält nur Personen, deren Beschäftigungszeitraum das gewählte Jahr berührt (Ein-/Austrittsmonat einschließlich). Historische Wünsche werden weder gelöscht noch aus der Jahresübersicht entfernt; bestehende Einträge ausgeschiedener Personen können weiterhin ausdrücklich bearbeitet werden. Die Vorschlagsautomatik hatte diese Jahresbegrenzung bereits.

Tests: Jahreswechsel der Auswahl, inklusive Eintritt/Austritt, PDF-Konvertierung und Fehlerbereinigung. Chromium/WebKit prüfen den tatsächlichen Export auch offline sowie die PDF-Seitenzahl. Native iPhone-Dateizustellung bleibt ein zusätzlicher Gerätetest.
