const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./test-helpers');

const ctx = loadScripts(['balance-utils.js']);

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
