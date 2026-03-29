# Stability Checklist (Wochenplan-PWA)

## 1) Risikoanalyse (vor Feature-Arbeit)

### Logik-Risiken
- [x] **Zeitnormalisierung**: Eingaben mit Sonderzeiten (`08:55`, `19:10`) und Rundung auf 15 Minuten bleiben konsistent.
- [x] **Pausenlogik**: Pflichtpause (>6h) sowie Spät-/Checkout-Ausnahmen berechnen reproduzierbar Minuten.
- [x] **Saldo-Berechnung**: Monatsdifferenz und historischer Saldo nutzen die gleichen Monatsgrenzen und Sollzeit-Quelle.

### Datenintegrität
- [ ] **Schedule-Sanitizing**: Persistierte `minutes` werden gegen Start/Ende/Pause validiert und korrigiert.
- [x] **Abwesenheiten**: Bereichs-Entfernung (trim/split/full remove) erzeugt nur gültige Datumsintervalle.
- [x] **Import/Export**: Backups mit fehlenden/legacy Feldern werden entweder klar abgelehnt oder abwärtskompatibel normalisiert.

### UI-Flows
- [ ] **Import-Flow**: Vor Import existiert eine interne Rückfallsicherung (`pre-import`).
- [x] **Monatsnavigation**: Monatsgrid zeigt vollständige Wochen inkl. Monatsgrenzen.
- [ ] **Absence-Änderungen**: UI-Operationen auf Abwesenheiten zerstören keine nicht überlappenden Teilintervalle.

## 2) Stabilitäts-Checks vor Release
- [x] `node --test tests/*.test.js`
- [ ] Backup-Import mit aktuellem Snapshot (Roundtrip)
- [ ] Backup-Import mit Legacy-Format (`master/plan/ui` ohne `storage`-Envelope)
- [ ] Manuelle Smoke-Checks: Woche/Monat/Urlaub öffnen, speichern, neu laden

## 3) Offene Risiken (bewusst verbleibend)
- Service Worker precache deckt weiterhin nicht alle lokalen Skripte ab (funktional, aber offline-first eingeschränkt).
- Keine E2E-Tests für DOM-Interaktionen in dieser Iteration; Fokus auf Kernlogik.
