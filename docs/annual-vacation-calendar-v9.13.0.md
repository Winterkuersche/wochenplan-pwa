# Jahreskalender für Urlaubswünsche (V9.13.0)

Unter **Urlaub → Urlaubswünsche · Jahreskalender** können Zeiträume für alle
Personen des Teams gesammelt werden. Standard ist das nächste Kalenderjahr,
aktuell 2027. Pro Person sind mehrere getrennte Zeiträume möglich. Die Liste
bietet Bearbeiten und Löschen; bestehende Schichten, genehmigte Abwesenheiten
und Urlaubskonten bleiben unverändert. Beide Geräte sollen die neue App laden.

**Jahreskalender drucken / PDF** öffnet ein eigenes Druckfenster. Dort kann der
Kalender gedruckt oder über den Druckdialog als PDF gesichert werden. Das
Vektorraster folgt der gelieferten Vorlage: zwölf Monate nebeneinander,
31 Tageszeilen, graue Wochenenden, rosa Schulferien und gelbe Feiertage.
Papierformat ist A4 quer. Die MEP-/Monats-/Übersichtsausgabe wird nicht verändert.

Die Namen werden mit 6,4 Punkt gesetzt, bei Bedarf zweizeilig. Der tatsächlich
gemessene Text bestimmt die Verteilung auf Blätter: insgesamt höchstens zwei
Namenszeilen je Tag und Monat. Wenn alle Einträge so auf ein Blatt passen,
entsteht genau ein Blatt. Andernfalls werden Personen auf zusätzliche vollständige
Jahresblätter verteilt; dieselbe Person bleibt mit allen Zeiträumen auf einem
Blatt. Ein optionaler Druckname erlaubt kürzere, eindeutige Bezeichnungen.
Zu lange Drucknamen blockieren den Druck mit einem Hinweis, statt abgeschnitten
oder unleserlich verkleinert zu werden. Wochenenden und Feiertage innerhalb der
gewünschten Zeiträume tragen ebenfalls den Namen; dies ist keine Urlaubstagezählung.

## Speicherung und Zusammenarbeit

`vacationCalendar` ist ein optionales Feld im vorhandenen Planungsdokument.
Die Daten laufen durch dieselbe lokale Journal-Speicherung, Dateisicherung,
Wiederherstellung und persönliche/gemeinsame Online-Synchronisierung wie der
übrige Plan. Keine neue Tabelle, RPC oder produktive Migration ist nötig.
Ohne Vertretungsrechte gelten weiterhin die vorhandenen Vorschlagsregeln.
Ein normaler Wochenplaneintrag muss das zusätzliche Feld erhalten.

Offene Formulareingaben blockieren automatische Übernahme eines anderen
Filialstands sowie einen durch den Service Worker ausgelösten Neustart.
Speicherfehler behalten die Eingabe und den bisherigen Plan. Überlappende
Wünsche derselben Person werden abgewiesen. Fehlerhafte importierte Daten
werden nicht still verworfen; der Import wird abgewiesen beziehungsweise die
vorhandene Gerätespeicherung geschützt. Alte Backups ohne Kalender bleiben gültig.

## Datengrundlage 2027

- Schulferien SH (Festland, ohne schulabhängige bewegliche Tage):
  [Land Schleswig-Holstein, Ferientermine](https://www.schleswig-holstein.de/DE/landesregierung/themen/bildung-hochschulen/ferientermine).
  Enthalten: 1.-6. Januar, 30. März-10. April, 7. Mai, 3. Juli-14. August,
  11.-23. Oktober und 23.-31. Dezember. Inselabweichungen sind nicht enthalten.
- Die zehn gesetzlichen Feiertage 2027 sind auch im bestehenden Feiertagsmodul
  ergänzt, damit die vorhandene Urlaubstageberechnung für 2027 dieselben
  Feiertage kennt. Die 2026-Daten bleiben unverändert.
- Andere Kalenderjahre sind wählbar; fehlende Ferien-/Feiertagsdaten werden in
  der Eingabe ausdrücklich angezeigt.

## Prüfung

Domänentests prüfen Datumsgrenzen, Schaltjahre, Jahreswechsel, Überlappungen,
Namensverteilung, Druck-Escaping und Sicherungsvalidierung. Ein synthetischer
Datenbanktest prüft den vorhandenen gemeinsamen Speicherweg einschließlich
Leserechten, Revisionskonflikt und Rücknahme. Es werden keine echten Konten
oder Pläne verwendet.

Der Chromium-/WebKit-Ablauf prüft Handy- und Desktopbreite, Eingabe,
Wiederöffnung, Änderungen, Speicherfehler, Erhalt bei Wochenplanänderungen,
Namensgrenzen und Mehrblattdruck. Chromium erzeugt einen synthetischen
PDF-Druck mit genau sieben Seiten sowie einen Screenshot der Eingabe.
