# V9.10: zuverlässige Wochenplanung und kompakte Verwaltung

Die sechs priorisierten App-Aufgaben vom 21. Oktober 2026 werden gemeinsam umgesetzt.
MEP-Formular, MEP-CSS, Druckgeometrie und PDF-Export bleiben unverändert.

1. **Speichern:** Editor, Favorit, Mehrfachplanung, Tauschen/Verschieben,
   Monatsbasisplan und Vorschlagsübernahme verwenden den bestehenden zentralen
   Speicherabschluss. Journal, Stale-Tab-Prüfung und `wochenplan:saved` werden
   gemeinsam genutzt. Erfolgsmeldungen folgen erst nach erfolgreichem Speichern.
   Ein inzwischen geänderter Editorstand wird nicht übernommen.
2. **Mobile Verwaltung:** Schnellnavigation zu Gerät, Anmeldung und Filiale;
   gezielte Sprünge zu Einladungen/Rechten, Verlauf, Freigaben und Sicherungen.
   Ein Sprung öffnet den gewählten Verwaltungsabschnitt und schließt die anderen.
   Alle bestehenden Rechteprüfungen und Rückfragen bleiben erhalten.
3. **Stundenkonto:** Antippen der Stunden in der Woche beziehungsweise „Details“
   im Monat zeigt Arbeit, externe Aushilfe, Zeitgutschriften, Monatssoll,
   manuellen Ersatzwert und Saldo. Berechnungsquelle sind die bestehenden
   Kontofunktionen. GFB zeigt sein Monatskontingent statt eines Übertragskontos.
4. **Rückgängig:** Letzte Wochenplanänderung über den Knopf oder direkt im Hinweis
   zurücknehmen. Die Rücknahme speichert regulär und kann online abgeglichen werden.
   Schichtmenüs schließen vor der nächsten Eingabe, damit Favoriten erreichbar bleiben.
   Zwischenzeitliche Plan-/Teamänderung, offener Autosave, Import und Kontextwechsel
   verhindern eine Rücknahme über einen veralteten Stand. Einmalige Rücknahme;
   kein persistenter zweiter Planbestand und kein zusätzliches Änderungsjournal.
5. **Hinweise:** Eine aufklappbare Wochenliste bündelt Besetzung, Öffner,
   fehlenden freien Tag, Wochenstundenabweichungen und überschrittenes GFB-Kontingent.
   Ein Eintrag führt zum betroffenen Tag oder Stundenkonto.
6. **Vorschläge:** „Vorschläge auf Abruf“ aktiviert die vorhandene Pipeline nur für
   die laufende Sitzung. Erst ein Klick auf eine konkrete Besetzungslücke startet
   die Berechnung. Es werden höchstens drei Vorschläge angeboten. Kandidaten, die die abschließende Paketsimulation ablehnt, werden nicht angeboten.
   Anfordern verändert keine Daten. Übernahme prüft den aktuellen Plan erneut, verwendet den
   zentralen Speicherweg und lässt sich zurücknehmen. Keine Hintergrundoptimierung.

## Nachweise

- `tests/planning2-persistence.test.js`: Journal, Signal, Rücknahme, veralteter
  Editor/Tab, Speicherfehler, Teamänderung und offener Autosave.
- `tests/hour-breakdown.test.js`: Kategorien, Monatsgrenzen, manueller Nullwert,
  Ersatz statt Addition und direkte Datumsparser-Regression.
- `tools/browser-planning-smoke.js`: sichtbare Editor-/Favorit-/Mehrfach-/Tausch-/
  Verschiebe-/Basisplan-Aktionen, Rücknahme, Stunden, Hinweise, Vorschlagsabruf/-übernahme mit Rücknahme,
  veralteter Editor, Speicherfehler sowie Offline-Start und erneutes Öffnen mit
  tatsächlich aktivem Service Worker.
- Persönlicher und gemeinsamer Online-Smoke ändern jetzt eine Schicht über den
  sichtbaren Wocheneditor. Der gemeinsame Lauf prüft zusätzlich automatisches
  Speichern durch die Filialverwaltung und Übernahme auf einem zweiten Testgerät.
- Bestehende fachliche Vorschlags-, Rechte-, Revisions- und Pakettests bleiben bestehen.

Geprüfter Quellstand: `b372a42559e661f012d29c989ed10ba5f8afe460`. [CI-Nachweis](https://github.com/Winterkuersche/wochenplan-pwa/actions/runs/39606813341):
547 Tests, Chromium, WebKit, Helper-, Precache- und Wartungsprüfung erfolgreich.
Der Browserlauf prüft auch einen tatsächlichen Offline-Start, eine offline
vorgenommene Wochenplanänderung und erneutes Öffnen mit aktivem Service Worker.
Die echte SV-Abnahme und der Updatewechsel mit offenem Entwurf auf dem iPhone
bleiben separat zu protokollieren. Alle technischen Tests nutzen synthetische Daten.

Der zusätzliche echte Offline-Lauf deckte außerdem einen WebKit-Fehler bei
externen Ressourcen auf. Der Service Worker behandelt jetzt ausschließlich
same-origin-GET-Anfragen; optionale CDNs und API-Verbindungen bleiben vollständig
beim Browser. Die App hält dafür keine externen Bibliotheken im Cache vor.
