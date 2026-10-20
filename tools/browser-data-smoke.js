/* Browser round-trip with synthetic data only. Run npm run test:browser after
 * installing Chromium; BROWSER_EXECUTABLE can select another Chromium binary. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const fixture = { backupVersion: 2, createdAt: '2026-10-20T10:00:00.000Z', storage: {
  wochenplan_master_v10: { employees: [{ id: 'test-one', name: 'Testperson', roleKey: 'TZ20', target: '20:00' }] },
  wochenplan_plan_v10: { weekFrom: '2026-10-19', weekTo: '2026-10-25', schedule: {
    '2026-10-19': { 'test-one': { type: 'shift', code: 'F4', start: '09:00', end: '13:00', pause: 0, minutes: 240 } },
    '2026-10-20': { 'test-one': { type: 'shift', code: 'F4', start: '09:00', end: '13:00', pause: 0, minutes: 240 } }
  }, absences: [], salesByDate: { '2026-10-20': 450 }, monthlyPlanBaselines: {} },
  wochenplan_ui_v10: { teamCollapsed: true, currentView: 'week', mepAnonymized: false },
  wochenplan_dark: 'false', 'mep-calibration': { x: 42 }
} };

async function main() {
  const root = process.cwd();
  const server = http.createServer((req, res) => {
    const relative = decodeURIComponent(req.url.split('?')[0]);
    const file = path.resolve(root, `.${relative === '/' ? '/index.html' : relative}`);
    if (!file.startsWith(`${root}${path.sep}`) || file.includes(`${path.sep}node_modules${path.sep}`) || file.includes(`${path.sep}.git${path.sep}`)) {
      res.writeHead(403).end(); return;
    }
    fs.readFile(file, (error, body) => {
      if (error) { res.writeHead(404).end(); return; }
      const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
      res.end(body);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || undefined, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    // Export/import must work with every external library and network offline.
    await context.route('https://**/*', (route) => route.abort());
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('dialog', (dialog) => dialog.accept());
    const url = `http://127.0.0.1:${server.address().port}/`;
    const ready = () => page.waitForFunction(() => window.__APP_BOOT_OK__ === true);
    await page.goto(url); await ready();
    await page.locator('#btnDataPanel').click();
    assert.equal(await page.locator('#dataDialog').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await Promise.all([
      page.waitForEvent('load'),
      page.locator('#backupFileInput').setInputFiles({ name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) })
    ]);
    await ready();
    assert.equal(await page.evaluate(() => getBackupSummary(collectFullBackupSnapshot()).shifts), 2);
    assert.equal(await page.evaluate(() => state.salesByDate['2026-10-20']), 450);
    assert.equal(await page.evaluate(() => localStorage.getItem('wochenplan_dark')), 'false');
    assert.equal(await page.evaluate(() => loadJson('mep-calibration', {}).x), 42);

    await page.locator('#btnDataPanel').click();
    const download = page.waitForEvent('download');
    await page.locator('#btnDataExport').click();
    const file = await download;
    const exported = JSON.parse(fs.readFileSync(await file.path(), 'utf8'));
    assert.equal(exported.storage.wochenplan_plan_v10.salesByDate['2026-10-20'], 450);
    assert.equal(exported.storage['mep-calibration'].x, 42);
    await page.locator('#btnCloseData').click();

    await page.evaluate(() => {
      state.schedule['2026-10-20']['test-one'] = buildEarlyShiftEntry('F5');
      if (!saveAppState()) throw Error('local save failed');
    });
    await page.reload(); await ready();
    assert.equal(await page.evaluate(() => state.schedule['2026-10-20']['test-one'].code), 'F5');
    await page.locator('#btnDataPanel').click();
    await page.locator('summary').filter({ hasText: 'Lokalen Stand wiederherstellen' }).click();
    await Promise.all([page.waitForEvent('load'), page.locator('#btnRestoreLocal').click()]);
    await ready();
    assert.equal(await page.evaluate(() => state.schedule['2026-10-20']['test-one'].code), 'F4');

    // Corrupted storage is displayed as a problem and never auto-saved over.
    await page.evaluate(() => localStorage.setItem('wochenplan_plan_v10', '{broken'));
    await page.reload(); await ready();
    assert.equal(await page.locator('#storageProblem').isVisible(), true);
    assert.equal(await page.evaluate(() => saveAppState()), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('wochenplan_plan_v10')), '{broken');
    await page.locator('#btnDataPanel').click();
    await page.locator('summary').filter({ hasText: 'Lokalen Stand wiederherstellen' }).click();
    const rawDownload = page.waitForEvent('download');
    await page.locator('#btnRawExport').click();
    const rawFile = await rawDownload;
    assert.equal(JSON.parse(fs.readFileSync(await rawFile.path(), 'utf8')).entries.wochenplan_plan_v10, '{broken');
    await Promise.all([
      page.waitForEvent('load'),
      page.locator('#backupFileInput').setInputFiles({ name: 'restore.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) })
    ]);
    await ready();
    assert.equal(await page.locator('#storageProblem').isVisible(), false);
    assert.equal(await page.evaluate(() => getBackupSummary(collectFullBackupSnapshot()).shifts), 2);

    // Desktop and touch-width data panels must both be usable.
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.locator('#btnDataPanel').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    // An old tab can export its own unsaved draft without replacing the newer
    // tab's stored data. This also exercises the real error banner and download.
    const second = await context.newPage();
    second.on('pageerror', (error) => runtimeErrors.push(error.message));
    second.on('dialog', (dialog) => dialog.accept());
    await second.goto(url); await second.waitForFunction(() => window.__APP_BOOT_OK__ === true);
    await page.evaluate(() => { state.schedule['2026-10-20']['test-one'] = buildEarlyShiftEntry('F5'); saveAppState(); });
    const staleSave = await second.evaluate(() => { state.schedule['2026-10-20']['test-one'] = buildEarlyShiftEntry('F6'); return saveAppState(); });
    assert.equal(staleSave, false);
    await second.locator('#btnDataPanel').click();
    const draftDownload = second.waitForEvent('download');
    await second.locator('#btnDataExport').click();
    const draftFile = await draftDownload;
    const draft = JSON.parse(fs.readFileSync(await draftFile.path(), 'utf8'));
    assert.equal(draft.storage.wochenplan_plan_v10.schedule['2026-10-20']['test-one'].code, 'F6');
    assert.equal(await second.evaluate(() => JSON.parse(localStorage.getItem('wochenplan_plan_v10')).schedule['2026-10-20']['test-one'].code), 'F5');
    assert.deepEqual(runtimeErrors, []);
    console.log('Browser smoke passed: mobile/desktop, import → export → reload, sales/calibration/theme, local restore, corrupt-data protection, raw rescue and stale-tab draft export.');
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
