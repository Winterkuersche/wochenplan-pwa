# V9.9 bis V9.9.2: gemeinsame Filialplanung und Speicher-Korrekturen

## Aktueller Status

V9.9 wurde am 21. Oktober 2026 mit PR #419 in `main` übernommen und über
GitHub Pages veröffentlicht. Persönlicher Login, E-Mail-Bestätigung, erster
Online-Upload und die bewusste Übernahme in die Home-Bildschirm-App wurden mit
Stephan geprüft. Die reale Bedienung der gemeinsamen Filiale mit der SV bleibt
als gesonderter Praxistest offen.

V9.9.1 wurde über PR #423 übernommen. Sie prüft nach der asynchronen
Prüfsummenberechnung nochmals den Konto-/Filialkontext, bevor ein Entwurf zum
Server gesendet wird. Ein Regressionstest verzögert Web Crypto, wechselt Konto
und Filiale und verlangt null Schreibaufrufe des alten Entwurfs.

Die Tests für den veröffentlichten Funktionsstand V9.9 sind erfolgreich: 516
Node-Tests sowie Chromium-/WebKit-Browserabläufe. Die veröffentlichte Seite
wurde zusätzlich in einem frischen mobilen Chromium-Kontext geöffnet:
V9.9 und Filialmodule geladen, Dialog dreimal vollständig geschlossen,
kein horizontaler Überlauf und keine JavaScript-Laufzeitfehler. Diese Prüfung
verwendet keine Anmeldung und schreibt keine Produktionsdaten.

## Enthaltene Abläufe

- Persönliches Konto bleibt bestehen; eine Filiale wird bewusst aus dem Geräte-Stand angelegt.
- Filialmitglieder haben eigene Konten und Anzeigenamen. Einmalige Einladungen gelten sieben Tage und können widerrufen werden.
- Grundrecht ist Lesen. Lokale Eingaben ohne aktuelle Bearbeitungsfreigabe sind Entwürfe und können als Vorschlag eingereicht werden.
- TL erteilt Vertretung für ganze Berliner Kalendertage. Das Enddatum ist eingeschlossen; Sommer-/Winterzeit wird berücksichtigt. Eine Freigabe dauert höchstens 180 Tage.
- Wochenfreigaben sind ein separates, standardmäßig ausgeschaltetes Zusatzrecht für die Vertretung.
- Rechteentzug gilt beim nächsten Serverzugriff, auch bei einer bereits geöffneten App. Eine bereits gelesene lokale Kopie wird dadurch nicht aus einem offline befindlichen Gerät gelöscht.
- Erteilt TL keine Freigabe, entsteht auch bei spontaner Abwesenheit kein zusätzliches Recht. Eine andere Notfallregel muss ausdrücklich vereinbart werden.
- Planänderungen, Vorschläge, Freigaben und Rücknahmen werden serverseitig der handelnden Person zugeordnet.
- Rücknahmen vergleichen die betroffenen Werte mit dem erwarteten Nachher-Stand und brechen bei späteren Überschneidungen ab.
- Das bewusste Ersetzen eines abweichenden Filialplans zeigt vorher die Änderungen; Bestätigung ist an die verglichene Revision und den lokalen Entwurf gebunden.
- Ein Wochenstand wird mit Name/Zeitpunkt freigegeben; spätere Änderungen der Woche oder gemeinsamer Teamdaten werden kenntlich gemacht.

## Module und Kompatibilität

`collaboration.js` enthält den zustandsbasierten Filialabgleich;
`collaboration-panel.js` die Darstellung und Bedienung. Sicherungsserialisierung
und Download wurden nach `backup-io.js` ausgelagert. `data-panel.js` verbindet
die vorhandene Planung mit persönlichem oder gemeinsamem Online-Kontext.
Die Planungsberechnung wurde nicht geändert.

Das v10-Speicherformat und normale Sicherungsimporte bleiben bestehen. Gemeinsame
Pläne enthalten keine persönlichen Ansichts-/Theme-Einstellungen; ein leeres
UI-Objekt hält den Standard-Sicherungsumschlag kompatibel. Der Filialexport kann
über den normalen Sicherungsimport als Plan wiederhergestellt werden. Sein
zusätzlicher Verlauf bleibt als Dokumentation in der Exportdatei; er wird nicht
als vermeintlich authentische neue Server-Historie importiert.

Persönlicher und gemeinsamer Online-Abgleich schreiben nie parallel aus demselben
Editor. Beim Kontextwechsel wird die alte persönliche Verknüpfung entkoppelt;
der lokale Stand wird erst nach ausdrücklicher Auswahl ersetzt.

## Datenbank und Zugriffsmodell

Die additive Struktur wurde im freigegebenen Supabase-Projekt eingerichtet;
die bisherigen `wochenplan_documents` und `wochenplan_history` bleiben erhalten.
`supabase/collaboration-schema.sql` beschreibt eine vollständige Neuinstallation.
Bereits angewandte Migrationen:

