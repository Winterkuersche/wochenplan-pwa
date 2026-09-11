# MEP-PDF: iOS-Fehleranalyse und neuer Binärpfad

## Audit des bisherigen echten Exportpfads

Die App bindet jsPDF 2.5.1 ein. Der MEP-Pfad übergab an `addImage` ein JPEG als
`Uint8Array`; dafür wurde zuvor der vollständige Canvas in einen JPEG-Blob und
dieser Blob anschließend per `arrayBuffer()` in eine weitere vollständige
Bytefolge umgewandelt. jsPDFs `addImage`-Implementierung akzeptiert diese Form
zwar grundsätzlich, verarbeitet Bilddaten intern jedoch in einer eigenen
Repräsentation und hält sie bis `output("blob")` im PDF-Dokument. Diese API-
Kompatibilität ist daher keine Garantie für ein niedriges Peak-Memory auf iOS.

Die Phasenbewertung lautet:

| Phase | Bewertung des bisherigen Pfads |
| --- | --- |
| `html2canvas` | Kann bei komplexem DOM oder Canvas-Limits scheitern; Scale 1,25 und sequentielles Capture begrenzen das Risiko bereits. |
| `canvas.toBlob` | Ist asynchron und vermeidet einen Base64-String; dies ist der geeignete Safari-Pfad. |
| `Uint8Array` | Erzeugte aus jedem JPEG-Blob eine zusätzliche vollständige Seitenkopie. |
| `jsPDF.addImage` | Musste die fremde Binärrepräsentation erkennen und intern weiterverarbeiten; hier konnten weitere Kopien und Formatkonvertierungen entstehen. |
| `pdf.output("blob")` | Materialisierte das von jsPDF intern aufgebaute Dokument erneut; bei mehreren großen Seiten war dies ein weiterer Peak-Memory-Kandidat. |
| `File` | Erst nach fertigem PDF und ohne Bilddekodierung; geringes Fehlerrisiko. |
| `navigator.share` | Kann ablehnen oder vom Benutzer abgebrochen werden, ist aber nicht Teil der PDF-Erzeugung. |

Der wahrscheinlichste spezifische Fehler ist somit kein fehlender nomineller
`Uint8Array`-Support, sondern die kumulierte Speichervervielfachung zwischen
Canvas, JPEG-Blob, ArrayBuffer/Uint8Array, jsPDF-Bildrepräsentation und finaler
Ausgabe. Das erklärt auch, warum derselbe Pfad auf Desktop funktionieren und auf
einem speicherbegrenzten iPhone bei mehrseitigen MEPs abbrechen konnte.

## Neuer MEP-PDF-Pfad

Der MEP-Pfad verwendet jsPDF nicht mehr. Ein begrenzter PDF-1.4-Writer erzeugt
für jedes fertige Sheet genau drei Objekte:

1. eine `/Page` mit fester A4-Landscape-`MediaBox`,
2. ein `/Image`-XObject mit `/DCTDecode`, dessen Stream direkt der JPEG-Blob ist,
3. einen kurzen Content-Stream, der das Bild auf die vollständige Seite mappt.

Die JPEG-Blobs werden als Blob-Parts referenziert. Es gibt weder Base64 noch
`arrayBuffer()`, `Uint8Array`, jsPDF-`addImage` oder jsPDF-`output` im produktiven
MEP-Pfad. Die Cross-Reference-Tabelle wird aus den Blob-Größen aufgebaut. Damit
bleibt pro Capture nur ein Canvas aktiv; nach `toBlob` wird dessen Backing-Store
sofort freigegeben.

## iOS-Kompatibilitätsannahme

Der neue Pfad setzt auf `HTMLCanvasElement.toBlob("image/jpeg")`, den `Blob`-
Konstruktor mit Blob-Parts und den `File`-Konstruktor. Für die native Zustellung
kommt File Sharing nur nach einem positiven
`navigator.canShare({files: [file]})` zum Einsatz. Ein `AbortError` beendet die
Benutzeraktion ohne jeden weiteren Zustellversuch. Fehlt File Sharing, bleibt
der Blob/ObjectURL-Download; ein Druckpfad existiert für MEP nicht.

Diese Annahme ist enger als zuvor: Safari muss keine jsPDF-spezifische
Binärdatenkonvertierung mehr korrekt und speichereffizient durchlaufen.
