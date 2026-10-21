# Unabhängige Sicherung: vorbereiteter Ablauf

Status am 21.10.2026: separates Zielkonto verifiziert, privater Sicherungsordner
angelegt und erster echter Export erfolgreich zurückgelesen. Dateigröße und
Prüfsumme stimmen mit der Quelle überein. Der zurückgelesene Stand wurde zusätzlich
im echten App-Import in einem isolierten Browser wiederhergestellt und nach
erneutem Öffnen mit Team, Plan, Abwesenheiten, Umsätzen und Monatsdaten verglichen.
Eine separate tägliche Sicherungsaufgabe am Abend ist aktiviert; ihr erster
automatischer Lauf steht noch aus. Das Shop-Konto wird nicht verwendet.

## Ziel und Umfang

Das Ziel ist das vom Nutzer ausdrücklich bestätigte Google-Drive-Konto. Vor jedem
Schreibzugriff dessen Profiladresse gegen die privat hinterlegte Zieladresse prüfen.
Bei abweichendem Konto abbrechen. E-Mail-Adressen, Ordner-IDs, persönliche
Sicherungen und Zugangsdaten gehören nicht in dieses öffentliche Repository.

Vorgesehener Ordner: `Wochenplan Sicherungen`, ohne öffentliche Freigabe.
Vorgesehener Turnus: täglich; 30 geprüfte Tagesstände und 12 Monatsstände.
Aufbewahrung erst nach erfolgreichem neuem Upload und Rücklesen anwenden.
Nie andere Dateien oder den letzten brauchbaren Stand entfernen.

Gesichert wird die bestehende Filialplanung: bis zur Einrichtung des Teamzugangs
der bisherige Online-Stand, danach die vom Nutzer verwalteten Filialpläne.
Der frühere Einzelkonto-Stand bleibt als Rückweg erhalten und ist kein zweiter
aktiver Planungsbereich. Jeder Plan bleibt eine normale Format-2-JSON-Datei, die sich über
„Sicherung importieren“ wiederherstellen lässt. Ein Filialarchiv enthält zusätzlich
den personenbezogenen Änderungsverlauf als Dokumentation. Der Import schreibt
diesen Verlauf nicht als authentische Serverhistorie zurück.

Das ist eine Sicherung der Anwendungsdaten. Anmeldung, Konten und laufende Rechte
werden dadurch nicht automatisch in ein neu erstelltes Cloudprojekt übertragen.
Nur lokal vorhandene, noch nicht online gespeicherte Entwürfe benötigen weiterhin
den Dateiexport auf dem Gerät.

## Durchführung und Prüfung

1. Zielkonto prüfen, private Ordnerberechtigungen prüfen und bestehenden Tagesstand suchen.
2. Zugelassenen Quellplan lesend exportieren; Quelle und Revision getrennt protokollieren.
   Keine Auth-Tabellen, Passwörter, Sitzungen, API-Schlüssel oder Einladungsgeheimnisse exportieren.
   Große Ergebnisse vollständig programmgesteuert oder revisionsgebunden in Teile
   lesen; abgeschnittene Daten niemals als Sicherung übernehmen. Wenn während des
   Lesens die Revision wechselt, den Export wiederholen und eindeutig zuordnen.
3. Die vollständige Datei lokal prüfen:

   ```sh
   node tools/verify-backup.js /absoluter/pfad/sicherung.json
   ```

4. JSON mit eindeutigem Datum und Revisionskennung hochladen. Die ursprünglichen
   Dateibytes beibehalten; den ausgegebenen SHA-256 getrennt protokollieren.
5. Genau die hochgeladene Datei wieder herunterladen und ihre ursprüngliche
   Prüfsumme mitgeben:

   ```sh
   node tools/verify-backup.js /absoluter/pfad/heruntergeladen.json ERWARTETER_SHA256
   ```

6. Erst wenn Prüfsumme und lokale Wiederherstellung stimmen, den Lauf als erfolgreich
   melden. Fehler oder abgeschnittene Ergebnisse deutlich melden. Keine produktiven
   Pläne durch den Wiederherstellungstest ersetzen.
7. Den zurückgelesenen Stand zusätzlich im echten App-Import eines isolierten
   Browser-Kontexts mit blockiertem Produktionsnetzwerk wiederherstellen. Team,
   Schichten, Zeitbereich, Abwesenheiten und Monatsdaten vergleichen.

Das Hilfsprogramm nutzt die Importvalidierung und den journalgesicherten
Gerätespeicher der App in einer frischen lokalen Testinstanz. Es vergleicht alle
importierten Felder nach erneutem Öffnen. Es gibt nur Prüfsumme, Größe und
Zählwerte aus und benötigt keine Netzwerkverbindung oder Anmeldedaten.
Die Browserprüfung `tools/browser-data-smoke.js` prüft den App-Import zusätzlich
mit künstlichen Daten in einer getrennten Browserinstanz.

## Eingerichtet und noch offen

- Gewünschtes separates Google-Konto verbunden und Profiladresse verifiziert.
- Privater Ordner sowie echter Download-Rückweg geprüft.
- Separate Sicherungsaufgabe nach erfolgreichem Probelauf aktiviert.
  Die vorhandenen KI-Codeprüfer behalten ihre Sperre für Produktionsdaten und Drive.
  Die Sicherungsaufgabe muss vor jedem Schreiben Zielkonto und Zielordner prüfen.
- Geplanter Turnus: täglich am Abend in Europe/Berlin. Bis zur geprüften
  Aufbewahrung keine vorhandenen Sicherungen automatisch löschen.
- Ersten automatischen Lauf kontrollieren. Die technische Einzelkonto-/Teamablage
  soll in der Bedienung keine parallelen privaten und gemeinsamen Planungsbereiche bilden.
