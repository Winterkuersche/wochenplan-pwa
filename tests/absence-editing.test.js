const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./test-helpers');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = loadScripts(['date-utils.js', 'absences.js']);
const original = { id: 'old', employeeId: 'a', type: 'vacation', from: '2026-10-19', to: '2026-10-23', note: 'Unverändert erhalten' };
const other = { id: 'other', employeeId: 'b', type: 'sick', from: '2026-10-19', to: '2026-10-24', note: '' };
const plain = value => JSON.parse(JSON.stringify(value));

test('editing replaces only the selected absence, preserves notes, and never mutates the input', () => {
  for (const type of ['vacation', 'sick']) {
    const previousAbsence = { ...original, type }, input = [previousAbsence, other];
    const result = ctx.prepareAbsenceRangeChange(input, { employeeId: 'a', type, from: '2026-10-20', to: '2026-10-22', note: original.note, previousAbsence });
    assert.deepEqual(plain(result.map(a => [a.employeeId, a.from, a.to, a.note])), [
      ['b', other.from, other.to, ''], ['a', '2026-10-20', '2026-10-22', original.note]
    ]);
    assert.deepEqual(input, [previousAbsence, other]);
  }
});

test('switching vacation and sick replaces the entire selected interval in either direction', () => {
  for (const type of ['vacation', 'sick']) {
    const previousAbsence = { ...original, type }, replacement = type === 'sick' ? 'vacation' : 'sick';
    const result = ctx.prepareAbsenceRangeChange([previousAbsence], { employeeId: 'a', type: replacement, from: original.from, to: original.to, note: original.note, previousAbsence });
    assert.equal(result.length, 1); assert.equal(result[0].type, replacement); assert.equal(result[0].note, original.note);
  }
});

test('a stale interval or changed note is rejected without discarding any newer data', () => {
  for (const change of [{ to: '2026-10-24' }, { note: 'Neue Notiz' }, { id: 'new-id' }]) {
    const newer = { ...original, ...change }, input = [newer, other];
    assert.throws(() => ctx.prepareAbsenceRangeChange(input, { employeeId: 'a', type: 'vacation', from: '2026-10-20', to: '2026-10-22', previousAbsence: original }), /inzwischen geändert/);
    assert.deepEqual(input, [newer, other]);
  }
});

test('extending an edited absence splits conflicting coverage while preserving its outer portions', () => {
  const sick = { ...original, id: 'sick', type: 'sick', from: '2026-10-23', to: '2026-10-28' };
  const result = ctx.prepareAbsenceRangeChange([original, sick], { employeeId: 'a', type: 'vacation', from: '2026-10-19', to: '2026-10-24', previousAbsence: original });
  assert.deepEqual(plain(result.map(a => [a.type, a.from, a.to]).sort()), [
    ['sick', '2026-10-25', '2026-10-28'], ['vacation', '2026-10-19', '2026-10-24']
  ]);
});

test('invalid edit boundaries cannot remove the original interval', () => {
  const input = [original];
  for (const [from, to] of [['2026-10-24', '2026-10-19'], ['2026-02-30', '2026-10-23']]) {
    assert.throws(() => ctx.prepareAbsenceRangeChange(input, { employeeId: 'a', type: 'vacation', from, to, previousAbsence: original }), /Ungültiger/);
    assert.deepEqual(input, [original]);
  }
});

test('weekly interval edits remove stale vacation mirrors and preserve unrelated cells', () => {
  const live = fs.readFileSync('planning2-live.js', 'utf8');
  const context = loadScripts(['date-utils.js', 'absences.js', 'status-utils.js']);
  context.iso = context.toIsoDate;
  vm.runInContext(live.slice(live.indexOf('function setAbsenceRange('), live.indexOf('function makeShift(')), context);
  const plan = { absences: [original], schedule: {
    '2026-10-19': { a: { type: 'vacation', status: 'vacation' }, b: { type: 'shift' } },
    '2026-10-20': { a: { type: 'vacation', status: 'vacation' } },
    '2026-10-23': { a: { type: 'vacation', status: 'vacation' } }
  } };
  context.setAbsenceRange(plan, 'a', '2026-10-20', '2026-10-22', 'vacation', original);
  assert.equal(plan.schedule['2026-10-19'].a, undefined);
  assert.equal(plan.schedule['2026-10-23'].a, undefined);
  assert.equal(plan.schedule['2026-10-19'].b.type, 'shift');
  assert.equal(plan.absences[0].note, original.note);
  const before = plain(plan);
  assert.throws(() => context.setAbsenceRange(plan, 'a', '2026-10-19', '2026-10-24', 'sick', original), /inzwischen geändert/);
  assert.deepEqual(plain(plan), before);
});
