# V9.10.2: Monatsbedienung und begrenzte Codeaufteilung

## Ergebnis

- Die unveränderten Speicher-, Wiederherstellungs- und Rücknahmefunktionen sind
  aus `app.js` nach `app-storage.js` verschoben. Die Datei wird vor `app.js`
  geladen; Zustand und Speicher werden weiterhin durch die App initialisiert.
- Monatsmenüs, FLEX-Eingabe und der flüchtige Mehrfachmodus stehen in
  `month-editor.js`. `month-view.js` enthält Tabelle, Navigation und Anbindung.
  Die verschobenen Funktionskörper wurden vor weiteren Änderungen bytegenau
  mit dem Ausgangsstand V9.10.1 verglichen. Beide neuen Dateien sind im Precache.
- Die Bearbeitung eines bestehenden Urlaubs-/Krankzeitraums ersetzt jetzt
  dessen alte Grenzen. Zuvor wurde ein verkürzter Zeitraum wieder mit dem alten
  Eintrag zusammengeführt. Vier Regressionen reproduzierten das vor der Korrektur.
- Monats- und Wocheneditor verwenden gemeinsam `prepareAbsenceRangeChange`.
  Die ursprüngliche Notiz bleibt erhalten; ein zwischenzeitlich geänderter
  Ausgangseintrag wird abgewiesen. Alte Urlaubseinträge im Wochen-Schedule
  bleiben nach einer Verkürzung nicht als zusätzliche Abwesenheit zurück.
- Im Monatsdialog kann Krank wieder zu Urlaub gewechselt werden. Zuvor
  setzte sich der alte Dialogtyp K gegen die neue Statusauswahl durch.
- Der Monatsweg synchronisiert die Urlaubseinträge vor der Neuberechnung
  der Urlaubszähler, sodass diese direkt zur Änderung passen.

## Prüfungen

`npm run check:all` prüft 559 Tests, globale Helfer und das Precache-Inventar.
Die Wartungsprüfung prüft zusätzlich Syntax und Asset-Versionen.

`tools/browser-month-smoke.js` läuft als Teil von `npm run test:browser` in der
bestehenden Chromium-/WebKit-Matrix, jeweils bei 390 und 1440 Pixel Breite.
Es bedient ausschließlich sichtbare Elemente und synthetische Importdateien.
Alle Anfragen außerhalb der lokalen Testinstanz werden blockiert. Geprüft werden:

- Monatszelle: F5 setzen, Stunden kontrollieren, auf Frei ändern und neu öffnen.
- Urlaub und Krank: anlegen, beide Grenzen im Monatsdialog kürzen, im
  Wocheneditor kürzen und den Zeitraum wieder verlängern.
- Mittleren Tag im Wocheneditor entfernen; beide Restintervalle neu öffnen.
- Über den bestehenden Monatsdialog ab einem Tag kürzen, einen ganzen
  Restzeitraum löschen und zwischen Urlaub/Krank wechseln.
- Nach jedem Schritt die gespeicherten Intervalle und fremde Schichten/Umsätze
  kontrollieren; alte Urlaubs-Schedule-Einträge und Laufzeitfehler ausschließen.

Im lokalen Arbeitscontainer fehlen Playwright-Browserdateien. Die lokalen
Funktionsprüfungen ersetzen deshalb nicht die Browserergebnisse am PR-Commit.
Diese sind in GitHub Actions einzusehen und vor Übernahme erforderlich.

## Grenzen

Dies ist der erste begrenzte Aufteilungsschritt, keine komplette Neustrukturierung
aller App-Dateien. MEP-/PDF-Implementierung und sämtliche Styles bleiben unverändert.
Es gibt keinen Monatsabschluss, CSV-Ausbau oder mehrstufige Rücknahme.
Echte Geräte-/SV-Abnahme, Passwort-Wiederherstellung und ein Versionswechsel
mit offenem Entwurf auf dem iPhone bleiben eigene Praxisschritte.
