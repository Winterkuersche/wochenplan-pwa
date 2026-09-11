# Manueller Smoke-Test: MEP-PDF-Export (Issue #405)

## Zweck

Dieser Test bestätigt auf einem echten iPhone/iPad, dass eine bereits gerenderte
`.mepTplSheet` die unveränderliche PDF-Seitengrenze bleibt und der Export nicht
mehr von Safaris Druck-Pagination abhängt.

## Voraussetzungen

- Aktueller Stand der Live-App wurde vollständig veröffentlicht (einschließlich
  aktualisiertem Service Worker).
- Safari auf einem iPhone oder iPad; alternativ die installierte PWA.
- Ein MEP-Monat, der mehrere `.mepTplSheet`-Seiten erzeugt.

## Technischer Hintergrund des iOS-Pfads

Der vorherige echte Export wandelte jedes JPEG zunächst vollständig in einen
`Uint8Array` um. jsPDF 2.5.1 wandelte diese Daten in seinem `addImage`-Pfad
intern erneut in eine binäre String-Repräsentation um. Auf speicherbegrenzten
iOS-Geräten entstanden dadurch neben Canvas und JPEG-Blob weitere vollständige
Seitenkopien; genau die Übergabe an `addImage` beziehungsweise der anschließende
`output("blob")` konnte deshalb trotz erfolgreichem Capture scheitern.

Der MEP-Export verwendet nun keinen jsPDF-`addImage`-Pfad mehr. Ein kleiner,
auf diesen Anwendungsfall beschränkter PDF-Writer hängt die von `canvas.toBlob`
erzeugten JPEG-Blobs direkt als `/DCTDecode`-Image-XObjects an den finalen
PDF-Blob. Die iOS-Kompatibilitätsannahme beschränkt sich damit auf APIs, die der
Export ohnehin benötigt: `canvas.toBlob`, `Blob`/Blob-Parts, `File` und für die
native Zustellung die Web Share API mit Dateiunterstützung.

## Ablauf und erwartetes Ergebnis

1. Live-App in Safari oder als PWA öffnen.
2. Einen MEP mit mehreren Seiten erzeugen und die MEP-Ansicht öffnen.
3. **„Drucken / PDF“** beziehungsweise **„Monat als PDF exportieren“** antippen.
4. Bestätigen, dass **keine Safari-Druckvorschau** erscheint.
5. Bestätigen, dass der native Share-Sheet erscheint.
6. Im Share-Sheet **„In Dateien sichern“** wählen und die PDF speichern.
7. Die gespeicherte PDF aus der Dateien-App öffnen.
8. Seiten zählen und mit den sichtbaren MEP-Tabellen vergleichen: Jede Tabelle
   muss vollständig und in unveränderter Reihenfolge genau eine A4-Seite im
   Querformat (297 × 210 mm) belegen.
9. Prüfen, dass unten links keine App-URL angezeigt wird.
10. Prüfen, dass weder Datum noch Browser-Kopfzeilen, Browser-Fußzeilen oder
    andere Safari-Druckinformationen vorhanden sind.

## Zusätzliche Abbruch- und Fallback-Prüfungen

- Share-Sheet erneut öffnen und abbrechen. Erwartung: kein Download, kein zweiter
  Dialog und keine Druckansicht.
- Auf einem Browser ohne File-Sharing exportieren. Erwartung: genau ein lokaler
  PDF-Download über eine Blob-URL; keine Druckansicht.
- Einen Exportfehler provozieren (zum Beispiel die Bibliothek im DevTools-Netzwerk
  blockieren). Erwartung: Fehlermeldung mit Exportphase; keine Druckansicht.

## Abnahmesatz

> Die bereits fertig erzeugte MEP-Tabelle ist die Seitengrenze. Eine
> `.mepTplSheet` darf niemals gesplittet, gecroppt oder auf mehrere
> PDF-/Druckseiten verteilt werden. Jede MEP-Tabelle muss vollständig auf genau
> einem A4-Querformat-Blatt erscheinen.
