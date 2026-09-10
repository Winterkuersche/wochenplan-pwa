# Regression-Analyse: MEP-PDF und Safari-Druck

## Ergebnis

Die zwei beobachteten Fehler wurden durch voneinander unabhängige Änderungen
eingeführt. Die fachliche Seitenerzeugung in `mep-view.js` war nicht die
Ursache: Sie teilt weiterhin jede Woche in Gruppen von höchstens neun
Mitarbeitern.

### Direkter PDF-Export auf iPhone/iPad

Der letzte bekannte speicherschonende Stand ist der Parent von `1e93ff5`
(`Document and delineate local PDF vs integration paths`, 5. April 2026).
Bis dahin erzeugte `runExportAttempt` die jsPDF-Instanz vor der Schleife und
führte innerhalb jedes Schleifendurchlaufs unmittelbar

1. `html2canvas(sheetEl)`,
2. `pdf.addPage(...)` und
3. `pdf.addImage(...)`

aus.

Commit `1e93ff5` verschob den PDF-Aufbau hinter die Capture-Schleife. Seit
dieser Änderung wurden alle Ergebnisse zuerst in `pageCanvases` gesammelt und
danach gemeinsam an `buildMepPdfBlobFromCanvases` übergeben. Bei zehn
hochauflösenden A4-Captures blieben somit zehn Canvas-Backing-Stores bis zum
letzten Capture gleichzeitig im Speicher. Das passt zum Fehlerbild „Abbruch
bei Seite 10 von 10“. Der Fehler betrifft den Stand seit **5. April 2026**;
die späteren Overview-Änderungen aus PR #401 haben ihn nicht eingeführt.

Der korrigierte Pfad stellt deshalb die frühere Reihenfolge gezielt wieder her
und ergänzt die explizite Freigabe des gerade verarbeiteten Canvas. Er führt
keine gemeinsame Pagination mit dem Overview-Export ein.

### Safari-Browserdruck

`git blame` führt die volle MEP-Innenhöhe im Print-Pfad auf Commit `710af6d`
(`Fix MEP sheet height budget and lock header/table/footer rows`,
25. März 2026) zurück. Der gezielte Diff zeigt:

- `--mep-sheet-inner-height` wurde von `202mm` auf `210mm` erhöht;
- `.mepTplSheetInner` erhielt im Print-Pfad ebenfalls diese volle Höhe;
- die äußere `.mepTplSheet` war zugleich bereits exakt `210mm` hoch und hatte
  weiterhin einen sichtbaren Rahmen.

Damit belegten äußerer Druckbogen und innerer Inhalt die vollständige Höhe
einer A4-Querformatseite. Für Rahmen und WebKit-Rundung blieb kein
Sicherheitsraum. Safari konnte den fertigen Sheet daher als minimal höher als
die verfügbare Papierfläche behandeln und vertikal auf zwei Druckseiten
fragmentieren. Dieses Druckrisiko besteht seit **25. März 2026**.

Die Korrektur lässt Wochen-/Mitarbeiteraufteilung und interne MEP-Pagination
unverändert. Sie begrenzt ausschließlich den fertigen Browser-Druckbogen mit
einem kleinen WebKit-Sicherheitsraum und behält den Umbruch *nach* dem Sheet
sowie den Schutz vor einem Umbruch *innerhalb* des Sheets bei.

## Verwendete Historienprüfungen

```text
git log --all --date=iso-strict --format='%h %ad %s' -- pdf-export.js
git show 1e93ff5^:pdf-export.js
git show 1e93ff5 -- pdf-export.js
git blame -L 4600,4668 styles.css
git log --all -S'--mep-sheet-inner-height: 210mm' -- styles.css
git show 710af6d -- styles.css
```

