# V9.9: gemeinsame Filialplanung – Umsetzung und Abnahme

## Aktueller Status

Technische Umsetzung im Entwicklungszweig `codex/shared-filial-planning`.
V9.8.1 bleibt die veröffentlichte Version bis zur Abnahme.
Der persönliche Login mit Stephan und der reale iPhone-Test sind noch offen.

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

`docs/maintenance-reviewer.md` ist der begrenzte Auftrag für eine zusätzliche
KI-Prüfung. Ein eigener, automatisch gestarteter KI-Lauf ist noch nicht aktiviert:
Dafür fehlen die Auswahl einer ausführenden Agentenumgebung und deren Zugang.
Normale Prüfungen benötigen diesen KI-Zugang nicht.

## Offene gemeinsame Abnahme und Einrichtung

- [ ] Aktuelle Sicherung vom iPhone mit vollständigem Plan herunterladen.
- [ ] Echter persönlicher Konto-Login, E-Mail-Bestätigung, Passwort-Wiederherstellung und Gerätewechsel.
- [ ] TL/SV-Bedienung und Darstellung auf iPhone in Safari und Home-Bildschirm-App.
- [ ] Externes Sicherungsziel und Turnus auswählen; automatischen Export dort einrichten und Wiederherstellung testen.
- [ ] Optionalen eigenen KI-Prüflauf auswählen und begrenzt einrichten.
- [ ] Nach bestandener Abnahme die vorbereitete Version veröffentlichen.

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
