const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const api = require('../vacation-calendar');
const { loadScripts } = require('./test-helpers');
const request = (employeeId, from, to = from, extra = {}) => ({ id: employeeId + from, employeeId, employeeName: 'Name ' + employeeId, from, to, ...extra });
const data = requests => ({ ...api.emptyData(), requests });
const holidayContext = loadScripts(['holidays.js']);
const holidaysForYear = year => holidayContext.getHolidaysForStateYear('schleswig-holstein', year);

test('compact calendar names keep same first names distinct, including archived people', () => {
  const employees = [{ id: 'a', name: 'Brodersen, Ines' }, { id: 'b', name: 'Stephan Müller' }, { id: 'c', name: 'Lange, Bärbel' }];
  const value = data([request('a', '2027-02-01'), request('b', '2027-02-01'), request('c', '2027-02-01')]);
  const before = JSON.stringify(value);
  assert.deepEqual([...api.personLabels(value, employees).values()], ['Ines', 'Stephan', 'Bärbel']);
  let sheets = api.buildSheets(value, employees, 2027);
  assert.deepEqual(sheets.pages.flatMap(page => page.people.map(person => person.name)), ['Ines', 'Stephan', 'Bärbel']);
  value.requests.push(request('old', '2027-05-01', '2027-05-02', { employeeName: 'Anders, ines' }));
  const labels = api.personLabels(value, employees);
  assert.equal(labels.get('a'), 'Brodersen, Ines'); assert.equal(labels.get('old'), 'Anders, ines');
  value.printNames.a = 'I. Brodersen';
  sheets = api.buildSheets(value, employees, 2027);
  assert.equal(sheets.pages[0].people[0].name, 'I. Brodersen');
  value.requests.pop(); delete value.printNames.a;
  assert.equal(JSON.stringify(value), before);
});

test('requested days include Saturdays but exclude Sundays and SH public holidays', () => {
  const count = (from, to = from) => api.countVacationDays([request('a', from, to)], holidaysForYear);
  assert.equal(count('2027-02-01', '2027-02-06').days, 6); // Screenshot example.
  assert.equal(count('2027-02-01', '2027-02-07').days, 6);
  assert.equal(count('2027-05-01').days, 0); // Holiday on Saturday.
  assert.equal(count('2027-02-07').days, 0); // Sunday.
  assert.equal(count('2027-03-25', '2027-03-29').days, 2); // Good Friday + Easter Monday.
  assert.equal(count('2027-05-03', '2027-05-08').days, 5); // Ascension.
  assert.equal(count('2027-05-17', '2027-05-22').days, 5); // Whit Monday.
  const christmas = count('2027-12-24', '2027-12-26');
  assert.equal(christmas.days, 1); assert.equal(christmas.holidays, 1); assert.equal(christmas.sundays, 1);
  assert.equal(count('2027-10-31').days, 0); // Sunday + holiday deducted once.
  assert.equal(count('2027-07-05', '2027-07-10').days, 6); // School holidays still count.
});

test('annual totals clip cross-year ranges and count imported overlaps only once per person', () => {
  const requests = [request('a', '2026-12-28', '2027-01-03'), request('a', '2027-01-02', '2027-01-04'), request('b', '2027-01-02')];
  assert.equal(api.countVacationDays([requests[0]], holidaysForYear).days, 5);
  assert.equal(api.countVacationDays([requests[0]], holidaysForYear, 2027).days, 1);
  const totals = api.totalsByPerson(data(requests), [{ id: 'a', name: 'Current name' }], 2027, holidaysForYear);
  assert.deepEqual(totals.map(person => [person.name, person.days]), [['Current name', 2], ['Name b', 1]]);
  assert.equal(api.countVacationDays(requests, holidaysForYear, 2027).days, 3);
  assert.equal(api.countVacationDays([request('a', '2026-02-01')], holidaysForYear, 2027).days, 0);
  assert.throws(() => api.countVacationDays(requests, holidaysForYear, NaN), /Jahr/);
});

test('day counts survive DST and require holiday coverage before returning a number', () => {
  assert.equal(api.countVacationDays([request('a', '2027-03-27', '2027-03-30')], holidaysForYear).days, 2);
  assert.equal(api.countVacationDays([request('a', '2027-10-30', '2027-11-02')], holidaysForYear).days, 3);
  const missing = api.countVacationDays([request('a', '2027-12-30', '2028-01-03')], holidaysForYear);
  assert.equal(missing.days, null); assert.deepEqual(missing.missingYears, [2028]);
  assert.equal(api.countVacationDays([request('a', '2027-12-30', '2028-01-03')], holidaysForYear, 2027).days, 2);
  assert.throws(() => api.countVacationDays([request('a', '2027-02-29')], holidaysForYear), /gültige/);
  const leap = api.countVacationDays([request('a', '2028-02-28', '2028-03-01')], () => [{ date: '2028-01-01' }]);
  assert.equal(leap.days, 3);
});