- `wochenplan_shared_branch_permissions_and_audit`
- `wochenplan_private_tables_explicit_deny`
- `wochenplan_preview_and_payload_validation`

Tabellen liegen im nicht für REST vorgesehenen Schema `wochenplan_private`,
haben RLS und explizite Sperrpolicies sowie keine Client-Tabellenrechte.
Der öffentliche Einstieg `wochenplan_collaboration` ist SECURITY INVOKER.
Die private SECURITY DEFINER-Implementierung ist nötig, um autorisierte
Planänderung, Revision, Sicherung und Ereignis atomar zu schreiben, ohne
Clients ein direktes Schreibrecht auf den Verlauf zu geben. Sie verwendet
leeren `search_path`, vollqualifizierte Tabellen und `auth.uid()` sowie
Mitgliedschafts-/TL-/Vertretungsprüfung für jede Aktion. Anzeigenamen und
`user_metadata` erteilen keine Rechte. Einladungen werden als SHA-256-Hash
gespeichert und unter Zeilensperre einmalig angenommen.

Eine Filialsperre serialisiert Rechteänderungen und Schreibvorgänge; zusätzlich
ist eine erwartete Planrevision erforderlich. Die Serverzeit wird nach Erwerb
der Sperre neu bestimmt. Das schützt auch Freigaben, die während einer Wartezeit
ablaufen. Die Events sind für normale Konten weder direkt schreib- noch löschbar.

Aufbewahrung: benannte Ausgangs-/Vertretungs-/manuelle Sicherungen bleiben erhalten.
Von automatischen Voränderungsständen bleiben die zehn neuesten plus der erste
Stand der letzten dreißig UTC-Tage mit Änderungen. Der personenbezogene Verlauf
wird davon getrennt derzeit ohne automatische Löschung aufbewahrt; ein fachliches
Löschkonzept ist vor einer größeren Nutzung festzulegen.

## Prüfung

```sh
npm ci --ignore-scripts
npm run check:all
npm run check:maintenance
npx playwright install --with-deps chromium webkit
npm run test:browser
BROWSER_ENGINE=webkit npm run test:browser
```

`tests/collaboration-database.test.js` verwendet echtes PostgreSQL über PGlite
in einer lokalen, kurzlebigen Datenbank, mit nachgebildetem Auth-Schema und
echten Rollen. Es prüft Mitgliedschaft, verbotene Direktzugriffe, Einladungen,
Rechteablauf/Entzug, veraltete Revisionen, kollidierende Vorschläge, unveränderliche
Zuordnung, Wochenfreigabe, Rücknahme und Sicherungsaufbewahrung.

Der zusätzliche Browserablauf benutzt das echte Browser-SDK, zwei getrennte
Browser-Kontexte und diese lokale Datenbank. Externe HTTPS-Aufrufe sind blockiert;
Auth-Anmeldung wird ausschließlich mit synthetischen Identitäten simuliert.
Der unabhängige Filialexport wird heruntergeladen, validiert und wieder importiert.

`supabase/verify-collaboration.sql` prüft die tatsächlich gehosteten Auth-/RPC-
Rollen mit synthetischen Konten in einer zurückgerollten Transaktion. Es werden
keine echten Einladungen oder E-Mails verschickt und keine Testkonten behalten.
Der Hosted-Test und die Sicherheitsprüfung wurden nach Einrichtung ausgeführt.

Chromium wurde lokal geprüft. Der lokale WebKit-Download war nicht verfügbar;
Chromium und WebKit wurden anschließend in der GitHub-Matrix erfolgreich geprüft.
Ein bestandener WebKit-Lauf ersetzt den realen iPhone-Test nicht.

## Wartung und Grenzen

Die GitHub-Workflows ergänzen Browserprüfungen auf Änderungen sowie einen
manuellen und wöchentlichen Wartungslauf. Der Bericht gehört zum jeweiligen Commit.
Dependabot schlägt Paket- und Action-Updates vor. Eine neue Supabase-SDK-Version
erfordert weiterhin die bewusste Erneuerung des lokalen Bundles und des Caches;
die Reproduzierbarkeitsprüfung verhindert ein unbemerktes Auseinanderlaufen.

Die Wartungsprüfung meldet Syntax-/Asset-Versionsfehler als Fehler. Ähnliche
Codeblöcke und nicht direkt referenzierte Skripte sind Hinweise zur Bewertung.
Aktueller Hinweis: `planning2.js` wird in keinem HTML direkt referenziert; vor
Entfernung müssen die vorhandenen Vorschau-/Transferwege geprüft werden.

