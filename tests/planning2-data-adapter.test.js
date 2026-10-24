const test = require('node:test');
const assert = require('node:assert/strict');
const { createPlanning2DataAdapter, MASTER_KEY, PLAN_KEY } = require('../planning2-data-adapter.js');

function storageFixture(values = {}) {
  const valuesByKey = new Map(Object.entries(values));
  return {
    getItem: key => valuesByKey.get(key) ?? null,
    setItem: (key, value) => valuesByKey.set(key, value),
    valuesByKey
  };
}

test('adapter reads the productive master and plan keys without changing existing entries', () => {
  const entry = { type: 'shift', code: 'F3', start: '09:00', end: '15:00', minutes: 330, custom: 'keep' };
  const storage = storageFixture({
    [MASTER_KEY]: JSON.stringify({ employees: [{ id: 'live', name: 'Produktiv' }], revision: 4 }),
    [PLAN_KEY]: JSON.stringify({ schedule: { '2026-09-07': { live: entry } }, absences: [], salesByDate: { '2026-09-07': 12 } })
  });
  const adapter = createPlanning2DataAdapter(storage);

  assert.equal(adapter.readMaster().employees[0].name, 'Produktiv');
  assert.deepEqual(adapter.readPlan().schedule['2026-09-07'].live, entry);
  assert.deepEqual(JSON.parse(storage.valuesByKey.get(PLAN_KEY)).schedule['2026-09-07'].live, entry);
});

test('manual Planning 2 changes are saved to the productive plan while unrelated data survives', () => {
  const storage = storageFixture({
    [PLAN_KEY]: JSON.stringify({ schedule: { old: { employee: { type: 'off', code: 'FR' } } }, absences: [], salesByDate: { keep: 99 } })
  });
  const adapter = createPlanning2DataAdapter(storage);
  const plan = adapter.readPlan();
  plan.schedule['2026-09-08'] = { employee: { type: 'shift', code: 'FLEX', start: '10:00', end: '16:00' } };
  adapter.savePlan(plan);

  const persisted = JSON.parse(storage.valuesByKey.get(PLAN_KEY));
  assert.equal(persisted.schedule['2026-09-08'].employee.end, '16:00');
  assert.deepEqual(persisted.schedule.old.employee, { type: 'off', code: 'FR' });
  assert.deepEqual(persisted.salesByDate, { keep: 99 });
});

test('legacy Planning 2 test keys are ignored and never automatically migrated', () => {
  const storage = storageFixture({
    wochenplan_master_v10_planning2_preview: JSON.stringify({ employees: [{ id: 'test' }] }),
    wochenplan_plan_v10_planning2_preview: JSON.stringify({ schedule: { test: true } })
  });
  const adapter = createPlanning2DataAdapter(storage);

  assert.deepEqual(adapter.readMaster().employees, []);
  assert.deepEqual(adapter.readPlan().schedule, {});
  assert.equal(storage.valuesByKey.has(PLAN_KEY), false);
});

test('saved departures refresh the visible future team without erasing historical shifts', () => {
  const person = { id: 'a', name: 'Synthetic', activeFromMonth: '2026-07', activeToMonth: '' };
  const storage = storageFixture({ [MASTER_KEY]: JSON.stringify({ employees: [person] }), [PLAN_KEY]: JSON.stringify({ schedule: { '2026-09-01': { a: { code: 'F4' } } }, absences: [] }) });
  const adapter = createPlanning2DataAdapter(storage), events = new EventTarget();
  const planBefore = storage.getItem(PLAN_KEY);
  let visible = ['a'], refreshes = 0;
  const stop = adapter.watchMasterChanges(events, () => {
    refreshes++;
    visible = adapter.readMaster().employees.filter(p => !p.activeToMonth || p.activeToMonth >= '2026-11').map(p => p.id);
  });
  person.activeToMonth = '2026-10';
  storage.setItem(MASTER_KEY, JSON.stringify({ employees: [person] }));
  events.dispatchEvent(new Event('wochenplan:saved'));
  assert.deepEqual(visible, []); assert.equal(refreshes, 1);
  assert.equal(storage.getItem(PLAN_KEY), planBefore);
  events.dispatchEvent(new Event('wochenplan:saved')); assert.equal(refreshes, 1);
  assert.equal(adapter.readMaster().employees[0].activeToMonth, '2026-10');
  person.activeToMonth = '';
  storage.setItem(MASTER_KEY, JSON.stringify({ employees: [person] }));
  events.dispatchEvent(new Event('wochenplan:saved'));
  assert.deepEqual(visible, ['a']);
  stop(); events.dispatchEvent(new Event('wochenplan:saved')); assert.equal(refreshes, 2);
});

test('master changes from another tab refresh without reacting to plan-only storage events', () => {
  const storage = storageFixture(), adapter = createPlanning2DataAdapter(storage), events = new EventTarget();
  let refreshes = 0; adapter.watchMasterChanges(events, () => refreshes++);
  storage.setItem(MASTER_KEY, JSON.stringify({ employees: [{ id: 'a', activeToMonth: '2026-10' }] }));
  const notify = key => { const event = new Event('storage'); Object.defineProperty(event, 'key', { value: key }); events.dispatchEvent(event); };
  notify(PLAN_KEY); assert.equal(refreshes, 0);
  notify(MASTER_KEY); assert.equal(refreshes, 1);
  notify(MASTER_KEY); assert.equal(refreshes, 1);
});
