const test = require('node:test');
const assert = require('node:assert/strict');
const Optimizer = require('../planning2-playground-optimizer.js');

const facts = extra => Optimizer._test.normalizeVariantFacts(extra, extra.mutations || [], { selectedWeeks: ['2026-09-07'], baselineFacts: { understaffingMinutes: 240 } }, {});

test('coverage is lexicographically stronger than stability and justified plus', () => {
  const covered = facts({ understaffingMinutes: 0, totalUnnecessaryPlusMinutes: 180, changeCount: 8 });
  const stable = facts({ understaffingMinutes: 120, totalUnnecessaryPlusMinutes: 0, changeCount: 1 });
  assert.ok(Optimizer.compareDomainFacts(covered, stable) < 0);
});

test('equal coverage prefers less unnecessary plus and old minus makes hours useful', () => {
  assert.ok(Optimizer.compareDomainFacts(facts({ understaffingMinutes: 0, totalUnnecessaryPlusMinutes: 0 }), facts({ understaffingMinutes: 0, totalUnnecessaryPlusMinutes: 60 })) < 0);
  const plan = { schedule: { '2026-09-08': { minus: { type: 'shift', start: '09:00', end: '13:00', minutes: 240 } } } };
  const profile = Optimizer.evaluateVariantFacts(plan, [{ isoDate: '2026-09-08', employeeId: 'minus' }], { yearMonth: '2026-09', sourceEmployees: [{ id: 'minus', monthTargetMinutes: 300, carryInMinusMinutes: 60 }] });
  assert.equal(profile.employeeBalances[0].projectedBalanceMinutes, -120);
  assert.equal(profile.totalMinusMinutes, 120);
});

test('vacation, sick and holiday credit weekly hours divided by six, off does not', () => {
  const schedule = {
    '2026-09-01': { a: { type: 'vacation' } }, '2026-09-02': { a: { type: 'sick' } },
    '2026-09-03': { a: { type: 'holiday' } }, '2026-09-04': { a: { type: 'off' } }
  };
  const profile = Optimizer.evaluateVariantFacts({ schedule }, [], { yearMonth: '2026-09', sourceEmployees: [{ id: 'a', weeklyMinutes: 1800, monthTargetMinutes: 1200 }] });
  assert.equal(profile.employeeBalances[0].creditedAbsenceMinutes, 900);
});

test('GFB over budget is hard-invalid even when simulator says valid', () => {
  const session = { workingPlan: { schedule: {} }, selectedWeeks: ['2026-09-07'], locks: [] };
  const candidate = { candidateId: 'g', mutations: [{ isoDate: '2026-09-08', employeeId: 'g', after: { start: '09:00', end: '12:00' } }] };
  const result = Optimizer.run(session, { today: '2026-09-01', candidates: [candidate], simulateState: () => ({ valid: true, simulatedPlan: { schedule: {} }, domainFacts: { gfbBudgetMinutes: 2580, gfbUsedMinutes: 2640 } }) });
  assert.equal(result.variants.length, 0);
});

test('useful GFB, weekly distribution, Saturday and preferences are explicit soft levels', () => {
  assert.ok(Optimizer.compareDomainFacts(facts({ gfbUsefulUtilization: 180 }), facts({ gfbUsefulUtilization: 0 })) < 0);
  assert.ok(Optimizer.compareDomainFacts(facts({ weeklyDistributionPenalty: 0 }), facts({ weeklyDistributionPenalty: 60 })) < 0);
  assert.ok(Optimizer.compareDomainFacts(facts({ saturdayPenalty: 0 }), facts({ saturdayPenalty: 1 })) < 0);
  assert.ok(Optimizer.compareDomainFacts(facts({ preferenceViolationMinutes: 0 }), facts({ preferenceViolationMinutes: 60 })) < 0);
});

test('outside-scope stability loses only at the final ranking levels', () => {
  const outside = facts({ mutations: [{ isoDate: '2026-09-22' }], understaffingMinutes: 0 });
  const inside = facts({ mutations: [{ isoDate: '2026-09-08' }], understaffingMinutes: 0 });
  assert.equal(outside.outsideSelectedWeekChangeCount, 1);
  assert.ok(Optimizer.compareDomainFacts(inside, outside) < 0);
  assert.ok(Optimizer.compareDomainFacts(outside, facts({ mutations: [{ isoDate: '2026-09-08' }], understaffingMinutes: 60 })) < 0);
});

test('remaining gaps produce external-help hints without modifying the plan', () => {
  const plan = { schedule: { '2026-09-11': {} } }, before = structuredClone(plan);
  const profile = Optimizer.evaluateVariantFacts(plan, [], { yearMonth: '2026-09' }, { coverageFacts: { understaffingMinutesAfter: 180, newGaps: [{ isoDate: '2026-09-11', start: 960, end: 1140, required: 1 }] } });
  assert.deepEqual(plan, before);
  assert.deepEqual(profile.externalHelpHints, [{ isoDate: '2026-09-11', start: 960, end: 1140, people: 1 }]);
});

test('explanation facts equal variant facts, ranking is deterministic and bounded', () => {
  const candidates = Array.from({ length: 5 }, (_, i) => ({ candidateId: `c${i}`, mutations: [{ isoDate: `2026-09-${String(i + 7).padStart(2, '0')}`, employeeId: `e${i}`, after: { start: '09:00', end: '12:00' } }] }));
  const session = { workingPlan: { schedule: {} }, selectedWeeks: ['2026-09-07'], locks: [] };
  const context = { today: '2026-09-01', candidates, baselineFacts: { understaffingMinutes: 300 }, simulateState(_plan, mutations) { return { valid: true, simulatedPlan: { schedule: { marker: mutations.length } }, domainFacts: { understaffingMinutes: 300 - mutations.length * 30 } }; } };
  const one = Optimizer.run(session, context, { maxSimulations: 7, beamWidth: 2 }), two = Optimizer.run(session, context, { maxSimulations: 7, beamWidth: 2 });
  assert.ok(one.variants.length <= 3); assert.ok(one.debugCounters.simulatedStateCount <= 7); assert.ok(one.debugCounters.maxFrontierSize <= 2);
  assert.deepEqual(one.variants.map(v => v.variantId), two.variants.map(v => v.variantId));
  assert.deepEqual(one.variants[0].explanationFacts, one.variants[0].variantFacts);
});
