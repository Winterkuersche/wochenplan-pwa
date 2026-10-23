const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./test-helpers');

const keys = { master: 'master', plan: 'plan', ui: 'ui', savedAt: 'savedAt', theme: 'theme', calibration: 'calibration' };
const state = (code) => ({ master: { employees: [{ id: 'one' }] }, plan: { schedule: { '2026-10-20': { one: { type: 'shift', code } } }, salesByDate: { '2026-10-20': 450 } }, ui: {}, savedAt: code, theme: 'true' });
function fixture(initial = state('F4')) {
  const map = new Map(Object.entries(initial).map(([key, value]) => [key, key === 'theme' ? value : JSON.stringify(value)]));
  const storage = { get length() { return map.size; }, key: (i) => [...map.keys()][i],
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { if (storage.fail?.(key, value)) throw Error('quota'); map.set(key, value); },
    removeItem: (key) => map.delete(key) };
  const ctx = loadScripts(['storage-utils.js']);
  return { map, storage, create: () => ctx.WochenplanStorage.create({ storage, keys }) };
}

test('a failed multi-key save rolls back the complete previous plan and employees', () => {
  const f = fixture(); const store = f.create(); const before = new Map(f.map);
  let failed = false;
  f.storage.fail = (key) => { if (key === 'plan' && !failed) { failed = true; return true; } return false; };
  assert.equal(store.writeBatch(state('F6')).ok, false);
  for (const [key, raw] of before) assert.equal(f.storage.getItem(key), raw);
  assert.equal(store.blocked, false);
});

test('quota failure while creating the journal does not change any existing data', () => {
  const f = fixture(); const store = f.create(); const before = [...f.map];
  f.storage.fail = (key) => key === 'wochenplan_save_journal_v1';
  assert.equal(store.writeBatch(state('F6')).ok, false);
  assert.deepEqual([...f.map], before);
});

test('startup rolls back an interrupted transaction before loading any data', () => {
  const f = fixture(); const previous = Object.fromEntries(Object.values(keys).map((key) => [key, f.storage.getItem(key)]));
  f.storage.setItem('wochenplan_save_journal_v1', JSON.stringify({ pending: true, createdAt: '2026-10-20', previous }));
  f.storage.setItem('master', JSON.stringify({ employees: [] }));
  f.storage.setItem('plan', JSON.stringify(state('F6').plan));
  const store = f.create();
  assert.equal(store.readJson('plan', {}).schedule['2026-10-20'].one.code, 'F4');
  assert.equal(store.readJson('master', {}).employees.length, 1);
});

test('malformed JSON and JSON null cannot be overwritten by fallback defaults', () => {
  for (const raw of ['{broken', 'null', '[]']) {
    const f = fixture(); f.map.set('plan', raw); const store = f.create();
    store.readJson('plan', {});
    assert.equal(store.blocked, true);
    assert.equal(store.writeBatch(state('F6')).ok, false);
    assert.equal(f.map.get('plan'), raw);
    assert.equal(store.exportRaw().entries.plan, raw);
  }
});

test('a missing plan alongside existing employees pauses writes', () => {
  const f = fixture(); f.map.delete('plan'); const store = f.create();
  assert.equal(store.blocked, true);
  assert.equal(store.writeBatch(state('F6')).ok, false);
  assert.equal(f.map.has('plan'), false);
});

test('a genuinely empty first installation can save its first plan', () => {
  const f = fixture({}); const store = f.create();
  assert.equal(store.blocked, false);
  assert.equal(store.writeBatch(state('F4')).ok, true);
});

test('another tab changing a plan prevents a stale save', () => {
  const f = fixture(); const first = f.create(); const second = f.create();
  assert.equal(first.writeBatch(state('F6')).ok, true);
  assert.equal(second.writeBatch(state('F3')).ok, false);
  assert.equal(second.problemKind, 'stale');
  assert.equal(JSON.parse(f.map.get('plan')).schedule['2026-10-20'].one.code, 'F6');
});
test('automatic adoption can detect a changed tab without writing or clearing its plan', () => {
  const f = fixture(), first = f.create(), second = f.create();
  assert.equal(second.isCurrent(), true); first.writeBatch(state('F6'));
  const before = [...f.map]; assert.equal(second.isCurrent(), false);
  assert.deepEqual([...f.map], before); assert.equal(second.blocked, false);
});

test('failure in a navigation-only save also restores its earlier raw plan', () => {
  const f = fixture(); const store = f.create(); const before = f.storage.getItem('plan');
  const next = state('F4'); next.plan.weekFrom = '2026-10-26';
  let failed = false;
  f.storage.fail = (key) => { if (key === 'ui' && !failed) { failed = true; return true; } return false; };
  assert.equal(store.writeBatch(next).ok, false);
  assert.equal(f.storage.getItem('plan'), before);
  assert.equal(store.writeBatch(state('F6')).ok, true);
});

test('previous-state recovery preserves sales, calibration, and raw theme encoding', () => {
  const f = fixture({ ...state('F4'), calibration: { x: 42 } }); const store = f.create();
  assert.equal(store.writeBatch(state('F6')).ok, true);
  const backup = store.getPrevious();
  assert.equal(backup.storage.plan.schedule['2026-10-20'].one.code, 'F4');
  assert.equal(backup.storage.plan.salesByDate['2026-10-20'], 450);
  assert.equal(backup.storage.calibration.x, 42);
  assert.equal(backup.storage.theme, 'true');
  assert.equal(f.map.get('theme'), 'true');
});

test('view changes do not replace the previous data state', () => {
  const f = fixture(); const store = f.create();
  store.writeBatch(state('F6'));
  const latest = state('F6'); latest.ui.currentView = 'month'; latest.plan.weekFrom = '2026-10-26';
  store.writeBatch(latest);
  assert.equal(store.getPrevious().storage.plan.schedule['2026-10-20'].one.code, 'F4');
});

test('an explicit valid restore unlocks a protected local store', () => {
  const f = fixture(); f.map.set('plan', 'null'); const store = f.create(); store.readJson('plan', {});
  assert.equal(store.writeBatch(state('F6'), { allowRecovery: true, source: 'import' }).ok, true);
  assert.equal(store.blocked, false);
  assert.equal(store.readJson('plan', {}).schedule['2026-10-20'].one.code, 'F6');
});

test('raw rescue export excludes Supabase authentication tokens', () => {
  const f = fixture(); f.map.set('sb-project-auth-token', 'private-session'); f.map.set('wochenplan_plan_v9', '{legacy');
  const exported = f.create().exportRaw();
  assert.equal(exported.entries.wochenplan_plan_v9, '{legacy');
  assert.equal(Object.hasOwn(exported.entries, 'sb-project-auth-token'), false);
});
