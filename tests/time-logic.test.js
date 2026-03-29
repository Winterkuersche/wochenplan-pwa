const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./test-helpers');

const ctx = loadScripts(['time-utils.js']);

test('normalizePlanTime keeps explicit exceptions', () => {
  assert.equal(ctx.normalizePlanTime('08:55'), '08:55');
  assert.equal(ctx.normalizePlanTime('19:10'), '19:10');
});

test('normalizePlanTime rounds quarter-hour times', () => {
  assert.equal(ctx.normalizePlanTime('09:07'), '09:00');
  assert.equal(ctx.normalizePlanTime('09:08'), '09:15');
});

test('required break after > 6h span', () => {
  assert.equal(ctx.getRequiredBreakMinutesForSpan('09:00', '15:00'), 0);
  assert.equal(ctx.getRequiredBreakMinutesForSpan('09:00', '15:01'), 60);
});