test('strict dates, inclusive ranges, duplicates and overlaps cannot silently lose requests', () => {
  assert.match(api.validateRequest(request('a', '2027-02-29')), /gültige/);
  assert.equal(api.validateRequest(request('a', '2028-02-29')), '');
  assert.match(api.validateRequest(request('a', '2027-06-10', '2027-06-09')), /Enddatum/);
  let value = api.saveRequest(undefined, request('a', '2027-06-01', '2027-06-05'), 'A');
  assert.throws(() => api.saveRequest(value, request('a', '2027-06-05', '2027-06-08')), /überlappenden/);
  const before = JSON.stringify(value);
  const edited = api.saveRequest(value, { ...value.requests[0], to: '2027-06-03' }, 'Alpha');
  assert.equal(value.requests[0].to, '2027-06-05'); assert.equal(JSON.stringify(value), before);
  assert.equal(edited.requests.length, 1); assert.equal(edited.requests[0].to, '2027-06-03');
  assert.equal(edited.printNames.a, 'Alpha');
  assert.match(api.validateData(data([value.requests[0], value.requests[0]])), /doppelten/);
  assert.equal(api.validateData(undefined), ''); assert.notEqual(api.validateData(null), '');
});

test('12 month columns have real dates only, leap years and year-spanning requests', () => {
  assert.equal(api.datesForYear(2027).length, 365); assert.equal(api.datesForYear(2028).length, 366);
  assert.throws(() => api.datesForYear(NaN), /Jahr/);
  const value = data([request('a', '2026-12-29', '2027-01-03'), request('b', '2027-12-30', '2028-01-03')]);
  const sheets = api.buildSheets(value, [], 2027);
  assert.deepEqual([...sheets.pages[0].people[0].dates], ['2027-01-01', '2027-01-02', '2027-01-03']);
  assert.deepEqual([...sheets.pages[0].people[1].dates], ['2027-12-30', '2027-12-31']);
});

test('automatic pages fit every name at every date and keep each person on one sheet', () => {
  const employees = Array.from({ length: 13 }, (_, i) => ({ id: String(i), name: 'Person ' + i }));
  const value = data(employees.map(person => request(person.id, '2027-07-01', '2027-07-14')));
  const result = api.buildSheets(value, employees, 2027);
  assert.equal(result.pages.length, 5);
  assert.deepEqual(result.pages.flatMap(page => page.people.map(person => person.id)), employees.map(person => person.id));
  for (const page of result.pages) assert.ok([...page.used.values()].every(count => count <= 3));
  const dispersed = data(employees.map((person, i) => request(person.id, `2027-07-${String(i + 1).padStart(2, '0')}`)));
  assert.equal(api.buildSheets(dispersed, employees, 2027).pages.length, 1);
  // Very long labels must never be clipped or printed unreadably.
  employees[0].name = 'A'.repeat(100);
  assert.throws(() => api.buildSheets(value, employees, 2027), /Druckname/);
  value.printNames['0'] = 'Person 0'; assert.equal(api.buildSheets(value, employees, 2027).pages.length, 5);
  assert.equal(api.buildSheets(api.emptyData(), [], 2027).pages.length, 1);
});

