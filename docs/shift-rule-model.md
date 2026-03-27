# Shift Rule Model (code- und policy-basiert)

## 1) Bestandsaufnahme / Freeze

### Bekannte Schichtcodes (vollständig)
- `F3`, `F4`, `F5`, `F6`, `L`, `G`, `FLEX`, `AH`, `U`, `K`, `FÖ` (intern normalisiert auf `FO`).

### Relevante Eintragsfelder in gespeicherten Daten
- `type`, `mode`, `code`, `start`, `end`, `pause`, `minutes`.

### Architektur-Festlegung
- Die Schichtlogik ist **code- und policy-basiert**.
- `mode` bleibt als Kompatibilitätsfeld erhalten, ist aber nicht mehr die führende Entscheidungsquelle.
- Legacy-Codes werden beim Normalisieren auf Basis-Codes abgebildet (z. B. `FÖ → FO`, `L1/L2/L3/L4/L1E..L4E → L`, `G1 → G`).

## 2) Regel-Schema je Schicht

Jede Schichtregel enthält:

- `startPolicy`
- `endPolicy`
- `breakPolicy`
- `uiPolicy`

Zusätzlich Metadaten wie `code`, `label`, `entryType`.

### Policy-Typen (aktuell)

- `startPolicy`
  - `fixed`: fester Start
  - `select`: Auswahl aus erlaubten Zeiten
  - `user-input`: freie Eingabe über Dialog (mit Validierung)
- `endPolicy`
  - `fixed`: festes Ende
  - `select`: Auswahl aus erlaubten Zeiten
  - `checkout`: Ende abhängig von „Abrechnung ja/nein“
  - `user-input`: freie Eingabe über Dialog
- `breakPolicy`
  - `fixed`
  - `fixedByCheckout`
  - `effective` (inkl. zentraler Pflichtpausenlogik)
  - `external-help`
  - `none`
- `uiPolicy`
  - `dialogRequired`
  - ggf. UI-Hinweise wie `dialogType`, `startReadOnly`, `minWorkMinutes`

## 3) Beispiel FÖ

`FO` (`FÖ`) ist zentral als Regel hinterlegt:

- Start fix: `08:55`
- Ende: auswählbar von `12:00` bis `19:00` in 15-Minuten-Schritten + `19:10`
- Pause: `5` Minuten als konfigurierte Basis (mit zentraler Effektiv-Berechnung)
- UI: Dialogpflicht, Start read-only

## 4) Neue Schicht in 5 Schritten hinzufügen

1. **Regel in `shift-rules.js` ergänzen**
   - `code`, `label`, `entryType`, alle vier Policies.
2. **Option im Dropdown freischalten**
   - Eintrag in `SHIFT_OPTION_GROUPS` ergänzen.
3. **Dialogpflicht festlegen**
   - Über `uiPolicy.dialogRequired` (wird von `isDialogShift(code)` genutzt).
4. **Builder verwenden statt Sonderlogik**
   - `buildShiftEntryFromRule(rule, userInput, context)` verwenden.
5. **Persistenz/Anzeige prüfen**
   - Laden/Normalisierung (`app.js`) sowie Anzeige in Wochen- und MEP-Sicht testen.
