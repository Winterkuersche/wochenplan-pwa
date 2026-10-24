const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const api = require('../vacation-calendar');
const { loadScripts } = require('./test-helpers');
const request = (employeeId, from, to = from, extra = {}) => ({ id: employeeId + from, employeeId, employeeName: 'Name ' + employeeId, from, to, ...extra });
const data = requests => ({ ...api.emptyData(), requests });

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
  assert.equal(result.pages.length, 7);
  assert.deepEqual(result.pages.flatMap(page => page.people.map(person => person.id)), employees.map(person => person.id));
  for (const page of result.pages) assert.ok([...page.used.values()].every(count => count <= 2));
  const dispersed = data(employees.map((person, i) => request(person.id, `2027-07-${String(i + 1).padStart(2, '0')}`)));
  assert.equal(api.buildSheets(dispersed, employees, 2027).pages.length, 1);
  // Very long labels must never be clipped or printed unreadably.
  employees[0].name = 'A'.repeat(100);
  assert.throws(() => api.buildSheets(value, employees, 2027), /Druckname/);
  value.printNames['0'] = 'Person 0'; assert.equal(api.buildSheets(value, employees, 2027).pages.length, 7);
  assert.equal(api.buildSheets(api.emptyData(), [], 2027).pages.length, 1);
});

test('printed dates include full names and weekends; special characters cannot inject markup', () => {
  const value = data([request('a', '2027-01-01', '2027-01-03', { employeeName: '<script> & A' })]);
  value.title = '<img onerror=evil()>';
  const html = api.printDocument(api.buildSheets(value, [], 2027), [{ date: '2027-01-01', name: 'Neujahr' }]);
  assert.doesNotMatch(html, /<script>|<img /); assert.match(html, /&lt;script&gt;/); assert.match(html, /&lt;img/);
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