test('printed dates include full names and weekends; special characters cannot inject markup', () => {
  const value = data([request('a', '2027-01-01', '2027-01-03', { employeeName: '<script> & A' })]);
  value.title = '<img onerror=evil()>';
  const html = api.printDocument(api.buildSheets(value, [], 2027), [{ date: '2027-01-01', name: 'Neujahr' }]);
  assert.doesNotMatch(html, /<img /); assert.equal((html.match(/<script>/g) || []).length, 1, "Only the fixed return-navigation script may execute"); assert.match(html, /&lt;script&gt;/); assert.match(html, /&lt;img/);
  assert.equal((html.match(/&lt;script&gt;/g) || []).length, 3);
  assert.match(html, /size:A4 landscape/); assert.match(html, /#f9bfd7/); assert.match(html, /#fff57b/);
  // Footer follows all 31 rows; bottom row never crosses the printable page.
  assert.ok(api.layout.y + api.layout.header + 31 * api.layout.row < 568);
});

test('backup validation preserves annual requests and rejects malformed imports before replacement', () => {
  const ctx = loadScripts(['vacation-calendar.js', 'backup-utils.js'], { MASTER_KEY: 'master', PLAN_KEY: 'plan', UI_KEY: 'ui' });
  const source = { storage: { master: { employees: [] }, plan: { schedule: {}, absences: [], vacationCalendar: data([request('a', '2027-06-01')]) }, ui: {} } };
  const result = ctx.validateAndNormalizeBackupData(source);
  assert.equal(result.error, ''); assert.deepEqual(JSON.parse(JSON.stringify(result.backup.storage.plan.vacationCalendar)), source.storage.plan.vacationCalendar);
  source.storage.plan.vacationCalendar.requests[0].to = '2027-02-30';
  assert.match(ctx.validateAndNormalizeBackupData(source).error, /Urlaubswünsche/);
});

test('ordinary plan saves, recovery and Planning 2 retain requests without changing approved absences', () => {
  const calendar = data([request('a', '2027-04-01')]);
  const ctx = { window: {}, state: { schedule: { '2027-04-01': { a: { code: 'F4' } } }, absences: [], vacationCalendar: calendar }, normalizeMonthlyPlanBaselines: value => value || {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('app-storage.js', 'utf8'), ctx);
  const plan = ctx.savePlanData({ snapshotOnly: true });
  assert.equal(plan.vacationCalendar, calendar); assert.equal(plan.schedule['2027-04-01'].a.code, 'F4'); assert.equal(plan.absences.length, 0);
  const { createPlanning2DataAdapter } = require('../planning2-data-adapter');
  const raw = new Map([['wochenplan_plan_v10', JSON.stringify(plan)]]);
  const adapter = createPlanning2DataAdapter({ getItem: key => raw.get(key), setItem: (key, value) => raw.set(key, value) });
  const edited = adapter.readPlan(); edited.schedule['2027-04-02'] = { a: { code: 'L3' } }; adapter.savePlan(edited);
  assert.deepEqual(adapter.readPlan().vacationCalendar, calendar);
});

test('2027 holidays are available for calendar and existing vacation calculations', () => {
  const ctx = loadScripts(['holidays.js']);
  const dates = ctx.getHolidaysForStateYear('schleswig-holstein', 2027).map(holiday => holiday.date);
  assert.equal(dates.length, 10);
  for (const iso of ['2027-03-26', '2027-03-29', '2027-05-06', '2027-05-17']) assert.ok(dates.includes(iso));
});

test('new backup and sync snapshots advertise calendar support without changing plan content', () => {
  const plan = { schedule: {}, absences: [] };
  const ctx = loadScripts(['backup-io.js'], {
    APP_META: { name: 'Wochenplan', version: 'V9.13.0' }, MASTER_KEY: 'master', PLAN_KEY: 'plan', UI_KEY: 'ui', BACKUP_MEP_CALIBRATION_KEY: 'calibration',
    loadJson: (_key, fallback) => fallback, saveMasterData: () => ({ employees: [] }), savePlanData: () => plan, uiState: {}
  });
  const snapshot = ctx.collectFullBackupSnapshot();
  assert.equal(snapshot.capabilities.vacationCalendar, true);
  assert.equal(snapshot.storage.plan, plan);
});

test('export has a mobile return path even when the print window cannot close', () => {
  const html = api.printDocument(api.buildSheets(undefined, [], 2027), [], 'https://example.test/planner/');
  assert.match(html, /Zurück zum Wochenplan/); assert.match(html, /name="viewport"/);
  assert.match(html, /@media screen\{\.sheet\{width:min\(297mm,100%\)/);
  assert.match(html, /@page\{size:A4 landscape/);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  let click, closed = false, destination;
  vm.runInNewContext(script, {
    document: { getElementById: () => ({ addEventListener: (event, listener) => { click = listener; } }) },
    window: { close: () => { closed = true; }, closed: false, location: { replace: url => { destination = url; } } },
    setTimeout: callback => callback()
  });
  click(); assert.equal(closed, true); assert.equal(destination, 'https://example.test/planner/');
  const escaped = api.printDocument(api.buildSheets(undefined, [], 2027), [], 'https://example.test/</script><script>bad()');
  assert.equal((escaped.match(/<script>/g) || []).length, 1);
});

test('person picker follows inclusive entry/exit years without mutating historical requests', () => {
  const people = [{ id: 'old', activeToMonth: '2026-12' }, { id: 'leaves', activeToMonth: '2027-01' }, { id: 'joins', activeFromMonth: '2027-12' }, { id: 'future', activeFromMonth: '2028-01' }, { id: 'all' }];
  const before = JSON.stringify(people);
  assert.deepEqual(api.peopleForYear(people, 2027).map(p => p.id), ['leaves', 'joins', 'all']);
  assert.deepEqual(api.peopleForYear(people, 2026).map(p => p.id), ['old', 'leaves', 'all']);
  assert.equal(JSON.stringify(people), before);
});

test('export appends one complete team overview with periods and deduplicated annual totals', () => {
  const employees = [{ id: 'a', name: 'Name A' }, { id: 'b', name: 'Name B' }, { id: 'old', name: 'Old', activeToMonth: '2026-12' }];
  const value = data([request('a', '2027-02-01', '2027-02-07'), request('archived', '2026-12-30', '2027-01-04')]);
  const model = api.buildExportModel(value, employees, 2027, undefined, holidaysForYear);
  assert.equal(model.pages.filter(page => page.overview).length, 1);
  const overview = model.pages.at(-1);
  assert.deepEqual(overview.people.map(person => person.id), ['a', 'b', 'archived']);
  assert.equal(overview.people[0].total, '6'); assert.equal(overview.people[1].total, '0');
  assert.equal(overview.people[1].periods.join(''), 'Noch keine Urlaubswünsche');
  assert.match(overview.people[0].periods.join(''), /01.02.2027/);
  assert.ok(overview.people.reduce((total, person) => total + person.height, 0) <= 490);
  assert.match(api.renderSheet(model, model.pages.length - 1), /Teamübersicht/);
  const many = Array.from({ length: 100 }, (_, id) => ({ id: String(id), name: 'Name ' + id }));
  assert.throws(() => api.buildExportModel(undefined, many, 2027, undefined, holidaysForYear), /nicht lesbar/);
});

test('combined calendar includes all overlapping people once per date and a unique name legend', () => {
  const people = Array.from({ length: 13 }, (_, id) => ({ id: String(id), name: id < 2 ? 'Surname' + id + ', Alex' : 'Person ' + id }));
  const input = data(people.map(person => request(person.id, '2027-07-01', '2027-07-14')));
  const model = api.buildExportModel(input, people, 2027, undefined, holidaysForYear);
  const page = model.pages.find(page => page.combined);
  assert.ok(page); assert.equal(page.legend.length, 13);
  assert.deepEqual(page.cellLines.get('2027-07-01').join(' ').split(' '), page.legend.map(person => person.code));
  assert.ok(page.cellLines.get('2027-07-01').length <= 3);
  assert.equal(page.cellLines.get('2027-06-30').length, 0);
  assert.notEqual(page.legend[0].name, page.legend[1].name);
  assert.ok(page.legend[0].name.includes('Surname'));
  const svg = api.renderSheet(model, model.pages.indexOf(page));
  assert.match(svg, /Gesamtes Team/); assert.equal((svg.match(/data-team-legend=/g) || []).length, 13);
});


test('oversized optional combined calendar preserves complete existing export pages', () => {
  for (const simultaneous of [false, true]) {
    const people = Array.from({ length: simultaneous ? 16 : 21 }, (_, id) => ({ id: String(id), name: 'Name ' + id }));
    const input = data(people.map((person, i) => request(person.id, `2027-07-${String(simultaneous ? 1 : i + 1).padStart(2, '0')}`, `2027-07-${String(simultaneous ? 1 : i + 1).padStart(2, '0')}`)));
    const before = JSON.stringify(input);
    const original = api.buildSheets(input, people, 2027);
    const model = api.buildExportModel(input, people, 2027, undefined, holidaysForYear);
    assert.equal(model.pages.some(page => page.combined), false);
    assert.equal(model.pages.length, original.pages.length + 1);
    assert.deepEqual(model.pages.slice(0, -1), original.pages);
    assert.deepEqual(model.pages.at(-1).people.map(person => person.id), people.map(person => person.id));
    assert.equal(model.warnings.length, 1);
    assert.match(model.warnings[0], simultaneous ? /01.07.2027/ : /20 Personen/);
    assert.match(model.warnings[0], /übrigen Kalenderblättern und der Teamübersicht/);
    for (let i = 0; i < model.pages.length; i++) assert.match(api.renderSheet(model, i), /<svg/);
    assert.equal(JSON.stringify(input), before);
  }
});
