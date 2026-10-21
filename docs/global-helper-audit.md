# Prüfung globaler Helper-Namen

Aktualisiert am 21. Oktober 2026 am Quellbaum von V9.9.3
(`a44677fe6d922af168cd38ddab3eb05fa6a47ff4`).

- Befehl: `node tools/check-global-helper-collisions.js`
- Geprüfte Dateien: 42
- Gefundene Top-Level-Helper: 584
- Kollisionen über Dateigrenzen: 0

Der ältere Zählstand vom 25. März 2026 (18 Dateien / 352 Helper) ist damit abgelöst.
Dieser Check erkennt doppelte globale Namen. Er beweist weder, dass alle Skripte
benutzt werden, noch dass es keine fachlich ähnlichen oder doppelten Abläufe gibt.
Dynamische Aufrufe und Vorschauseiten vor einer Entfernung berücksichtigen.

## Regel für neue Helper

- Pro öffentlichem Helper-Namen genau eine Top-Level-Definition behalten.
- Modulinterne Helfer in IIFEs/Closures kapseln.
- Den Prüfer vor Veröffentlichung erneut ausführen; Zahlen gelten nur für den
  oben genannten Quellbaum.
