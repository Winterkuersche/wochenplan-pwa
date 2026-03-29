# Mobile Top-Toolbar (<= 640px)

Auf kleinen Screens (max-width: 640px) ist die Top-Toolbar vereinfacht:

- **Direkt sichtbar** bleiben die wichtigsten Aktionen:
  - Ansicht wechseln
  - Wochennavigation
  - **Stammdaten speichern**
- **Sekundäre Aktionen** sind im Button **„Mehr ▾“** gebündelt:
  - Team ein-/ausblenden
  - Aktuelle Woche leeren
  - Sicherung exportieren/importieren
  - Dark Mode wechseln
  - Drucken / PDF
  - MEP-Modus umschalten (wenn MEP-Ansicht aktiv)

## Verhalten & Accessibility

- Das Mehr-Menü öffnet als Popover direkt unter dem Button.
- Menüeinträge lösen weiterhin dieselben bestehenden Button-Handler aus (keine Business-Logik verändert).
- **Escape** schließt das Menü.
- Klick außerhalb schließt das Menü.
- Beim Öffnen wird der erste sichtbare Menüeintrag fokussiert.
- Beim Schließen per Escape/Action springt der Fokus zurück auf „Mehr“.
