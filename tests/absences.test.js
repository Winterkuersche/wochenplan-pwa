const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./test-helpers');

const ctx = loadScripts(['date-utils.js', 'time-utils.js', 'absences.js']);

const baseEntry = {
  id: 'abs-1',
  employeeId: 'emp_1',
  type: 'vacation',
  from: '2026-03-10',
  to: '2026-03-20',
  note: ''
};

test('subtractRangeFromAbsenceEntry removes full overlap', () => {
  const result = ctx.subtractRangeFromAbsenceEntry(baseEntry, '2026-03-01', '2026-03-31');
  assert.equal(result.length, 0);
});

test('subtractRangeFromAbsenceEntry trims start', () => {
  const result = ctx.subtractRangeFromAbsenceEntry(baseEntry, '2026-03-01', '2026-03-12');
  const ranges = JSON.parse(JSON.stringify(result.map((x) => [x.from, x.to])));
  assert.deepEqual(ranges, [['2026-03-13', '2026-03-20']]);
});

test('subtractRangeFromAbsenceEntry trims end', () => {
  const result = ctx.subtractRangeFromAbsenceEntry(baseEntry, '2026-03-18', '2026-03-31');
  const ranges = JSON.parse(JSON.stringify(result.map((x) => [x.from, x.to])));
  assert.deepEqual(ranges, [['2026-03-10', '2026-03-17']]);
});

test('subtractRangeFromAbsenceEntry splits middle overlap', () => {
  const result = ctx.subtractRangeFromAbsenceEntry(baseEntry, '2026-03-14', '2026-03-16');
  const ranges = JSON.parse(JSON.stringify(result.map((x) => [x.from, x.to])));
  assert.deepEqual(ranges, [
    ['2026-03-10', '2026-03-13'],
    ['2026-03-17', '2026-03-20']
  ]);
});

test('subtractRangeFromAbsenceEntry keeps non-overlapping entry', () => {
  const result = ctx.subtractRangeFromAbsenceEntry(baseEntry, '2026-04-01', '2026-04-10');
  assert.equal(result.length, 1);
  assert.equal(result[0], baseEntry);
});
