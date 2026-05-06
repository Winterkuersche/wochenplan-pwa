const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./test-helpers');

const ctx = loadScripts(['time-utils.js'], {
  ENTRY_STATUS: { EXTERNAL: 'external-help', WORK: 'shift' },
  getEntryStatus: (entry) => entry?.type || 'shift'
});

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


test('business required break minutes handles 08:55/19:10 edge cases without additive pause', () => {
  assert.equal(ctx.getBusinessRequiredBreakMinutes('08:55', '15:00'), 5);
  assert.equal(ctx.getBusinessRequiredBreakMinutes('08:55', '15:15'), 60);
  assert.equal(ctx.getBusinessRequiredBreakMinutes('09:00', '15:00'), 0);
  assert.equal(ctx.getBusinessRequiredBreakMinutes('13:00', '19:10'), 10);
  assert.equal(ctx.getBusinessRequiredBreakMinutes('12:45', '19:10'), 60);
  assert.equal(ctx.getBusinessRequiredBreakMinutes('09:00', '19:10'), 60);
  assert.equal(ctx.getBusinessRequiredBreakMinutes('08:55', '19:10'), 60);

  assert.notEqual(ctx.getBusinessRequiredBreakMinutes('09:00', '19:10'), 70);
  assert.notEqual(ctx.getBusinessRequiredBreakMinutes('08:55', '19:10'), 65);
  assert.notEqual(ctx.getBusinessRequiredBreakMinutes('08:55', '19:10'), 75);
  assert.notEqual(ctx.getBusinessRequiredBreakMinutes('12:45', '19:10'), 65);
});

test('MEP pause minutes use same business break values for edge ranges', () => {
  assert.equal(
    ctx.getPauseMinutesForMepDisplay({ type: 'shift', start: '08:55', end: '15:00', pause: 0 }),
    5
  );
  assert.equal(
    ctx.getPauseMinutesForMepDisplay({ type: 'shift', start: '13:00', end: '19:10', pause: 0 }),
    10
  );
  assert.equal(
    ctx.getPauseMinutesForMepDisplay({ type: 'shift', start: '09:00', end: '19:10', pause: 0 }),
    60
  );
  assert.notEqual(
    ctx.getPauseMinutesForMepDisplay({ type: 'shift', start: '09:00', end: '19:10', pause: 0 }),
    70
  );
});
