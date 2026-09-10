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

Commit `0bfa9ee` beseitigte damit zwar die gleichzeitigen Canvas-Backing-Stores,
aber nicht die zweite Speichervervielfachung innerhalb jedes Durchlaufs. Sein
Pfad erzeugte weiterhin aus jedem Canvas zunächst eine PNG-Data-URL. Safari
musste dadurch gleichzeitig Canvas-Pixel, verlustfrei komprimierte PNG-Daten,
den Base64-/JavaScript-String und die von jsPDF dekodierten bzw. gecachten
Bilddaten halten. Das Nullsetzen der Canvas-Abmessungen kann nur dessen Backing
Store freigeben; es gibt weder den an `addImage` übergebenen String noch den
internen jsPDF-Bildbestand frei. Bei mehrseitigen MEPs wächst Letzterer bis zu
`pdf.output("blob")` zwangsläufig weiter. Außerdem fasste `0bfa9ee` Fehler aus
Capture, `toDataURL`, `addImage` und `output` fälschlich als Renderfehler der
aktuellen Seite zusammen.

Der aktuelle Fix kodiert deshalb jede Seite asynchron mit `canvas.toBlob()` als
JPEG und übergibt jsPDF direkt ein `Uint8Array`. Die Base64-Darstellung entfällt
vollständig, und die in jsPDF verbleibenden komprimierten Seitendaten sind
wesentlich kleiner als PNGs der tabellenreichen Vollseiten. Auf iOS wird mit
Scale 1,25 statt 1,5 erfasst und nach jeder Seite ein Browser-Zyklus freigegeben.
`html2canvas` erhält zudem ausdrücklich `removeContainer: true`. Vor dem ersten
Capture wartet der Export auf Fonts und Bilder. Stufenfehler unterscheiden nun
DOM-/Seitensuche, Capture, Bildkonvertierung, `addImage`, `output`, File,
`canShare`, `share` und Download-/Öffnen-Fallback.

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
