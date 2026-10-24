const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../vacation-distribution');
const calendar = require('../vacation-calendar');
const { loadScripts } = require('./test-helpers');
const holidays = loadScripts(['holidays.js']);
const holidaysForYear = year => holidays.getHolidaysForStateYear('schleswig-holstein', year);
const employee = (id, extra = {}) => ({ id, name: 'Person ' + id, target: '20:00', totalVacationDays: 30, ...extra });
const request = (id, from, to) => ({ id: id + from, employeeId: id, employeeName: 'Person ' + id, from, to });
const options = extra => ({ data: calendar.emptyData(), employees: [employee('a')], absences: [], year: 2027, holidaysForYear, ...extra });
const touches = (a, b) => a.from <= b.to && a.to >= b.from;

test('full year: twelve continuous counted days, half by June and rest spread; inputs remain unchanged', () => {
  const input = options({ employees: [employee('a'), employee('b', { totalVacationDays: 31 })] });
  const before = JSON.stringify(input), result = api.propose(input);
  assert.deepEqual(result.errors, []); assert.equal(JSON.stringify(input), before);
  assert.equal(result.people[0].total, 30); assert.equal(result.people[1].total, 31);
  for (const person of result.people) {
    assert.ok(person.longest >= 12); assert.ok(person.firstHalf >= Math.ceil(person.budget / 2));
    const requests = result.proposals.filter(item => item.employeeId === person.id);
    assert.ok(requests.some(item => item.from >= '2027-07-01'));
    assert.equal(calendar.countVacationDays(requests, holidaysForYear, 2027).days, person.budget);
  }
  // Plenty of space: avoid other colleagues rather than choosing the same favourite dates.
  assert.ok(!result.proposals.filter(item => item.employeeId === 'a').some(a => result.proposals.some(b => b.employeeId === 'b' && touches(a, b))));
});

test('50-hour ceiling uses weekly hours, exact minutes, existing leave and unique people', () => {
  const employees = [employee('a', { target: '20:00' }), employee('b', { target: '20:00' }), employee('c', { target: '9:30' }), employee('d', { target: '0:30' })];
  const data = { ...calendar.emptyData(), requests: [request('a', '2027-02-01', '2027-02-13'), request('b', '2027-02-01', '2027-02-13')] };
  const base = options({ employees, data, selectedIds: ['c', 'd'], budgets: { c: 12, d: 12 }, notBefore: '2027-02-01' });
  // Pin the available employment period to make overlap necessary.
  base.employees = employees.map(person => ({ ...person, activeFromMonth: '2027-02', activeToMonth: '2027-02' }));
  const proposals = [request('c', '2027-02-01', '2027-02-13'), request('d', '2027-02-01', '2027-02-13')];
  assert.deepEqual(api.assess({ ...base, absences: [{ employeeId: 'a', type: 'vacation', from: '2027-02-01', to: '2027-02-13' }], proposals }).errors, []);
  const over = api.assess({ ...base, employees: base.employees.map(person => person.id === 'd' ? { ...person, target: '0:31' } : person), proposals });
  assert.ok(over.errors.some(error => /50 Wochen-Sollstunden/.test(error)));
  assert.equal(api.weeklyMinutes(employee('x', { target: '9:30' })), 570);
  assert.equal(api.weeklyMinutes(employee('x', { target: '9:75' })), null);
});

test('generated leave never increases existing over-cap dates or exceeds 50 hours in a large team', () => {
  const employees = Array.from({ length: 15 }, (_, index) => employee('e' + index, { target: index < 2 ? '30:00' : '20:00' }));
  const data = { ...calendar.emptyData(), requests: [request('e0', '2027-03-01', '2027-03-15'), request('e1', '2027-03-01', '2027-03-15')] };
  const result = api.propose(options({ employees, data }));
  assert.deepEqual(result.errors, []); assert.ok(result.notices.length);
  for (const proposal of result.proposals) assert.ok(!touches(proposal, data.requests[0]));
  for (const day of calendar.datesForYear(2027)) {
    const newPeople = result.proposals.filter(item => item.from <= day.iso && day.iso <= item.to);
    if (!newPeople.length) continue;
    const ids = new Set([...newPeople, ...data.requests.filter(item => item.from <= day.iso && day.iso <= item.to)].map(item => item.employeeId));
    assert.ok([...ids].reduce((total, id) => total + api.weeklyMinutes(employees.find(person => person.id === id)), 0) <= 3000, day.iso);
  }
});