`docs/maintenance-reviewer.md` enthält den begrenzten Auftrag für die zusätzliche
KI-Prüfung. Zwei ChatGPT-Aufgaben wurden eingerichtet: ein GitHub-Auslöser für
neue prüfbereite PRs/Commits und eine Wartungsprüfung montags morgens in
Europe/Berlin. Sie verwenden die bestehende GitHub-Verbindung, lesen Quellcode
und berichten in ChatGPT. Es wird kein externer Modell-API-Zugang eingerichtet.
Die Grenzen sind Auftragsvorgaben, kein finanzielles API-Ausgabenlimit.
Der erste Probelauf lieferte keinen lesbaren Bericht und wurde nicht als Erfolg
gewertet. Nach präzisierter Ausgabevorgabe lieferte der zweite Lauf einen
vollständigen Bericht mit geprüftem Commit, tatsächlichen CI-Ergebnissen und
zwei anhand synthetischer Daten reproduzierten Offline-Fehlern. Er erkannte auch,
dass `main` während seiner Analyse weitergerückt war, und begrenzte seine Aussage
auf den tatsächlich gelesenen Stand.

## Korrekturen in V9.9.2

- Nach fehlgeschlagenem Offline-Speichern wird ein Filialentwurf beim nächsten
  erfolgreichen Abgleich erneut eingeplant, wenn die Serverbasis unverändert
  und die aktuelle Bearbeitung erlaubt ist. Fremde neue Revisionen führen weiter
  zum Vergleich; abgelaufene Rechte belassen den Entwurf ohne automatischen Upload.
- HTTP-Fehlerantworten überschreiben keine funktionierenden Offline-Dateien.
  Erfolgreiche Cache-Schreibvorgänge werden an die Ereignislaufzeit gebunden;
  ein Cache-/Quota-Fehler verwirft keine erfolgreiche Netzwerkantwort.
- Fünf Regressionstests ergänzen Wiederverbindung, Revisions-/Rechtegrenzen,
  „HTTP 503, danach offline“ und fehlgeschlagenes Cache-Schreiben.
- App-/Asset-Version und Offline-Cache werden zusammen erhöht.

`Published app check` prüft nach einer erfolgreichen Pages-Veröffentlichung
die tatsächlich ausgelieferten Assets in einem anonymen mobilen Browser.
Der Checkout ist an den veröffentlichten Commit gebunden. Externe Anfragen und
Schreibzugriffe sind blockiert; es werden keine persönlichen Pläne verwendet.

## Offene gemeinsame Abnahme und Einrichtung

- [x] Aktuelle Sicherung und gewünschter Ausgangsstand mit Stephan festgelegt.
- [x] Echter persönlicher Konto-Login, E-Mail-Bestätigung, erster Upload und Übernahme in die Home-Bildschirm-App.
- [ ] Passwort-Wiederherstellung mit Stephan praktisch prüfen.
- [ ] TL/SV-Bedienung und Darstellung auf iPhone in Safari und Home-Bildschirm-App.
- [ ] Gewünschtes separates Google-Konto verbinden; automatischen Export dort einrichten und Wiederherstellung testen. Die bisherige Shop-Verbindung wird dafür nicht verwendet.
- [x] Zusätzliche KI-Prüfung über verbundene ChatGPT-Aufgaben begrenzt einrichten.
- [x] Ersten lesbaren KI-Prüfbericht kontrollieren; beide reproduzierten Offline-Befunde in V9.9.2 mit Regressionstests bearbeiten. Der separate Kontowechsel-Befund wurde in V9.9.1 korrigiert.
- [x] V9.9 nach geprüftem persönlichem Anmelde-/Übernahmetest und ausdrücklichem Veröffentlichungsauftrag übernehmen und veröffentlichen; TL/SV-Praxistest bleibt offen.

## Rückweg

Vor Veröffentlichung eine aktuelle Dateisicherung aufbewahren. Bei einem Fehler
die Codeänderung per Revert-Commit zurücknehmen; V9.8.1 basiert auf
`6b11fe940be878dc1b39d198d5e60c446cbe1eb2`. Den Service-Worker-Cache dabei auf eine
neue Kennung setzen. Die zusätzlichen Datenbanktabellen bleiben bestehen;
keine Rückabwicklung darf gemeinsame Pläne oder den Verlauf löschen.
Ein Filialarchiv kann in einer getrennten Testinstanz als normale Planung
importiert werden. Ältere App-Versionen unterstützen die neuen Filialrechte
nicht; bis zur Fehlerbehebung keine parallele gemeinsame Bearbeitung vornehmen.

Lokale Tab-Grenze: Der synchrone localStorage-Schutz erkennt einen veralteten
Editor, sobald die Änderung im zweiten Browserprozess sichtbar ist. Er ist keine
atomare Datenbanktransaktion zwischen zwei exakt gleichzeitig offline schreibenden
Tabs. Die gemeinsame Online-Planung schützt solche Schreibkonflikte mit der
serverseitigen Revision. Der Browser-Test wartet deshalb ausdrücklich auf die
Sichtbarkeit der neueren lokalen Speicherung, bevor er den alten Editor prüft.
