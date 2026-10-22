// Visible month/week controls, isolated synthetic fixtures, no external services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

const fixture = { backupVersion: 2, storage: {
  wochenplan_master_v10: { employees: [
    { id: 'a', name: 'Test Alpha', roleKey: 'TZ20', target: '20:00', totalVacationDays: 30 },
    { id: 'b', name: 'Test Beta', roleKey: 'TZ20', target: '20:00' }
  ] },
  wochenplan_plan_v10: { weekFrom: '2026-10-19', weekTo: '2026-10-25',
    schedule: { '2026-10-20': { b: { type: 'shift', code: 'F4', start: '09:00', end: '13:00', pause: 0, minutes: 240 } } },
    absences: [], salesByDate: { '2026-10-20': 500 }, monthlyPlanBaselines: {} },
  wochenplan_ui_v10: { currentView: 'month', teamCollapsed: true }
} };

async function run(context, url, width) {
  await context.route('**/*', route => route.request().url().startsWith(url + '/') ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  let acceptDeletion = true;
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.type() === 'confirm' && !acceptDeletion ? dialog.dismiss() : dialog.accept());
  await page.clock.setFixedTime(new Date('2026-10-01T08:00:00Z'));
  const ready = () => page.waitForFunction(() => window.__APP_BOOT_OK__ === true);
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('wochenplan_plan_v10')));
  const cell = day => page.locator(`#monthView .monthCellClickable[data-emp-id="a"][data-iso="2026-10-${day}"]`);
  async function reset() {
    await page.goto(url); await ready();
    await page.locator('#btnDataPanel').click();
    await Promise.all([page.waitForEvent('load'), page.locator('#backupFileInput').setInputFiles({
      name: 'synthetic-month.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture))
    })]);
    await ready();
    await page.locator('#btnViewMonth').click();
  }
  async function reload() {
    await page.reload(); await ready();
    await page.locator('#btnViewMonth').click();
  }
  async function intervals(expected) {
    await page.waitForFunction(expected => {
      const plan = JSON.parse(localStorage.getItem('wochenplan_plan_v10'));
      const actual = plan.absences.filter(a => a.employeeId === 'a')
        .map(a => [a.type, a.from, a.to]).sort((a, b) => a[1].localeCompare(b[1]));
      return JSON.stringify(actual) === JSON.stringify(expected);
    }, expected);
    const plan = await read();
    assert.equal(plan.salesByDate['2026-10-20'], 500);
    assert.equal(plan.schedule['2026-10-20'].b.code, 'F4');
  }
  async function saveMonthRange(from, to) {
    await page.locator('#shiftDialogAbsenceFrom').fill(`2026-10-${from}`);
    await page.locator('#shiftDialogAbsenceTo').fill(`2026-10-${to}`);
    await page.locator('#shiftDialogSave').click();
  }
  async function openWeekDay(day) {
    await page.locator('#btnViewWeek').click();
    await page.locator('#weeks button').filter({ hasText: '19.10' }).click();
    await page.locator(`.cell[data-eid="a"][data-day="2026-10-${day}"]`).click();
  }

  await reset();
  await cell('20').click();
  await page.locator('#monthFallbackOptions').getByRole('button', { name: 'Früh', exact: true }).click();
  await page.locator('#monthFallbackOptions').getByRole('button', { name: 'F5', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('wochenplan_plan_v10')).schedule['2026-10-20']?.a?.code === 'F5');
  await reload();
  assert.equal((await read()).schedule['2026-10-20'].a.minutes, 300);
  assert.equal(await page.evaluate(() => getResolvedEntryForEmployeeOnIso(state.employees[0], '2026-10-20').minutesForMonth), 300);
  await cell('20').click();
  await page.locator('#monthFallbackOptions').getByRole('button', { name: 'Frei', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('wochenplan_plan_v10')).schedule['2026-10-20']?.a?.type === 'off');
  await reload();
  assert.equal((await read()).schedule['2026-10-20'].a.type, 'off');

  for (const [code, type] of [['U', 'vacation'], ['K', 'sick']]) {
    await reset();
    await cell('19').click();
    if (code === 'K') await page.locator('#monthFallbackOptions').getByRole('button', { name: 'Mehr', exact: true }).click();
    await page.locator('#monthFallbackOptions').getByRole('button', { name: code === 'U' ? 'Urlaub' : 'K', exact: true }).click();
    await saveMonthRange('19', '23');
    await intervals([[type, '2026-10-19', '2026-10-23']]); await reload();

    // Shorten both boundaries through the existing month-cell editor.
    await cell('21').click(); await saveMonthRange('20', '22');
    await intervals([[type, '2026-10-20', '2026-10-22']]); await reload();
    assert.equal(await page.evaluate(() => getResolvedEntryForEmployeeOnIso(state.employees[0], '2026-10-19').status), 'empty');
    if (type === 'vacation') {
      assert.equal(await page.evaluate(() => state.employees[0].usedVacationDays), 3);
      assert.equal((await read()).schedule['2026-10-19']?.a, undefined);
    }

    // The weekly editor must share the same replacement semantics.
    await openWeekDay('21');
    await page.locator('#editAbsenceFrom').fill('2026-10-21');
    await page.locator('#editAbsenceTo').fill('2026-10-22');
    await page.locator('#saveCustom').click();
    await intervals([[type, '2026-10-21', '2026-10-22']]);
    assert.equal((await read()).schedule['2026-10-20']?.a, undefined); await reload();

    await cell('21').click(); await saveMonthRange('19', '24');
    await intervals([[type, '2026-10-19', '2026-10-24']]); await reload();

    // Removing only Wednesday preserves the two remaining intervals after reload.
    await openWeekDay('21'); await page.locator('#deleteEntry').click();
    await intervals([[type, '2026-10-19', '2026-10-20'], [type, '2026-10-22', '2026-10-24']]); await reload();
    assert.equal((await read()).schedule['2026-10-21']?.a, undefined);

    // The established delete dialog distinguishes whole interval from trim.
    await cell('20').click(); acceptDeletion = false;
    await page.locator('#shiftDialogDelete').click(); acceptDeletion = true;
    await intervals([[type, '2026-10-19', '2026-10-19'], [type, '2026-10-22', '2026-10-24']]); await reload();
    await cell('19').click(); await page.locator('#shiftDialogDelete').click();
    await intervals([[type, '2026-10-22', '2026-10-24']]); await reload();

    // Switching the status works in both directions and retains selected dates.
    const replacement = type === 'sick' ? 'vacation' : 'sick';
    await cell('23').click(); await page.locator('#shiftDialogAbsenceType').selectOption(replacement);
    await page.locator('#shiftDialogSave').click();
    await intervals([[replacement, '2026-10-22', '2026-10-24']]); await reload();
    await cell('23').click(); await page.locator('#shiftDialogDelete').click();
    await intervals([]); await reload();
    assert.equal((await read()).schedule['2026-10-23']?.a, undefined);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log(`Month input smoke passed (${width}px): shift/status, hours, vacation/sick shortening, extending, splitting, trimming, deletion, status changes, reload and unrelated-data preservation.`);
}

async function main() {
  const root = process.cwd();
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + (req.url.split('?')[0] === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0])));
    if (!file.startsWith(root + path.sep) || file.includes('/node_modules/') || file.includes('/.git/')) return res.writeHead(403).end();
    fs.readFile(file, (error, body) => {
      if (error) return res.writeHead(404).end();
      const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.webmanifest': 'application/manifest+json' };
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(body);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const engine = process.env.BROWSER_ENGINE === 'webkit' ? webkit : chromium;
    browser = await engine.launch({ executablePath: process.env.BROWSER_EXECUTABLE || undefined, args: engine === chromium ? ['--no-sandbox'] : [] });
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      try { await run(context, `http://127.0.0.1:${server.address().port}`, width); }
      finally { await context.close(); }
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
