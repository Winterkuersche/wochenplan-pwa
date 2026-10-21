# Historischer Release-Gate-Abgleich – Sprint 2

Ursprünglicher Prüfstand: 29. März 2026. Abgeglichen am 21. Oktober 2026
mit V9.9.3 (`a44677fe6d922af168cd38ddab3eb05fa6a47ff4`).

Der damalige Bericht mit 40 Tests beschrieb die damalige Version. Seine Aussage
„NO-GO“, die deaktivierte Service-Worker-Registrierung, fehlende Precache-Assets
und fehlende Browser-Automatisierung gelten nicht als aktueller Projektstatus.

| Damaliger offener Punkt | Heutiger Nachweis / verbleibende Aufgabe |
| --- | --- |
| Kein Browser-E2E-Tooling | Playwright prüft Daten-/Online-/Filialabläufe in Chromium und WebKit; `.github/workflows/tests.yml`. |
| Kein Backup-UI-Roundtrip | Import/Export/Reload und lokaler Rückweg sind in `tools/browser-data-smoke.js` geprüft. |
| Service Worker deaktiviert | Registrierung ist in `index.html` aktiv; ein echter Offline-/Update-Browserlauf bleibt offen. |
| Lokale Skripte im Precache unvollständig | `tools/check-sw-precache-assets.js` bestätigt die 41 lokalen HTML-Assets. |
| Kein eigener Normalisierungsnachweis | `tests/individual-shift.test.js` prüft die Normalisierung individueller Schichten. |
| Monats- und Abwesenheitsbedienung manuell prüfen | Die noch nicht belegten Bedienwege bleiben in der aktuellen Checkliste offen. |

Es wird hier keine neue pauschale Freigabe erteilt. Der neue Wochenplaner besitzt
einen gesonderten offenen Speicherweg, den der frühere Sprintbericht nicht
abgedeckt hat. Aktueller Befund, Testgrenzen und Abnahmepunkte stehen ausschließlich
in [stability-checklist.md](stability-checklist.md). Die ausführbaren Abläufe
stehen in [manual-smoke-checks.md](manual-smoke-checks.md).
