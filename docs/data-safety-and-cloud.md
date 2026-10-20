# Daten & Sicherung – V9.8

Der Bereich **Daten & Sicherung** zeigt den Speicher dieses Browsers bzw. dieser
Home-Bildschirm-App und den Online-Status getrennt an. Bestehende v10-Daten und
Sicherungen werden weiterverwendet. Es werden keine echten Personalplanungen
oder Sitzungsdaten im Repository abgelegt.

## Erste Verbindung

1. Auf dem Gerät mit dem gewünschten Plan eine Dateisicherung herunterladen.
2. In **Daten & Sicherung** ein Konto erstellen und die E-Mail bestätigen.
3. Anmelden und **Diesen Geräte-Stand online verwenden** wählen. Der erste
   Upload erfolgt ausschließlich nach dieser Auswahl.
4. Auf dem anderen Gerät mit demselben Konto anmelden. **Online-Stand
   übernehmen** wählen, um den gewählten Plan dort zu verwenden.

Danach werden lokal gespeicherte Datenänderungen automatisch online gesichert,
solange das Gerät mit einer bekannten Online-Version verbunden ist. Eine neue
Online-Version wird beim Öffnen des Bereichs, beim Wiederkommen in die App und
beim Wiederverbinden geprüft. Abweichende Geräte-Stände werden bewusst
ausgewählt; es gibt keinen unbemerkten Last-Writer-Wins-Merge. Navigation und
Ansichtswechsel erzeugen keine neuen Cloud-Versionen.

## Supabase-Konfiguration

- Projekt: `zrosdhfxnwolxemqqvok` (vom Nutzer dem Wochenplan zugeordnet).
- Schema: `supabase/wochenplan-schema.sql`, auf diesem Projekt angewandt.
- Auth → URL Configuration: Site URL und erlaubte Redirect URL auf
  `https://winterkuersche.github.io/wochenplan-pwa/` setzen. Für Vorschauseiten
  deren genaue URL separat freigeben. Die Konfiguration ist für Bestätigungs-
  und Passwort-Mails nötig und wurde nicht über das MCP geändert.
- Der Schlüssel in `cloud-config.js` ist ein absichtlich öffentlicher
  **Publishable Key**. Es gibt keinen Secret-/Service-Role-Key im Frontend.
- Tabellenzugriff erfordert Authentifizierung und eine RLS-Besitzprüfung über
  `auth.uid()`. UPDATE prüft zusätzlich die erwartete Revision. INSERT benutzt
  keinen Upsert und kann daher einen gleichzeitig angelegten Plan nicht ersetzen.
- Jede erfolgreiche Datenrevision erzeugt einen privaten Verlaufseintrag.
  Dieser Verlauf wird ausschließlich durch den Datenbank-Trigger geschrieben;
  Browser-Clients dürfen frühere Stände lesen, aber nicht löschen oder fälschen.
  Aufbewahrt werden die zehn neuesten Revisionen und die erste Revision der
  letzten dreißig UTC-Kalendertage, an denen gespeichert wurde. Das ist ein
  Anwendungsverlauf in derselben Datenbank, kein separates Provider-Backup.

Die Datenbank enthält nach der Einrichtung keine automatisch hochgeladenen
Nutzerdaten. Die Konto-Erstellung und die erste Planauswahl erfolgen in der App.

## Lokale Speicherung und Import

Ein Write-Ahead-Journal schützt mehrteilige lokale Schreibvorgänge. Bei einem
Fehler werden alle betroffenen Originalwerte wiederhergestellt. Ein während
des Schreibens abgebrochener Vorgang wird beim nächsten Start zurückgerollt.
Der vorherige Datenstand bleibt über den Datenbereich wiederherstellbar;
reine Ansichtswechsel verdrängen diesen Rückweg nicht.

Fehlende Teilbestände, nicht lesbares JSON und beim Laden verworfene Einträge
halten das automatische Speichern an. Ein zweiter veralteter Tab kann keine
neuere Planung überschreiben. Sein noch offener Entwurf kann separat exportiert
werden. Der Rohdatenexport enthält die originalen Speicherwerte und ältere
Plan-Schlüssel, aber keine Supabase-Anmeldetokens.

Sicherungsformat 2 erhält Umsätze und MEP-Kalibrierung; Format 1 und bestehende
Legacy-Aliase bleiben importierbar. Der Import zeigt Datum, Schichtzahl und
Zeitraum vor dem Ersetzen an. Würden bei der Normalisierung Einträge verloren
gehen, bricht er ab. Dateiexporte schützen zusätzlich vor dem Verlust des
gesamten lokalen Browserspeichers.

## Prüfung

```sh
npm ci --ignore-scripts
npm run check:all
npm run vendor:supabase
git diff --exit-code -- vendor/
npx playwright install chromium
npm run test:browser
```

Alternativ kann `BROWSER_EXECUTABLE` einen bereits installierten Chromium
auswählen. Der Browser-Smoke verwendet ausschließlich synthetische Daten und
blockiert sämtliche externen HTTPS-Aufrufe. Er prüft Import/Export/Reload,
Umsätze/Kalibrierung/Theme, lokalen Rückweg, defekte Daten und das Exportieren
eines Entwurfs aus einem veralteten Tab bei mobiler und Desktop-Breite.
Ein weiterer Browser-Smoke prüft mit dem echten Supabase-Browser-SDK und einer
vollständig abgefangenen HTTP-Test-API den ersten Upload, die Übernahme auf
einem zweiten Gerät, automatische Sicherung und konkurrierende Versionen.

`supabase/verify-access.sql` prüft Kontotrennung, anonymen Zugriff,
Payload-Validierung, konkurrierende Revisionen und Verlauf-Aufbewahrung in einer
zurückgerollten Transaktion. Keine Testkonten oder Testpläne bleiben bestehen.

Chromium bei iPhone-Breite ersetzt keinen echten iOS-Safari-/Home-Screen-Test.
Der erste echte Konto-Login, E-Mail-Bestätigung und Gerätewechsel sind nach
Konfiguration der Auth-URL und Veröffentlichung auf dem iPhone zu prüfen.
