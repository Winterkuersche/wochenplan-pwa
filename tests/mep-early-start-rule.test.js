const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appScript = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const applyRuleMatch = appScript.match(/function applyMepEarlyStartCarryoverRule\(isoDate, options = \{\}\) \{[\s\S]*?\n\}/);

assert.ok(applyRuleMatch, 'applyMepEarlyStartCarryoverRule should exist in app.js');

function buildContext({ employees, schedule }) {
  const state = {
    employees: employees.map((emp) => ({ ...emp })),
    schedule: structuredClone(schedule || {})
  };
  let commitCount = 0;

  const context = vm.createContext({
    state,
    shiftIsoDateByDays: (isoDate, dayOffset) => {
      const date = new Date(`${isoDate}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + dayOffset);
      return date.toISOString().slice(0, 10);
    },
    isEmployeeActiveInMonth: (employee, yearMonth) => {
      const from = employee.activeFromMonth || '';
      const to = employee.activeToMonth || '';
      if (from && yearMonth < from) return false;
      if (to && yearMonth > to) return false;
      return true;
    },
    getPlanEntry: (employeeId, isoDate) => {
      const entry = state.schedule?.[isoDate]?.[employeeId];
      return entry ? { ...entry } : null;
    },
    updateEmployeeDay: (employeeId, isoDate, updater) => {
      const current = state.schedule?.[isoDate]?.[employeeId];
      const next = updater(current ? { ...current } : null);
      if (!next) return null;
      if (!state.schedule[isoDate]) state.schedule[isoDate] = {};
      state.schedule[isoDate][employeeId] = { ...next };
      return state.schedule[isoDate][employeeId];
    },
    commitPlanChange: () => {
      commitCount += 1;
    }
  });

  vm.runInContext(`${applyRuleMatch[0]}; this.applyMepEarlyStartCarryoverRule = applyMepEarlyStartCarryoverRule;`, context, { filename: 'app.js' });

  return {
    applyRule: context.applyMepEarlyStartCarryoverRule,
    state,
    getCommitCount: () => commitCount
  };
}

test('sets exactly one 08:55 when a worker had 19:10 on previous day', () => {
  const ctx = buildContext({
    employees: [{ id: 'e1' }, { id: 'e2' }],
    schedule: {
      '2026-04-10': {
        e1: { type: 'shift', end: '19:10' },
        e2: { type: 'shift', end: '18:00' }
      },
      '2026-04-11': {
        e1: { type: 'shift', start: '09:00', end: '17:00', pause: 30, minutes: 450, mode: 'fixed', code: 'FO' },
        e2: { type: 'shift', start: '09:15', end: '17:15', pause: 30, minutes: 450, mode: 'fixed', code: 'FO' }
      }
    }
  });

  const selectedId = ctx.applyRule('2026-04-11');

  assert.equal(selectedId, 'e1');
  assert.equal(ctx.state.schedule['2026-04-11'].e1.start, '08:55');
  assert.equal(ctx.state.schedule['2026-04-11'].e1.end, '17:00');
  assert.equal(ctx.state.schedule['2026-04-11'].e2.start, '09:15');
  assert.equal(ctx.getCommitCount(), 1);
});

test('when multiple workers had 19:10, only the first is selected', () => {
  const ctx = buildContext({
    employees: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }],
    schedule: {
      '2026-04-10': {
        e1: { type: 'shift', end: '19:10' },
        e2: { type: 'shift', end: '19:10' },
        e3: { type: 'shift', end: '18:00' }
      },
      '2026-04-11': {
        e1: { type: 'shift', start: '09:00', end: '17:00' },
        e2: { type: 'shift', start: '09:00', end: '17:00' },
        e3: { type: 'shift', start: '09:00', end: '17:00' }
      }
    }
  });

  const selectedId = ctx.applyRule('2026-04-11');

  assert.equal(selectedId, 'e1');
  assert.equal(ctx.state.schedule['2026-04-11'].e1.start, '08:55');
  assert.equal(ctx.state.schedule['2026-04-11'].e2.start, '09:00');
});

test('does nothing when no previous-day 19:10 shift exists', () => {
  const initialSchedule = {
    '2026-04-10': {
      e1: { type: 'shift', end: '18:00' }
    },
    '2026-04-11': {
      e1: { type: 'shift', start: '09:00', end: '17:00' }
    }
  };
  const ctx = buildContext({
    employees: [{ id: 'e1' }],
    schedule: initialSchedule
  });

  const selectedId = ctx.applyRule('2026-04-11');

  assert.equal(selectedId, null);
  assert.deepEqual(ctx.state.schedule, initialSchedule);
  assert.equal(ctx.getCommitCount(), 0);
});

test('resets additional 08:55 starts on same day to 09:00', () => {
  const ctx = buildContext({
    employees: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }],
    schedule: {
      '2026-04-10': {
        e1: { type: 'shift', end: '19:10' }
      },
      '2026-04-11': {
        e1: { type: 'shift', start: '09:00', end: '17:00' },
        e2: { type: 'shift', start: '08:55', end: '16:00' },
        e3: { type: 'shift', start: '08:55', end: '15:00' }
      }
    }
  });

  ctx.applyRule('2026-04-11');

  assert.equal(ctx.state.schedule['2026-04-11'].e1.start, '08:55');
  assert.equal(ctx.state.schedule['2026-04-11'].e2.start, '09:00');
  assert.equal(ctx.state.schedule['2026-04-11'].e3.start, '09:00');
});
