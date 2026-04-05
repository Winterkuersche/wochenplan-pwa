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

test('subtractRangeFromAbsenceEntry trims correctly at month start boundary', () => {
  const entry = {
    ...baseEntry,
    from: '2026-03-01',
    to: '2026-03-10'
  };
  const result = ctx.subtractRangeFromAbsenceEntry(entry, '2026-03-01', '2026-03-01');
  const ranges = JSON.parse(JSON.stringify(result.map((x) => [x.from, x.to])));
  assert.deepEqual(ranges, [['2026-03-02', '2026-03-10']]);
});

test('subtractRangeFromAbsenceEntry trims correctly at month end boundary', () => {
  const entry = {
    ...baseEntry,
    from: '2026-03-21',
    to: '2026-03-31'
  };
  const result = ctx.subtractRangeFromAbsenceEntry(entry, '2026-03-31', '2026-03-31');
  const ranges = JSON.parse(JSON.stringify(result.map((x) => [x.from, x.to])));
  assert.deepEqual(ranges, [['2026-03-21', '2026-03-30']]);
});

test('subtractRangeFromAbsenceEntry keeps directly adjacent ranges unchanged', () => {
  const resultBefore = ctx.subtractRangeFromAbsenceEntry(baseEntry, '2026-03-01', '2026-03-09');
  const resultAfter = ctx.subtractRangeFromAbsenceEntry(baseEntry, '2026-03-21', '2026-03-31');

  assert.equal(resultBefore.length, 1);
  assert.equal(resultBefore[0], baseEntry);
  assert.equal(resultAfter.length, 1);
  assert.equal(resultAfter[0], baseEntry);
});

test('subtractRangeFromAbsenceEntry preserves absence type for vacation and sick', () => {
  const sickEntry = {
    ...baseEntry,
    id: 'abs-2',
    type: 'sick'
  };

  const vacationResult = ctx.subtractRangeFromAbsenceEntry(baseEntry, '2026-03-14', '2026-03-16');
  const sickResult = ctx.subtractRangeFromAbsenceEntry(sickEntry, '2026-03-14', '2026-03-16');

  assert.deepEqual(JSON.parse(JSON.stringify(vacationResult.map((x) => x.type))), ['vacation', 'vacation']);
  assert.deepEqual(JSON.parse(JSON.stringify(sickResult.map((x) => x.type))), ['sick', 'sick']);
});

test('normalizeAbsences merges overlapping and directly adjacent ranges for same employee and type', () => {
  const input = [
    { employeeId: 'emp_1', type: 'vacation', from: '2026-04-06', to: '2026-04-08', note: '' },
    { employeeId: 'emp_1', type: 'vacation', from: '2026-04-09', to: '2026-04-12', note: '' },
    { employeeId: 'emp_1', type: 'vacation', from: '2026-04-18', to: '2026-04-18', note: '' }
  ];

  const result = ctx.normalizeAbsences(input);
  const ranges = JSON.parse(JSON.stringify(result.map((x) => [x.from, x.to])));

  assert.deepEqual(ranges, [
    ['2026-04-06', '2026-04-12'],
    ['2026-04-18', '2026-04-18']
  ]);
});

test('resolveDayOverwriteDecision denies holiday overwrite attempts', () => {
  const result = ctx.resolveDayOverwriteDecision({
    employeeId: 'emp_1',
    isoDate: '2026-12-25',
    newKind: 'shift',
    currentResolvedState: 'holiday'
  });

  assert.equal(result.action, 'deny');
  assert.equal(result.reasonKey, 'holiday-protected');
});

test('resolveDayOverwriteDecision asks for confirmation when lowering priority from vacation to shift', () => {
  const result = ctx.resolveDayOverwriteDecision({
    employeeId: 'emp_1',
    isoDate: '2026-04-06',
    newKind: 'shift',
    currentResolvedState: 'vacation'
  });

  assert.equal(result.action, 'confirm');
  assert.equal(result.reasonKey, 'override-vacation');
  assert.equal(typeof result.confirmMessage, 'string');
  assert.equal(result.confirmMessage.length > 0, true);
});

test('resolveDayOverwriteDecision allows higher-priority overwrite from vacation to sick', () => {
  const result = ctx.resolveDayOverwriteDecision({
    employeeId: 'emp_1',
    isoDate: '2026-04-07',
    newKind: 'sick',
    currentResolvedState: 'vacation'
  });

  assert.equal(result.action, 'allow');
  assert.equal(result.reasonKey, 'priority-allows');
});
