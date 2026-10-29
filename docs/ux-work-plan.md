# Bedienprüfung: Arbeitsplan V9.16.0

Ausgangsstand: eed6b36, Bedienprüfung vom 29.10.2026. Nur synthetische Daten.

- [x] Automatische Folgekorrekturen vor dem Speichern abschließen und zusammen rücknehmbar halten.
- [x] Monatsbezug zwischen Wochenplanung und anderen Ansichten übergeben, ohne Navigation allein zu speichern.
- [x] Verdeckte Ansichten erst beim Öffnen aufbauen; MEP-Export behält seinen expliziten Seitenaufbau.
- [x] Zeitangaben bei Früh-/Spätauswahl ergänzen und sofortiges Speichern erklären.
- [x] Handy-Kopfbereich kompakter gestalten, große Schaltflächen erhalten.
- [x] Escape, Anfangsfokus und Tastaturbegrenzung des Schichtdialogs ergänzen. Die vorhandene Dialogrolle liegt bereits auf dem inneren Dialog; keine doppelte Rolle hinzufügen.
- [x] Browser-Gegenprüfung: Rücknahme, November in Monat/MEP und Escape funktionieren.
- [ ] CI-Ergebnisse am PR prüfen.

633 lokale Tests sowie globale Helper- und Service-Worker-Asset-Prüfungen bestanden. Ein neuer Screenshot konnte wegen Zeitüberschreitung des Browserdienstes nicht erstellt werden.
- [ ] iPhone-Praxiskontrolle durch Nutzer nach Veröffentlichung.

Tests: gezielte Regression für verborgene Ansichten, Monats-/Jahresgrenzen und gemeinsame Rücknahme automatischer Folgewirkungen; vollständige bestehende Testsuite. Tatsächliche Ergebnisse siehe PR.
