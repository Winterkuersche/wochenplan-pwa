// Synthetic requests only; external services are blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const fixture = { backupVersion: 2, storage: {
  wochenplan_master_v10: { employees: Array.from({ length: 13 }, (_, index) => ({ id: 'p' + index, name: 'Person ' + index, roleKey: 'TZ20', target: '20:00', totalVacationDays: 30 })) },
  wochenplan_plan_v10: { weekFrom: '2026-10-19', weekTo: '2026-10-25', schedule: {
    '2026-10-20': { p0: { type: 'shift', code: 'F4', start: '09:00', end: '13:00', pause: 0, minutes: 240 } }
  }, absences: [], salesByDate: { '2026-10-20': 500 } }, wochenplan_ui_v10: { currentView: 'day', teamCollapsed: true }
} };
async function run(context, url, width, engine) {
  await context.route('**/*', route => route.request().url().startsWith(url + '/') ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.clock.setFixedTime(new Date('2026-10-24T08:00:00Z'));
  await page.goto(url);
  const ready = () => page.waitForFunction(() => window.__APP_BOOT_OK__ === true);
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('wochenplan_plan_v10')));
  await ready(); await page.locator('#btnDataPanel').click();
  await Promise.all([page.waitForEvent('load'), page.locator('#backupFileInput').setInputFiles({ name: 'synthetic-vacation.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) })]);
  await ready(); await page.locator('#btnViewDay').click();
  assert.equal(await page.locator('#vacationCalendarYear').inputValue(), '2027');
  assert.equal(await page.locator('#vacationRequestFrom').inputValue(), '2027-01-01');
  assert.equal(await page.locator('#vacationRequestTo').inputValue(), '2027-01-01');
  await page.locator('#vacationCalendarYear').fill('2026'); await page.locator('#vacationCalendarYear').blur();
  assert.equal(await page.locator('#vacationRequestFrom').inputValue(), '2026-01-01');
  assert.equal(await page.locator('#vacationRequestTo').inputValue(), '2026-01-01');
  await page.locator('#vacationCalendarYear').fill('2027'); await page.locator('#vacationCalendarYear').blur();
  await page.locator('#vacationRequestFrom').fill('2027-02-01');
  assert.equal(await page.locator('#vacationRequestTo').inputValue(), '2027-02-01');
  await page.locator('#vacationRequestTo').fill('2027-02-07');
  assert.match(await page.locator('#vacationRequestDayCount').innerText(), /6 Urlaubstage/);
  // Changing the view year must not silently overwrite an unsaved range.
  await page.locator('#vacationCalendarYear').fill('2028'); await page.locator('#vacationCalendarYear').blur();
  assert.equal(await page.locator('#vacationCalendarYear').inputValue(), '2027');
  assert.equal(await page.locator('#vacationRequestTo').inputValue(), '2027-02-07');
  await page.locator('#vacationRequestCancel').click();
  async function enter(person, from, to) {
    await page.locator('#vacationRequestEmployee').selectOption(person);
    await page.locator('#vacationRequestFrom').fill(from);
    await page.locator('#vacationRequestTo').fill(to);
    await page.locator('#vacationRequestSave').click();
    await page.waitForFunction(() => document.querySelector('#vacationCalendarMessage').textContent.startsWith('Urlaubswunsch gespeichert'));
  }
  await enter('p0', '2027-07-01', '2027-07-14');
  assert.match(await page.locator('#vacationCalendarRequests').innerText(), /12 Urlaubstage/);
  assert.match(await page.locator('#vacationCalendarTotals').innerText(), /Person 0: 12 Urlaubstage/);
  await enter('p0', '2027-03-25', '2027-03-29');
  assert.match(await page.locator('#vacationCalendarTotals').innerText(), /Person 0: 14 Urlaubstage/);
  assert.equal(await page.locator('.vacationPerson').count(), 1);
  assert.equal(await page.locator('.vacationPerson[open]').count(), 0);
  assert.match(await page.locator('.vacationPerson summary').innerText(), /2 Zeiträume.*14 Urlaubstage/);
  await page.locator('.vacationPerson summary').click();
  await page.locator('#vacationCalendarRequests').getByRole('button', { name: /^Löschen:.*25\.03/ }).click();
  assert.match(await page.locator('#vacationCalendarTotals').innerText(), /Person 0: 12 Urlaubstage/);
  const original = await read();
  assert.equal(original.vacationCalendar.requests.length, 1);
  assert.deepEqual(original.absences, []); assert.equal(original.schedule['2026-10-20'].p0.code, 'F4'); assert.equal(original.salesByDate['2026-10-20'], 500);
  await page.reload(); await ready(); await page.locator('#btnViewDay').click();
  assert.equal((await read()).vacationCalendar.requests.length, 1);
  await page.locator('.vacationPerson summary').click();
  await page.locator('#vacationCalendarRequests').getByRole('button', { name: /^Bearbeiten:/ }).first().click();
  assert.equal(await page.locator('#vacationRequestFrom').inputValue(), '2027-07-01');
  assert.equal(await page.locator('#vacationRequestTo').inputValue(), '2027-07-14');
  await page.locator('#vacationRequestTo').fill('2027-07-10'); await page.locator('#vacationRequestSave').click();
  assert.equal((await read()).vacationCalendar.requests[0].to, '2027-07-10');
  assert.match(await page.locator('#vacationCalendarTotals').innerText(), /Person 0: 9 Urlaubstage/);
  // Storage failure must preserve both the previous plan and typed request.
  await page.locator('#vacationRequestEmployee').selectOption('p1');
  await page.locator('#vacationRequestFrom').fill('2027-07-01'); await page.locator('#vacationRequestTo').fill('2027-07-14');
  await page.evaluate(() => { window.testWriteBatch = localDataStore.writeBatch; localDataStore.writeBatch = () => ({ ok: false, error: 'Synthetic storage failure' }); });
  await page.locator('#vacationRequestSave').click();
  assert.match(await page.locator('#vacationCalendarMessage').innerText(), /Synthetic storage failure/);
  assert.equal((await read()).vacationCalendar.requests.length, 1); assert.equal(await page.locator('#vacationRequestFrom').inputValue(), '2027-07-01');
  await page.evaluate(() => { localDataStore.writeBatch = window.testWriteBatch; delete window.testWriteBatch; });
  await page.locator('#vacationRequestSave').click();
  for (let index = 2; index < 13; index++) await enter('p' + index, '2027-07-01', '2027-07-14');
  assert.equal(await page.locator('.vacationCalendarSheet').count(), 7);
  // The ordinary week editor also has to preserve the separate annual wishes.
  await page.locator('#btnViewWeek').click();
  await page.locator('#weeks button').filter({ hasText: '19.10' }).click();
  await page.locator('.cell[data-eid="p0"][data-day="2026-10-20"]').click();
  await page.locator('.quickMenu summary').filter({ hasText: /^F$/ }).click();
  await page.locator('[data-quick="F5"]').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('wochenplan_plan_v10')).schedule['2026-10-20'].p0.code === 'F5');
  assert.equal((await read()).vacationCalendar.requests.length, 13);
  await page.locator('#btnViewDay').click();
  // Use the same output HTML as the user-facing print button, but suppress native UI.
  await page.evaluate(() => {
    window.open = () => ({ opener: null, document: { open() {}, write(html) { window.testPrintHtml = html; }, close() {} }, requestAnimationFrame(callback) { callback(); }, focus() {}, print() {} });
  });
  await page.locator('#vacationCalendarPrint').click();
  const html = await page.evaluate(() => window.testPrintHtml);
  assert.equal((html.match(/<section class="sheet">/g) || []).length, 7);
  assert.match(html, /Urlaubsplanung 2027/);
  const printPage = await context.newPage(); await printPage.setContent(html);
  await printPage.emulateMedia({ media: 'print' });
  for (const svg of await printPage.locator('.sheet svg').all()) {
    assert.ok(await svg.evaluate(node => [...node.querySelectorAll('text')].every(text => {
      const box = text.getBBox(); return box.x >= 0 && box.y >= 0 && box.x + box.width <= 842.5 && box.y + box.height <= 595.5;
    })), 'Every name/date must remain inside its A4 page');
    assert.ok(await svg.evaluate(node => [...node.querySelectorAll('[data-vacation-name]')].every(text => text.getBBox().x + text.getBBox().width <= Number(text.dataset.cellRight))), 'Names must remain inside their own day cell');
  }
  if (width === 1440 && engine === chromium) {
    fs.mkdirSync('test-results/vacation-calendar', { recursive: true });
    const file = 'test-results/vacation-calendar/annual-requests.pdf';
    const pdf = await printPage.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 7, 'Seven groups must print on exactly seven A4 pages');
    await page.locator('.vacationCalendarPanel').screenshot({ path: 'test-results/vacation-calendar/input-desktop.png' });
  }
  await printPage.emulateMedia({ media: 'screen' });
  assert.equal(await printPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Export preview fits the screen');
  await printPage.evaluate(() => { window.close = () => {}; }); // Exercise iOS-style close refusal.
  await Promise.all([printPage.waitForURL(url + '/'), printPage.locator('#returnToPlanner').click()]);
  await printPage.waitForFunction(() => window.__APP_BOOT_OK__ === true);
  assert.equal(await printPage.evaluate(() => JSON.parse(localStorage.getItem('wochenplan_plan_v10')).vacationCalendar.requests.length), 13);
  await printPage.close();
  // Pending form input must block automatic shared adoption, even after focus leaves it.
  await page.locator('#vacationRequestFrom').fill('2027-08-01');
  assert.equal(await page.evaluate(() => window.WochenplanVacationCalendarPanel.hasOpenDraft()), true);
  await page.locator('#vacationCalendarPrint').click();
  assert.match(await page.locator('#vacationCalendarMessage').innerText(), /zuerst speichern/);
  await page.locator('#vacationRequestCancel').click();
  await page.locator('#vacationCalendarExpand').click();
  assert.equal(await page.locator('.vacationPerson[open]').count(), 13);
  await page.locator('#vacationCalendarCollapse').click();
  assert.equal(await page.locator('.vacationPerson[open]').count(), 0);
  await page.locator('#vacationCalendarExpand').click();
  await page.locator('#vacationCalendarRequests').getByRole('button', { name: /^Löschen:/ }).first().click();
  assert.equal((await read()).vacationCalendar.requests.length, 12);
  await page.reload(); await ready(); await page.locator('#btnViewDay').click();
  assert.equal((await read()).vacationCalendar.requests.length, 12);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  // Distribution: preview is transient, uses direct U cells, and protects manual wishes.
  await page.locator('.vacationDistributionIntro > summary').click();
  await page.evaluate(() => {
    state.schedule['2027-01-04'] = { p0: { type: 'vacation', status: 'vacation', label: 'U' } };
    saveAppState();
  });
  const beforeDistribution = await read();
  await page.locator('#vacationDistributionOpen').click();
  assert.equal(await page.locator('.vacationDistributionChoice').count(), 1);
  assert.equal(await page.evaluate(() => window.WochenplanVacationCalendarPanel.hasOpenDraft()), true);
  await page.locator('.vacationDistributionChoice input[type="number"]').fill('12');
  await page.locator('#vacationDistributionGenerate').click();
  assert.match(await page.locator('[data-distribution-summary="p0"]').innerText(), /12 \/ 12 Tage \(1 vorhanden, 11 neu\)/);
  assert.deepEqual(await read(), beforeDistribution, 'Calculating a preview does not save or alter existing plans');
  const fromInput = page.locator('.vacationDistributionRow input[type="date"]').first();
  const originalFrom = await fromInput.inputValue();
  await fromInput.fill('2028-01-01');
  assert.equal(await page.locator('#vacationDistributionAdopt').isDisabled(), true);
  await fromInput.fill(originalFrom);
  assert.equal(await page.locator('#vacationDistributionAdopt').isDisabled(), false);
  await page.locator('#vacationCalendarYear').fill('2026'); await page.locator('#vacationCalendarYear').blur();
  assert.equal(await page.locator('#vacationCalendarYear').inputValue(), '2027');
  await page.evaluate(() => { state.employees[0].name = 'Changed during preview'; });
  await page.locator('#vacationDistributionAdopt').click();
  assert.match(await page.locator('#vacationDistributionMessage').innerText(), /inzwischen geändert/);
  assert.deepEqual(await read(), beforeDistribution);
  await page.evaluate(() => {
    state.employees[0].name = 'Person 0';
    window.testWriteBatch = localDataStore.writeBatch;
    localDataStore.writeBatch = () => ({ ok: false, error: 'Synthetic distribution failure' });
  });
  await page.locator('#vacationDistributionAdopt').click();
  assert.match(await page.locator('#vacationDistributionMessage').innerText(), /Synthetic distribution failure/);
  assert.deepEqual(await read(), beforeDistribution, 'Failed adoption preserves the saved calendar');
  assert.equal(await page.locator('#vacationDistribution').isVisible(), true);
  await page.evaluate(() => { localDataStore.writeBatch = window.testWriteBatch; delete window.testWriteBatch; });
  await page.locator('#vacationDistributionAdopt').click();
  assert.equal(await page.locator('#vacationDistribution').isVisible(), false);
  const afterDistribution = await read();
  assert.deepEqual(afterDistribution.vacationCalendar.requests.filter(item => item.employeeId !== 'p0'), beforeDistribution.vacationCalendar.requests);
  assert.deepEqual(afterDistribution.schedule, beforeDistribution.schedule); assert.deepEqual(afterDistribution.absences, beforeDistribution.absences);
  await page.locator('.vacationPerson[data-employee-id="p0"] summary').click();
  await page.locator('.vacationPerson[data-employee-id="p0"]').getByRole('button', { name: /^Bearbeiten:/ }).first().click();
  assert.equal(await page.locator('#vacationRequestFrom').inputValue(), originalFrom);
  await page.locator('#vacationRequestTo').fill(originalFrom); await page.locator('#vacationRequestSave').click();
  assert.equal((await read()).vacationCalendar.requests.find(item => item.employeeId === 'p0').to, originalFrom);
  await page.reload(); await ready(); await page.locator('#btnViewDay').click();
  await page.locator('.vacationDistributionIntro > summary').click(); await page.locator('#vacationDistributionOpen').click();
  assert.equal(await page.locator('.vacationDistributionChoice').count(), 0, 'Adopted and then manually edited wishes are protected on the next run');
  await page.locator('#vacationDistributionCancel').click();
  assert.deepEqual(errors, []);
  console.log(`Annual vacation calendar passed (${width}px): day counts, date picker year, CRUD, persistence, save failure, week edit, A4 pagination, print names, draft protection.`);
}
async function main() {
  const root = process.cwd();
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + (req.url.split('?')[0] === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0])));
    if (!file.startsWith(root + path.sep) || file.includes('/node_modules/') || file.includes('/.git/')) return res.writeHead(403).end();
    fs.readFile(file, (error, body) => {
      if (error) return res.writeHead(404).end();
      res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.webmanifest': 'application/manifest+json' })[path.extname(file)] || 'application/octet-stream'); res.end(body);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const engine = process.env.BROWSER_ENGINE === 'webkit' ? webkit : chromium;
  let browser;
  try {
    browser = await engine.launch({ executablePath: process.env.BROWSER_EXECUTABLE || undefined, args: engine === chromium ? ['--no-sandbox'] : [] });
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      try { await run(context, `http://127.0.0.1:${server.address().port}`, width, engine); } finally { await context.close(); }
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
