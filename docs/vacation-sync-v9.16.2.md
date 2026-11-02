# Urlaub und Wunschurlaub: Geräteabgleich nach Personenauswahl

Schon die Auswahl einer Person im Formular für Urlaubswünsche setzte bisher
`dirty = true`. Das blieb auch nach dem Verlassen des Feldes oder einem
Ansichtswechsel bestehen. `canApplySharedPlan()` blockierte dadurch den gesamten
automatischen Abgleich, einschließlich der normalen Urlaubsübersicht.

Die Personenauswahl allein erzeugt jetzt keinen offenen Entwurf. Eingaben in
Von, Bis, Druckname und Überschrift sowie das Bearbeiten bestehender Wünsche
und eine offene Urlaubsverteilung bleiben geschützt. Eine bereits offene
Eingabe bleibt auch beim Wechsel der ausgewählten Person offen.

Die bisherigen Prüfungen für aktive Eingabefelder, offene Dialoge, lokale
Speicherprobleme, ungesendete Planänderungen und fremde Revisionen gelten weiter.
Eine gerade aktive Auswahl kann den Abgleich daher bis zum Verlassen des
Feldes aufschieben. Nach dem Verwerfen echter Eingaben kann der nächste
automatische Abgleich den wartenden Online-Stand übernehmen.

## Prüfung

- Der neue Browserfall schlug vor der Korrektur an der bloßen Personenauswahl fehl.
- Nach der Korrektur besteht der Kalenderablauf in Chromium bei 390 und 1440 Pixeln,
  einschließlich geschützter Datums-, Titel-, Drucknamen- und Bearbeitungseingaben.
- Alle 634 bestehenden Tests sowie Helper-, Precache-, Syntax- und Versionsprüfung bestehen.
- Der zusätzliche Ablauf mit zwei getrennten Konten und Browsersitzungen prüft
  automatische Aktualisierung von Wünschen und genehmigtem Urlaub, Auswahlbeibehaltung,
  Schutz eines echten Entwurfs und Nachholen des Abgleichs nach dem Verwerfen.
  Sein Ergebnis und die Chromium-/WebKit-CI sind am zugehörigen PR nachzuweisen.

Alle Daten und Konten der Tests sind synthetisch. Das tatsächliche Gerät der
Kollegin wurde nicht untersucht. Es gibt keine Datenbankmigration und keine
Änderung produktiver Planungsdaten. Assets und Service-Worker-Cache werden mit
V9.16.2 erneuert.
