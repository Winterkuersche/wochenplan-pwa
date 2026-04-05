const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./test-helpers');

const ctx = loadScripts(['date-utils.js', 'balance-utils.js']);

test('collectRelevantYearMonthsUntilActiveMonthBalance fills month gaps', () => {
  const months = ctx.collectRelevantYearMonthsUntilActiveMonthBalance({
    activeYearMonth: '2026-04',
    scheduleIsoDates: ['2026-02-11'],
    absences: [{ from: '2026-03-01', to: '2026-03-03' }],
    manualMonthActualMinutes: { '2026-01': 1200 },
    historyStartMonth: '2026-01'
  });

  assert.deepEqual(JSON.parse(JSON.stringify(months)), ['2026-01', '2026-02', '2026-03', '2026-04']);
});

test('collectRelevantYearMonthsUntilActiveMonthBalance keeps active month when no earlier candidate exists', () => {
  const months = ctx.collectRelevantYearMonthsUntilActiveMonthBalance({
    activeYearMonth: '2026-03',
    scheduleIsoDates: ['2025-12-31'],
    historyStartMonth: '2026-01'
  });

  assert.deepEqual(JSON.parse(JSON.stringify(months)), ['2026-03']);
});

test('collectRelevantYearMonthsUntilActiveMonthBalance ignores out-of-range month fragments from week overlaps', () => {
  const months = ctx.collectRelevantYearMonthsUntilActiveMonthBalance({
    activeYearMonth: '2026-03',
    scheduleIsoDates: ['2026-02-28', '2026-03-01', '2026-04-01'],
    absences: [{ from: '2026-02-27', to: '2026-03-02' }],
    historyStartMonth: '2026-03'
  });

  assert.deepEqual(JSON.parse(JSON.stringify(months)), ['2026-03']);
});


test('resolved day calculation stays stable after mixed replacements (single active state, no double minutes)', () => {
  const calcCtx = loadScripts([
    'date-utils.js',
    'time-utils.js',
    'status-utils.js',
    'shift-rules.js',
    'shift-utils.js',
    'absences.js',
    'holidays.js',
    'day-resolution.js'
  ]);

  const employee = { id: 'emp_1', target: '30:00' };
  const schedule = {
    '2026-03-04': {
      emp_1: { type: 'shift', mode: 'early', code: 'FO', minutes: 300 }
    }
  };

  let absences = [
    { employeeId: 'emp_1', type: 'vacation', from: '2026-03-02', to: '2026-03-06', note: '' }
  ];
  absences = calcCtx.replaceAbsenceCoverage(absences, 'emp_1', '2026-03-03', '2026-03-04', 'sick');
  absences = calcCtx.replaceAbsenceCoverage(absences, 'emp_1', '2026-03-04', '2026-03-04', null);

  const days = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06'];

  days.forEach((isoDate) => {
    const absence = calcCtx.getPriorityAbsenceForEmployeeOnDate(absences, employee.id, isoDate);
    const shift = schedule?.[isoDate]?.[employee.id] || null;
    const activeStateCount = Number(Boolean(absence)) + Number(Boolean(shift));
    assert.equal(activeStateCount <= 1, true, `only one active state expected on ${isoDate}`);
  });

  const totalMinutes = days.reduce((sum, isoDate) => {
    const resolved = calcCtx.getResolvedDayEntry({
      employee,
      isoDate,
      schedule,
      absences,
      stateKey: 'SH'
    });
    return sum + resolved.minutesForMonth;
  }, 0);

  const expectedDailyMinutes = calcCtx.getDailyTargetMinutesFromWeeklyHHMM(employee.target);
  assert.equal(totalMinutes, expectedDailyMinutes * days.length);
});