test('manual wishes exclude a person; existing approved ranges are deducted once and can form the long block', () => {
  const data = { ...calendar.emptyData(), title: 'Test', printNames: { a: 'A' }, requests: [request('b', '2027-04-01', '2027-04-10')] };
  const approved = [{ employeeId: 'a', type: 'vacation', from: '2027-01-04', to: '2027-01-16' }];
  const input = options({ data, employees: [employee('a'), employee('b')], absences: [...approved, ...approved] });
  const before = JSON.stringify(input), result = api.propose(input);
  assert.deepEqual(result.errors, []); assert.equal(result.people.length, 1);
  assert.equal(result.people[0].existing, 12); assert.equal(result.people[0].added, 18);
  assert.ok(result.proposals.every(item => item.employeeId === 'a' && !touches(item, approved[0])));
  let id = 0;
  const adopted = api.adopt({ ...input, proposals: result.proposals }, () => 'new' + ++id);
  assert.deepEqual(adopted.requests[0], data.requests[0]); assert.equal(adopted.printNames.a, 'A');
  assert.equal(JSON.stringify(input), before); assert.deepEqual(api.eligiblePeople(adopted, input.employees, 2027), []);
  // Adopted entries use ordinary request editing; no special locked automatic records.
  const first = adopted.requests[1], edited = calendar.saveRequest(adopted, { ...first, to: first.from }, 'A');
  assert.equal(edited.requests[1].to, first.from); assert.notEqual(adopted.requests[1].to, first.from);
});

test('a short approved block can be extended to twelve with only the remaining balance', () => {
  const input = options({ budgets: { a: 12 }, absences: [{ employeeId: 'a', type: 'vacation', from: '2027-03-01', to: '2027-03-06' }] });
  const result = api.propose(input);
  assert.equal(result.people[0].total, 12); assert.ok(result.people[0].longest >= 12);
  assert.equal(result.people[0].added, 6); assert.deepEqual(result.errors, []);
});

test('entry/exit, sickness and earliest start bound proposals; impossible goals remain visible', () => {
  const input = options({ employees: [employee('old', { activeToMonth: '2026-10' }), employee('future', { activeFromMonth: '2028-01' }), employee('a', { activeFromMonth: '2027-10', activeToMonth: '2027-10' })],
    absences: [{ employeeId: 'a', type: 'sick', from: '2027-10-01', to: '2027-10-20' }], notBefore: '2027-10-12' });
  const result = api.propose(input);
  assert.equal(result.people.length, 1); assert.ok(result.proposals.every(item => item.from >= '2027-10-21' && item.to <= '2027-10-31'));
  assert.ok(result.people[0].warnings.some(message => /12-Tage/.test(message)));
  assert.ok(result.people[0].warnings.some(message => /Halbjahresziel/.test(message)));
  assert.ok(result.people[0].warnings.some(message => /noch offen/.test(message)));
  assert.ok(result.people[0].total < 12); assert.deepEqual(result.errors, []);
});

test('unknown holiday years and invalid budgets cannot produce apparent success', () => {
  assert.throws(() => api.propose(options({ year: 2028 })), /Feiertage für 2028 fehlen/);
  assert.throws(() => api.propose(options({ budgets: { a: -1 } })), /Jahreskontingent/);
  assert.throws(() => api.propose(options({ budgets: { a: 12.5 } })), /Jahreskontingent/);
  const result = api.propose(options({ budgets: { a: 6 } }));
  assert.equal(result.people[0].total, 6); assert.ok(result.people[0].warnings.some(message => /12-Tage/.test(message)));
});

test('unknown weekly hours reserve capacity, including archived colleagues; impossible capacity leaves days open', () => {
  const input = options({ employees: [employee('a', { target: '50:01' }), employee('b', { target: '' }), employee('c')],
    data: { ...calendar.emptyData(), requests: [request('archived', '2027-01-01', '2027-12-31')] } });
  const result = api.propose(input);
  assert.deepEqual(result.proposals, []); assert.ok(result.notices.length);
  assert.ok(result.people.every(person => person.warnings.length));
});

test('preview changes cannot adopt overlaps, out-of-year dates, over-budget days, sickness or newly added wishes', () => {
  const input = options({ budgets: { a: 12 } }), proposals = [request('a', '2027-02-01', '2027-02-13')];
  assert.deepEqual(api.assess({ ...input, proposals }).errors, []);
  for (const changes of [
    { proposals: [request('a', '2026-12-30', '2027-01-08')] },
    { proposals: [request('a', '2027-02-01', '2027-02-28')] },
    { proposals: [...proposals, request('a', '2027-02-02', '2027-02-03')] },
    { proposals: [request('a', '2027-02-30', '2027-03-05')] },
    { absences: [{ employeeId: 'a', type: 'sick', from: '2027-02-02', to: '2027-02-02' }] },
    { data: { ...calendar.emptyData(), requests: [request('a', '2027-05-01', '2027-05-08')] } }
  ]) assert.throws(() => api.adopt({ ...input, proposals, ...changes }, () => 'id'));
});
