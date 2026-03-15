# Vorschläge aus Codebasis-Review

## 1) Aufgabe: Tippfehler/Versionsangabe im Seitentitel korrigieren
**Fund:** In `index.html` steht im statischen `<title>` noch `Wochenplan V9`, während die App-Version zentral in `version.js` als `V9.2` gepflegt wird.

**Risiko/Nutzen:** Nutzer sehen je nach Stelle unterschiedliche Versionsstände (Browser-Tab vs. App-Header), was zu Verwirrung bei Fehlermeldungen und Support führen kann.

**Vorschlag:**
- Entweder den statischen Titel in `index.html` auf den aktuellen Stand bringen,
- oder den statischen Titel auf einen neutralen Wert setzen und nur noch per `APP_META` setzen lassen.

**Akzeptanzkriterien:**
- Browser-Tab und App-Header zeigen denselben Versionsstand.
- Es gibt nur noch eine zentrale Quelle für die sichtbare Version.

---

## 2) Aufgabe: Programmierfehler im Service Worker (Offline-Fähigkeit) beheben
**Fund:** `sw.js` cached nur einen Teil der JavaScript-Dateien. Mehrere Laufzeit-Abhängigkeiten (z. B. Utility-Module) fehlen in `APP_FILES`.

**Risiko/Nutzen:** Bei Offline-Nutzung kann die App trotz gecachtem `index.html` nicht vollständig starten (fehlende Skripte/`ReferenceError`).

**Vorschlag:**
- `APP_FILES` vollständig um alle lokal geladenen JS-Dateien ergänzen,
- optional Build-/Lint-Check ergänzen, der sicherstellt, dass alle in `index.html` referenzierten lokalen Assets im Precache enthalten sind.

**Akzeptanzkriterien:**
- Vollständiger Erstaufruf online, danach funktionaler Reload offline.
- Keine fehlenden Script-Requests im Offline-Modus.

---

## 3) Aufgabe: Kommentar-/Doku-Unstimmigkeit bereinigen
**Fund:** Die UI kommuniziert in der Kopfzeile „Mo-Sa · Stammdaten + 4 Ansichten“, gleichzeitig existieren in der Formularansicht Spalten/Platzhalter für Sonntag (`So`, `mepDateSo`).

**Risiko/Nutzen:** Der fachliche Geltungsbereich (6-Tage- vs. 7-Tage-Sicht) ist uneinheitlich und kann zu Fehlbedienung oder falschen Erwartungen führen.

**Vorschlag:**
- Fachlich entscheiden, ob Sonntag offiziell Teil der Planung ist,
- danach UI-Text und Formulardarstellung konsistent ziehen (entweder Sonntag entfernen oder Texte auf Mo-So anpassen).

**Akzeptanzkriterien:**
- Keine widersprüchlichen Hinweise mehr zwischen Kopfzeile, Tabellen und Formularansicht.
- Team kann den Geltungsbereich eindeutig benennen.

---

## 4) Aufgabe: Tests verbessern (Regressionen bei Abwesenheitslogik verhindern)
**Fund:** Es fehlen automatisierte Tests für kritische Randfälle in Datums- und Abwesenheitslogik (u. a. Bereichs-Abzug/Splitten von Abwesenheiten).

**Risiko/Nutzen:** Kleine Änderungen an Datumslogik können unbemerkt falsche Urlaub-/Krankheitszeiträume erzeugen.

**Vorschlag:**
- Unit-Tests für `subtractRangeFromAbsenceEntry` ergänzen:
  - komplette Überdeckung,
  - Abschneiden am Anfang,
  - Abschneiden am Ende,
  - Split in zwei Teilzeiträume,
  - kein Overlap.
- Zusätzliche Datums-Tests (`fromIsoDate`) für ungültige Tage und Schaltjahrfälle.

**Akzeptanzkriterien:**
- Testfälle decken die genannten Randfälle reproduzierbar ab.
- Bei Regressionen schlagen Tests deterministisch fehl.
