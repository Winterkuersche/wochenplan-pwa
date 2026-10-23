# V9.11.0 – getrennte Vorschläge und sicherer automatischer Abgleich

Der verbindliche Filialplan bleibt die Grundlage. Mitglieder ohne aktive
Vertretung bearbeiten zunächst einen lokalen Geräte-Entwurf und reichen ihn
mit Begründung ausdrücklich als Vorschlag ein. Erst die Filialverwaltung kann
annehmen oder ablehnen. Die bestehende RPC speichert Vorschläge dauerhaft und
getrennt vom Plan; es ist keine Datenbankmigration erforderlich.

## Bedienung

- „Offene Vorschläge (Anzahl)“ öffnet die gemeinsame Übersicht. Die Verwaltung
  sieht alle, Mitglieder die eigenen Vorschläge – auch nach Neuanmeldung auf
  einem anderen Gerät. Bereits entschiedene Einträge stehen unter „Erledigte
  Vorschläge“, mit Erstellungs- und Entscheidungsdatum.
- Kleine Hinweise an Wochen-/Monatszellen verweisen auf offene Vorschläge;
  die verbindlichen Schichtwerte werden dafür nicht verändert.
- Nach erfolgreichem Einreichen wird bei unverändertem Geräte-Entwurf und ohne
  offenen Editor wieder der aktuelle Filialplan angezeigt. Neue Eingaben während
  des Einreichens werden nicht verworfen. Ein fehlgeschlagener Versand lässt den
  Geräte-Entwurf stehen; er gilt nicht als online eingereicht.
- Ein neuer Online-Stand wird alle 15 Sekunden bei sichtbarer, verbundener App
  geprüft sowie beim Öffnen/Rückkehren und Wiederverbinden. Keine Push-Nachricht
  bei geschlossener App und kein kontinuierlicher Hintergrundbetrieb.
- Automatische Übernahme nur bei nachweislich sauberem, bereits abgeglichenem
  Gerät. Unversendete Geräte-Entwürfe, offene Eingaben, ein anderer schreibender
  Tab, Speicherfehler und unbekannte Stände auf neuen Geräten blockieren sie.
  Dann bleibt die manuelle Vergleichs-/Übernahmefunktion verfügbar.
- Beim Einreichen werden nur die Änderungen gegenüber der bekannten Basis auf
  den neuesten Plan gelegt. Fremde, unabhängige Änderungen bleiben erhalten.
  Überlappungen werden abgewiesen; den Geräte-Entwurf vorher sichern und nach
  Vergleich auf aktueller Grundlage neu vorbereiten.
- Bei einem inzwischen geänderten Vorschlagsziel zeigt die Übersicht einen
  Konflikt und den aktuellen Wert. Keine unveränderte Annahme möglich. Der
  Vorschlag bleibt offen, bis er abgelehnt oder auf neuer Grundlage neu eingereicht
  wird. Die serverseitige Revisions-/Wertprüfung bleibt maßgeblich.

## Sicherheit und Erhaltung

Keine Rechteausweitung, neuen Tabellen oder produktiven Datenzugriffe.
Annahme/Ablehnung und Autorenzuordnung bleiben serverseitig autorisiert.
Die lokale bekannte Basis ist pro Projekt/Konto/Filiale getrennt gespeichert;
ein unbekannter Geräte-Stand wird nie automatisch hochgeladen.
Automatische Übernahmen sind journalisiert, respektieren den Stale-Tab-Schutz
und erhalten Ansicht, Theme und lokale MEP-Kalibrierung. MEP-/PDF-Code und
bestehende Layout-Styles bleiben unverändert; Vorschlagsmarkierungen werden
nicht gedruckt. Asset-Version 2026-10-23-1, Cache v67.

## Prüfung

Regressionsfälle: sauberes Empfangsgerät, offener Editor, unversendeter Entwurf,
Offline-Fehler, Änderungen während Lesen/Einreichen, unabhängige und kollidierende
Serveränderungen, Kontowechsel und bestehende Rechte-/Revisionsprüfungen.
Lokales PostgreSQL (PGlite) verwendet ausschließlich synthetische Identitäten.
Der Zwei-Geräte-Browsertest prüft separate Vorschläge nach Reload, Zellmarker,
Annahme/Ablehnung, Konfliktmarkierung und den Empfang ohne Aktualisieren-Knopf.
Chromium und WebKit werden in GitHub Actions ausgeführt; deren tatsächliches
Ergebnis muss am finalen PR-Commit geprüft werden.
