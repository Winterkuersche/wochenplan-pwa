const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./test-helpers');

const ctx = loadScripts(['date-utils.js', 'month-engine.js']);

test('month grid for March 2026 starts on Monday and ends on Sunday', () => {
  const weeks = ctx.buildMonthWeeks(2026, 2); // March
  assert.equal(weeks[0][0].iso, '2026-02-23');
  assert.equal(weeks[weeks.length - 1][6].iso, '2026-04-05');
});

test('february leap year includes 29th day in month meta', () => {
  const meta = ctx.getMonthMeta(2024, 1); // February
  assert.equal(meta.firstOfMonthIso, '2024-02-01');
  assert.equal(meta.lastOfMonthIso, '2024-02-29');
});
