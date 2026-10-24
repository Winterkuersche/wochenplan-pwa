# V9.12.0: einzelne Vorschlagsänderungen entscheiden

Ein Vorschlag kann mehrere Änderungen enthalten. Die Filialverwaltung kann
nun jeden Eintrag annehmen oder ablehnen. Die übrigen Punkte bleiben offen.
„Alle offenen annehmen/ablehnen“ entscheidet nur den noch offenen Rest.
Entschiedene Punkte bleiben mit Ergebnis, Name und Zeitpunkt beim Vorschlag.
Wenn alles entschieden ist, erscheint er unter „Erledigte Vorschläge“;
gemischte Ergebnisse werden ausdrücklich als solche bezeichnet.

Eine Schicht mit ihren zusammengehörigen Feldern ist ein Eintrag. Auch bei
einem zuvor leeren Tag werden die vorgeschlagenen Schichten einzeln angeboten.
Listen wie Teamdaten oder Abwesenheiten bleiben jeweils ein zusammenhängender
Änderungsblock; einzelne Felder oder Elemente solcher Listen werden nicht
unabhängig zusammengesetzt. Die Übernahme kann weiterhin Änderungen an
derselben Stelle nicht übergehen. Ein Konflikt blockiert nur den betroffenen
Eintrag und die vollständige Restübernahme. Andere konfliktfreie Punkte und
die Ablehnung bleiben möglich. Zellmarkierungen zählen nur noch offene Punkte.

Teilannahmen prüfen zusätzlich die Teamabhängigkeiten des gesamten Ergebnisses:
Eine Schicht oder Abwesenheit kann nicht ohne zugehörigen Teameintrag angenommen
werden. Auch das Entfernen einer Person bei verbleibenden Einträgen wird
abgewiesen. Teamdaten lassen sich zuerst annehmen oder mit ihren zugehörigen
Einträgen gemeinsam entscheiden. Ein abgewiesener Versuch verändert weder
Planrevision, Vorschlagsentscheidungen, Sicherungen noch Verlauf.
Die Prüfung greift zentral vor jeder Planaktualisierung, einschließlich direktem
Speichern, Rücknahmen und Wiederherstellungen. Eine angenommene neue Person
kann über den Verlauf erst entfernt werden, nachdem ihre später angenommenen
Schichten beziehungsweise Abwesenheiten zurückgenommen wurden. Gültige
vollständige Wiederherstellungen bleiben möglich; ungültige alte Sicherungsstände
werden mit einer verständlichen Meldung abgewiesen.

## Server-Aktualisierung vor Aktivierung

Der Code allein aktiviert die Einzelentscheidungen auf bestehenden Servern
noch nicht. `supabase/proposal-items-upgrade.sql` ist ein vollständig in einer
Transaktion ausgeführtes Upgrade für die bisherige Filialstruktur. Es ersetzt
die private API und Helfer, erweitert den Status um `mixed` und zerlegt alte
offene Tagesblöcke in einzelne Schichten. Planstände, Konten, geschlossene
Vorschläge, Sicherungen und der bisherige Verlauf werden nicht gelöscht.
Bereits teilweise entschiedene Punkte werden bei erneuter Ausführung erhalten.
Die Filialsperre verhindert parallele Entscheidungen während der Umstellung.

Das Upgrade wird aus der Neuinstallationsdatei generiert:

```sh
node tools/build-proposal-items-upgrade.js
```

Die Tests prüfen, dass das eingecheckte Upgrade dem Generator entspricht.
Die produktive Anwendung ist ein eigener administrativer Schritt. In diesem
Entwicklungsschritt wurde keine produktive Datenbank aufgerufen oder verändert.
Die komplette Neuinstallationsdatei darf nicht über bestehende Tabellen
ausgeführt werden. Für diese ist ausschließlich das Upgrade vorgesehen.
Beide Geräte sollen vor der Nutzung die aktualisierte App laden, damit auch
gemischte Abschlüsse richtig beschriftet werden.

Ein aktualisierter Server meldet `capabilities.proposal_items`. Ohne diese
Fähigkeit zeigt die App die bisherige Gesamtentscheidung und einen Hinweis
auf die noch nötige Server-Aktualisierung. Einzelentscheidungen benutzen eine
eigene Aktion `decide_proposal_items`; ein alter Server kann sie deshalb nicht
versehentlich als vollständige Annahme interpretieren. Alte Apps auf dem neuen
Server entscheiden mit ihrer bisherigen Aktion ausschließlich den offenen Rest.

## Technische Prüfung

Lokales PostgreSQL (PGlite) mit synthetischen Rollen und Planständen prüft
Teilannahme, Teilablehnung, gemischten Abschluss, Sichtbarkeit für Verfasser,
Zuordnung im Verlauf, gezielte Rücknahme, abgewiesene Fremdzugriffe, ungültige
und doppelte Auswahl, veraltete Revisionen, bereits entschiedene Punkte,
atomaren Abbruch bei Konflikten, neue Tage und das wiederholbare Upgrade alter
offener Tagesvorschläge. Controller-/Modelltests prüfen die Sperre bei alten
Servern, stabile Auswahlindizes und verbleibende Zellmarkierungen.

Der Browserablauf mit zwei synthetischen Geräten prüft einzelne Annahme und
Ablehnung innerhalb desselben Vorschlags, Neuladen mit offenem Rest,
gemischten Verlauf, Konfliktschutz und den weiterhin automatischen Abgleich.
App-, Asset- und Cache-Version wurden zusammen erhöht. Druck/MEP und
PDF-Berechnung sind unverändert.

Lokal bestanden: 591 Tests unter `TZ=UTC` (wie in GitHub Actions), globale
Helper-Prüfung, vollständiger SW-Precache und Wartungsprüfung. Der lokale
Browserstart ist durch fehlende Playwright-Browserdateien blockiert; die
Browsermatrix in GitHub Actions muss vor Veröffentlichung erfolgreich sein.
Zwei vorhandene Tests der separaten Planungsvorschau scheitern in der lokalen
Systemzeitzone America/Mexico_City bereits auf dem unveränderten Ausgangsstand;
unter UTC bestehen sie. Die Planungsvorschau wurde hier nicht verändert.
