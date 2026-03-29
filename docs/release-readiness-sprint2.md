# Sprint 2 – UI-Sicherheit, Smoke-Checks und Release-Härtung

Stand: 2026-03-29

## 1) Stabilisiert in diesem Sprint

- **UI-Defaults entschärft (Month View):**
  - Für leere Monatszellen gibt es weiter den Auswahldialog per Prompt, aber **ohne voreingestellten Aktions-Default**.
  - Damit wird verhindert, dass eine versehentliche Enter-Bestätigung implizit eine Fachaktion auslöst.
- **Transparenz bei manuellen Monats-Iststunden erhöht:**
  - Konsistenter, dezenter Marker `•` an Monats-Ist/Monats-Delta Stellen.
  - Bestehende Tooltips bleiben erhalten und verweisen explizit auf manuell hinterlegte Werte.
- **Smoke-Checks ergänzt (Node-basierte Integration statt Browser-E2E):**
  - Flow A: Schicht erzeugt Ist-Minuten + Delta ist berechenbar.
  - Flow B: Urlaub trimmen/löschen liefert erwartete Restintervalle.
  - Flow C: Backup-Validierung für aktuelles + Legacy-Format ohne Crash.
- **Service Worker Cache-Fallback gehärtet:**
  - `ignoreSearch` nur noch dort, wo es beabsichtigt ist (Navigation + statische Assets).
  - Für sonstige Requests (z. B. API-ähnliche Pfade) kein pauschales `ignoreSearch`, um falsche Cache-Treffer zu vermeiden.

## 2) Bewusst verbleibende Risiken (Priorität)

1. **Mittel:** Service Worker ist in `index.html` weiterhin deaktiviert (Debug-Konfiguration), daher greifen Runtime-Fallbacks nur nach Reaktivierung.
2. **Mittel:** Node-Smoke-Tests validieren Kernlogik, aber kein echtes Browser-Interaktionsverhalten (Dialoge, Renderdetails, SW-Lebenszyklus).
3. **Niedrig-Mittel:** Marker `•` ist bewusst dezent; bei sehr dichter Darstellung könnte die Sichtbarkeit je nach Gerät begrenzt sein.

## 3) Go / No-Go Empfehlung

- **Empfehlung: GO (mit Auflagen).**
- Begründung:
  - Kritische implizite UI-Defaults wurden entschärft.
  - Kern-Smoke-Pfade sind automatisiert abgedeckt.
  - SW-Fallback-Regeln sind präziser und risikoärmer.
- Auflage vor nächster Feature-Phase:
  - SW-Reaktivierung bewusst und kontrolliert testen (mind. ein realer Offline-Browserlauf).

## 4) Konkrete Next Steps (max. 5)

1. Service Worker in einer Testumgebung gezielt aktivieren und Offline-/Update-Flows einmal Ende-zu-Ende gegenprüfen.
2. Optional minimalen Browser-Smoke (Playwright/Cypress) nur für „Monatszelle klicken → Dialog speichern“ ergänzen.
3. UI-Feinschliff: Marker-Kontrast im Dark-Mode auf echten Geräten kurz validieren.
4. Release-Checkliste um „SW aktiv/deaktiviert“-Schalter und erwartetes Verhalten ergänzen.
5. Nachfolgende Feature-Sprints auf denselben Smoke-Bausteinen aufsetzen (Regressionsschutz).
