# Integrierte Planning-2-Vorschau und produktiver Wochenplan

Abgeglichen am 21. Oktober 2026. Planning 2 ist als sichtbarer Wochenplaner
bereits in der normalen App integriert. Eine Vorschauseite ist kein weiterer
persönlicher oder gemeinsamer Arbeitsbereich für die Filiale.

## Konfigurierter Vorschauablauf

`.github/workflows/planung-2-preview.yml` reagiert auf Pushes des Entwicklungszweigs
`planung-2-interaktiv` oder einen manuellen Start. Nach den definierten Tests
kopiert er den Quellstand in das separate Repository
`Winterkuersche/wochenplan-pwa-preview`:

- `planung-2/`: eigenständige `planung2-preview.html` als `index.html`;
- `planung-2-live/`: vollständige App mit normalem `index.html`.

Der frühere Wortlaut „Preview-Pfad“ bezeichnet diese Ordner im separaten
Vorschau-Repository, nicht Unterbereiche der produktiven Filial-App. Die
Konfiguration des Workflows belegt keinen aktuellen erfolgreichen Vorschau-Deploy.
Der genaue Mechanismus steht in [planung2-preview.md](planung2-preview.md).

## Aktueller Funktionsumfang

Die produktive App nutzt manuelle Schichteingaben und Besetzungshinweise.
Automatische Planungsvorschläge sind in `planning2-live.js` derzeit über
`PLANNING2_SUGGESTIONS_ENABLED=false` deaktiviert. Kandidatengeneratoren im
Quelltext und ihre Tests sind daher kein Nachweis einer freigegebenen
Vorschlagsoberfläche.

Aktuelle Fehler und Abnahmepunkte werden in
[stability-checklist.md](stability-checklist.md) geführt. MEP-Tabelle und ihre
Druck-/Exportgestaltung bleiben im aktuellen Auftrag unverändert.
