# Geräteabgleich nach Neustart und Monatswechsel

Beim Start hat `bootstrapApp()` bisher die Frühstart-Regel für den aktuellen
Monat angewandt und Änderungen verzögert gespeichert. Bei einem vorhandenen,
noch nicht korrigierten Plan konnte dadurch ohne Eingabe eine lokale Schicht
von 09:00 auf 08:55 geändert werden. Ein verbundenes Gerät ohne Bearbeitungsrecht
behielt diese Änderung als eigenen Entwurf. Spätere Filialstände wurden wegen
der Abweichung zur bekannten gemeinsamen Basis nicht automatisch übernommen.

V9.16.3 entfernt diesen automatischen Planänderungs- und Speicheraufruf beim
Start. Die Frühstart-Korrektur bleibt Bestandteil der bestehenden bewussten
Speichervorgänge (`commitPlanChange()` und `commitPlanning2Plan()`). Ein bloßer
Neustart soll den verbindlichen Filialstand anzeigen und keinen neuen Entwurf
anlegen. Vorhandene echte lokale Entwürfe werden weiterhin geschützt.

Der Fehler und die Gegenmaßnahme wurden vor der Änderung mit zwei synthetischen
Konten, getrennten Browsersitzungen und einer lokalen PostgreSQL-Datenbank
reproduziert. Der erweiterte Kollaborations-Browserlauf prüft jetzt Neustart im
Folgemonat, unveränderten lokalen Plan, automatischen Empfang einer späteren
Änderung und die weiterhin wirksame Frühstart-Regel beim bewussten Speichern.
Tests und CI-Nachweis stehen am zugehörigen PR.

Die Änderung repariert keine bereits abweichenden lokalen Entwürfe durch
automatisches Überschreiben. Solche Geräte müssen einmal mit dem Filialstand
verglichen werden. Ob dieser Fehler die gemeldete tatsächliche Abweichung der
Kollegin verursacht hat, ist weiterhin offen. Produktive Daten und Datenbankrechte
werden durch diese Änderung nicht bearbeitet.
