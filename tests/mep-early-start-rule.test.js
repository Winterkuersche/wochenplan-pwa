const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appScript = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const applyRuleMatch = appScript.match(/function applyMepEarlyStartCarryoverRule\(isoDate, options = \{\}\) \{[\s\S]*?\n\}/);
const applyRangeRuleMatch = appScript.match(/function applyMepEarlyStartRuleForRange\(fromIso, toIso, options = \{\}\) \{[\s\S]*?\n\}/);

assert.ok(applyRuleMatch, 'applyMepEarlyStartCarryoverRule should exist in app.js');
assert.ok(applyRangeRuleMatch, 'applyMepEarlyStartRuleForRange should exist in app.js');

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

  vm.runInContext(
    `${applyRuleMatch[0]}; ${applyRangeRuleMatch[0]}; this.applyMepEarlyStartCarryoverRule = applyMepEarlyStartCarryoverRule; this.applyMepEarlyStartRuleForRange = applyMepEarlyStartRuleForRange;`,
    context,
    { filename: 'app.js' }
  );

  return {
    applyRule: context.applyMepEarlyStartCarryoverRule,
    applyRuleForRange: context.applyMepEarlyStartRuleForRange,
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

test('selects TL only when TL had 19:10 on previous day', () => {
  const initialSchedule = {
    '2026-04-10': {
      tl: { type: 'shift', end: '19:10' },
      e1: { type: 'shift', end: '19:10' }
    },
    '2026-04-11': {
      tl: { type: 'shift', start: '09:30', end: '17:00' },
      e1: { type: 'shift', start: '08:55', end: '17:00' }
    }
  };
  const ctx = buildContext({
    employees: [{ id: 'tl', roleKey: 'TL' }, { id: 'e1' }],
    schedule: initialSchedule
  });

  const selectedId = ctx.applyRule('2026-04-11');

  assert.equal(selectedId, 'tl');
  assert.equal(ctx.state.schedule['2026-04-11'].tl.start, '08:55');
  assert.equal(ctx.state.schedule['2026-04-11'].e1.start, '09:00');
  assert.equal(ctx.getCommitCount(), 1);
});

test('selects SV only when SV had 19:10 on previous day', () => {
  const ctx = buildContext({
    employees: [{ id: 'tl', roleKey: 'TL' }, { id: 'sv', roleKey: 'SV' }, { id: 'e1' }],
    schedule: {
      '2026-04-10': {
        sv: { type: 'shift', end: '19:10' },
        e1: { type: 'shift', end: '19:10' }
      },
      '2026-04-11': {
        sv: { type: 'shift', start: '09:15', end: '17:00' },
        e1: { type: 'shift', start: '08:55', end: '17:00' }
      }
    }
  });

  const selectedId = ctx.applyRule('2026-04-11');

  assert.equal(selectedId, 'sv');
  assert.equal(ctx.state.schedule['2026-04-11'].sv.start, '08:55');
  assert.equal(ctx.state.schedule['2026-04-11'].e1.start, '09:00');
});

test('does not select TL when TL had no 19:10 on previous day', () => {
  const ctx = buildContext({
    employees: [{ id: 'tl', roleKey: 'TL' }, { id: 'e1' }],
    schedule: {
      '2026-04-10': {
        tl: { type: 'shift', end: '18:00' },
        e1: { type: 'shift', end: '19:10' }
      },
      '2026-04-11': {
        tl: { type: 'shift', start: '08:55', end: '17:00' },
        e1: { type: 'shift', start: '09:00', end: '17:00' }
      }
    }
  });

  const selectedId = ctx.applyRule('2026-04-11');

  assert.equal(selectedId, 'e1');
  assert.equal(ctx.state.schedule['2026-04-11'].tl.start, '09:00');
  assert.equal(ctx.state.schedule['2026-04-11'].e1.start, '08:55');
});

test('does not select SV when SV had no 19:10 on previous day', () => {
  const ctx = buildContext({
    employees: [{ id: 'sv', roleKey: 'SV' }, { id: 'e1' }],
    schedule: {
      '2026-04-10': {
        sv: { type: 'shift', end: '18:00' },
        e1: { type: 'shift', end: '19:10' }
      },
      '2026-04-11': {
        sv: { type: 'shift', start: '08:55', end: '17:00' },
        e1: { type: 'shift', start: '09:00', end: '17:00' }
      }
    }
  });

  const selectedId = ctx.applyRule('2026-04-11');

  assert.equal(selectedId, 'e1');
  assert.equal(ctx.state.schedule['2026-04-11'].sv.start, '09:00');
  assert.equal(ctx.state.schedule['2026-04-11'].e1.start, '08:55');
});

test('recognizes SV variants from function fields (e.g. "Stv")', () => {
  const ctx = buildContext({
    employees: [{ id: 'e1', functionKey: ' Stv ' }, { id: 'e2' }],
    schedule: {
      '2026-04-10': {
        e1: { type: 'shift', end: '19:10' },
        e2: { type: 'shift', end: '19:10' }
      },
      '2026-04-11': {
        e1: { type: 'shift', start: '09:20', end: '17:00' },
        e2: { type: 'shift', start: '08:55', end: '17:00' }
      }
    }
  });

  const selectedId = ctx.applyRule('2026-04-11');

  assert.equal(selectedId, 'e1');
  assert.equal(ctx.state.schedule['2026-04-11'].e1.start, '08:55');
  assert.equal(ctx.state.schedule['2026-04-11'].e2.start, '09:00');
});

test('does not select SV variant from function fields without own previous-day 19:10', () => {
  const ctx = buildContext({
    employees: [{ id: 'e1', functionKey: 'Stv' }, { id: 'e2' }],
    schedule: {
      '2026-04-10': {
        e1: { type: 'shift', end: '18:00' },
        e2: { type: 'shift', end: '19:10' }
      },
      '2026-04-11': {
        e1: { type: 'shift', start: '08:55', end: '17:00' },
        e2: { type: 'shift', start: '09:00', end: '17:00' }
      }
    }
  });

  const selectedId = ctx.applyRule('2026-04-11');

  assert.equal(selectedId, 'e2');
  assert.equal(ctx.state.schedule['2026-04-11'].e1.start, '09:00');
  assert.equal(ctx.state.schedule['2026-04-11'].e2.start, '08:55');
});

test('falls back to first previous-day 19:10 worker when neither TL nor SV can be selected', () => {
  const ctx = buildContext({
    employees: [{ id: 'tl', roleKey: 'TL' }, { id: 'sv', roleKey: 'SV' }, { id: 'e1' }, { id: 'e2' }],
    schedule: {
      '2026-04-10': {
        e1: { type: 'shift', end: '19:10' },
        e2: { type: 'shift', end: '19:10' }
      },
      '2026-04-11': {
        e1: { type: 'shift', start: '09:00', end: '17:00' },
        e2: { type: 'shift', start: '09:00', end: '17:00' }
      }
    }
  });

  const selectedId = ctx.applyRule('2026-04-11');

  assert.equal(selectedId, 'e1');
  assert.equal(ctx.state.schedule['2026-04-11'].e1.start, '08:55');
  assert.equal(ctx.state.schedule['2026-04-11'].e2.start, '09:00');
});

test('prioritizes within eligible candidates as TL > SV > others', () => {
  const ctx = buildContext({
    employees: [{ id: 'e1' }, { id: 'sv', roleKey: 'SV' }, { id: 'tl', roleKey: 'TL' }],
    schedule: {
      '2026-04-10': {
        e1: { type: 'shift', end: '19:10' },
        sv: { type: 'shift', end: '19:10' },
        tl: { type: 'shift', end: '19:10' }
      },
      '2026-04-11': {
        e1: { type: 'shift', start: '08:55', end: '17:00' },
        sv: { type: 'shift', start: '08:55', end: '17:00' },
        tl: { type: 'shift', start: '09:00', end: '17:00' }
      }
    }
  });

  const selectedId = ctx.applyRule('2026-04-11');

  assert.equal(selectedId, 'tl');
  assert.equal(ctx.state.schedule['2026-04-11'].tl.start, '08:55');
  assert.equal(ctx.state.schedule['2026-04-11'].sv.start, '09:00');
  assert.equal(ctx.state.schedule['2026-04-11'].e1.start, '09:00');
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

test('applies reconciliation for a date range with a single commit', () => {
  const ctx = buildContext({
    employees: [{ id: 'tl', roleKey: 'TL' }, { id: 'sv', roleKey: 'SV' }, { id: 'e3' }],
    schedule: {
      '2026-04-10': {
        tl: { type: 'shift', end: '19:10' },
        sv: { type: 'shift', end: '18:00' },
        e3: { type: 'shift', end: '18:00' }
      },
      '2026-04-11': {
        tl: { type: 'shift', start: '09:00', end: '17:00' },
        sv: { type: 'shift', start: '08:55', end: '16:00' },
        e3: { type: 'shift', start: '09:00', end: '17:00' }
      },
      '2026-04-12': {
        tl: { type: 'shift', start: '09:00', end: '17:00' },
        sv: { type: 'shift', start: '08:55', end: '17:00' },
        e3: { type: 'shift', start: '09:00', end: '17:00' }
      },
      '2026-04-13': {
        tl: { type: 'shift', start: '08:55', end: '17:00' },
        sv: { type: 'shift', start: '09:00', end: '17:00' },
        e3: { type: 'shift', start: '09:00', end: '17:00' }
      }
    }
  });

  const result = ctx.applyRuleForRange('2026-04-11', '2026-04-13');

  assert.equal(result.changed, true);
  assert.equal(result.changedDays, 1);
  assert.equal(ctx.state.schedule['2026-04-11'].tl.start, '08:55');
  assert.equal(ctx.state.schedule['2026-04-11'].sv.start, '09:00');
  assert.equal(ctx.state.schedule['2026-04-12'].tl.start, '09:00');
  assert.equal(ctx.state.schedule['2026-04-12'].sv.start, '08:55');
  assert.equal(ctx.state.schedule['2026-04-13'].tl.start, '08:55');
  assert.equal(ctx.state.schedule['2026-04-13'].sv.start, '09:00');
  assert.equal(ctx.getCommitCount(), 1);
});

test('does not commit when range reconciliation makes no changes', () => {
  const ctx = buildContext({
    employees: [{ id: 'e1' }],
    schedule: {
      '2026-04-10': {
        e1: { type: 'shift', end: '18:00' }
      },
      '2026-04-11': {
        e1: { type: 'shift', start: '09:00', end: '17:00' }
      }
    }
  });

  const result = ctx.applyRuleForRange('2026-04-11', '2026-04-11');

  assert.equal(result.changed, false);
  assert.equal(result.changedDays, 0);
  assert.equal(ctx.getCommitCount(), 0);
});
