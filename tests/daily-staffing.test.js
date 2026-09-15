const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./test-helpers');

const ctx = loadScripts([
  'time-utils.js',
  'month-engine.js',
  'daily-staffing.js'
]);

test('classifies planned working times into mutually exclusive staffing groups', () => {
  assert.equal(ctx.getDailyStaffingGroup({ start: '08:55', end: '14:00' }), 'early');
  assert.equal(ctx.getDailyStaffingGroup({ start: '09:00', end: '19:10' }), 'fullDay');
  assert.equal(ctx.getDailyStaffingGroup({ start: '10:00', end: '17:00' }), 'between');
  assert.equal(ctx.getDailyStaffingGroup({ start: '13:00', end: '19:00' }), 'late');
  assert.equal(ctx.getDailyStaffingGroup({ label: 'U' }), null);
});

test('lists full-day employees only in the full-day group', () => {
  const employees = [
    { id: 'early', name: 'Ada' },
    { id: 'full', name: 'Berta' },
    { id: 'between', name: 'Clara' },
    { id: 'late', name: 'Dora' }
  ];
  const entries = {
    early: { start: '09:00', end: '13:00' },
    full: { sourceEntry: { start: '08:55', end: '19:10' } },
    between: { start: '10:00', end: '17:00' },
    late: { start: '13:00', end: '19:00' }
  };
  const day = { iso: '2026-09-14', weekdayLabel: 'Mo', date: new Date(2026, 8, 14) };

  const result = ctx.buildDailyStaffingForDays([day], employees, (employee) => entries[employee.id]);

  assert.deepEqual(JSON.parse(JSON.stringify(result[0].groups)), {
    early: ['Ada'],
    fullDay: ['Berta'],
    between: ['Clara'],
    late: ['Dora']
  });
});

test('renders names, counts and at most Monday through Saturday with escaped names', () => {
  const days = Array.from({ length: 7 }, (_, index) => ({
    iso: `2026-09-${14 + index}`,
    weekdayLabel: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][index],
    date: new Date(2026, 8, 14 + index)
  }));
  const html = ctx.buildDailyStaffingMarkup(days, [{ id: 'e1', name: '<Alex>' }], () => ({
    start: '09:00',
    end: '13:00'
  }));

  assert.match(html, /Tagesbesetzung/);
  assert.match(html, /Früh/);
  assert.match(html, /aria-label="1 Personen">1/);
  assert.match(html, /&lt;Alex&gt;/);
  assert.doesNotMatch(html, />So </);
  assert.match(html, /class="dailyStaffing noExport"/);
});
