const test = require('node:test');
const assert = require('node:assert/strict');
const State = require('../planning2-playground-state.js');
const Workflow = require('../planning2-playground-workflow.js');

const livePlan = { schedule: { '2026-09-01': { a: { type: 'shift', start: '09:00', end: '15:00' } } } };
const session = () => State.createSession({ month: '2026-09', plan: livePlan, selectedWeeks: ['2026-08-31'], now: new Date('2026-08-01T00:00:00Z') });
const variant = (id, start = '10:00', allowed = true) => ({ variantId: id, workingPlan: { schedule: { '2026-09-01': { a: { type: 'shift', start, end: '16:00' } } } }, variantFacts: { understaffingMinutes: 0, externalHelpHints: [] }, hardConstraintResult: { allowed, violations: allowed ? [] : [{ rule: 'REAL_FREE_DAY_REQUIRED' }] } });

test('optimization runs only when explicitly invoked and retains at most three ranked variants', async () => {
  const value = session(); let calls = 0;
  assert.equal(value.variants.length, 0);
  await Workflow.optimize(value, () => { calls += 1; return { status: 'success', variants: [variant('best'), variant('two'), variant('three'), variant('four')] }; }, {});
  assert.equal(calls, 1); assert.equal(value.variants.length, 3); assert.equal(value.variants[0].recommended, true); assert.equal(value.selectedVariantId, 'best');
});

test('selection and edits remain isolated from the live plan', () => {
  const value = session(); Workflow.replaceVariants(value, [variant('one'), variant('two', '11:00')]);
  Workflow.selectVariant(value, 'two');
  const edited = State.clone(value.workingPlan); edited.schedule['2026-09-01'].a.start = '12:00';
  State.commitWorkingPlan(value, 'a', '2026-09-01', edited, { now: new Date('2026-08-01T00:00:00Z') });
  assert.equal(value.variants[1].workingPlan.schedule['2026-09-01'].a.start, '12:00');
  assert.equal(livePlan.schedule['2026-09-01'].a.start, '09:00');
  assert.equal(value.locks[0].scope, 'shift');
});

test('running and failed optimization retain old variants, working copy and locks', async () => {
  const value = session(); Workflow.replaceVariants(value, [variant('old')]); State.addLock(value, { scope: 'week', weekId: '2026-08-31' });
  let release; const pending = Workflow.optimize(value, () => new Promise(resolve => { release = resolve; }), {});
  await Promise.resolve(); assert.equal(value.optimization.status, 'running'); assert.equal(value.selectedVariantId, 'old'); assert.equal(value.locks.length, 1);
  release({ status: 'cancelled' }); await pending;
  assert.equal(value.optimization.status, 'error'); assert.equal(value.selectedVariantId, 'old'); assert.equal(value.locks.length, 1);
});

test('successful replacement is atomic and from-here uses edited plan plus locks', async () => {
  const value = session(); Workflow.replaceVariants(value, [variant('old')]); State.addLock(value, { scope: 'employee-period', employeeId: 'a' });
  let input; await Workflow.optimize(value, candidate => { input = candidate; return { status: 'success', variants: [variant('new')] }; }, {}, { fromHere: true });
  assert.equal(input.source, 'variant:old'); assert.equal(input.workingPlan.schedule['2026-09-01'].a.start, '10:00'); assert.equal(input.locks.length, 1); assert.equal(value.selectedVariantId, 'new');
});

test('hard-invalid manual variant is visible in state and cannot optimize from here', async () => {
  const value = session(); Workflow.replaceVariants(value, [variant('bad', '10:00', false)]); let calls = 0;
  const result = await Workflow.optimize(value, () => { calls += 1; }, {}, { fromHere: true });
  assert.equal(result.status, 'invalid'); assert.equal(calls, 0); assert.equal(value.variants[0].hardConstraintResult.violations[0].rule, 'REAL_FREE_DAY_REQUIRED');
});

test('manual reevaluation persists E3 facts and external help remains a hint', () => {
  const value = session(); Workflow.replaceVariants(value, [variant('one')]);
  Workflow.reevaluateSelected(value, () => ({ variantFacts: { employeesInMinus: 2 }, explanationFacts: { changeCount: 1 }, externalHelpHints: [{ people: 1 }], hardConstraintResult: { allowed: true, violations: [] } }));
  assert.equal(value.variants[0].variantFacts.employeesInMinus, 2); assert.equal(value.variants[0].externalHelpHints.length, 1); assert.equal(value.workingPlan.schedule['2026-09-01'].external, undefined);
});
