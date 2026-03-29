const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./test-helpers');

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.listeners = new Map();
    this.value = '';
    this.disabled = false;
    this.className = '';
    this.textContent = '';
    this.innerHTML = '';
    this.title = '';
    this.dataset = {};
    this.classList = {
      add: () => {},
      remove: () => {},
      toggle: () => false
    };
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  dispatchEvent(type, event = {}) {
    const handlers = this.listeners.get(type) || [];
    handlers.forEach((handler) => handler({ target: this, ...event }));
  }

  querySelector() {
    return null;
  }

  setAttribute() {}
  focus() {}
}

function buildContext() {
  const elementsById = new Map();
  const document = {
    createElement: (tagName) => new MockElement(tagName),
    getElementById: (id) => {
      if (!elementsById.has(id)) elementsById.set(id, new MockElement('div'));
      return elementsById.get(id);
    },
    addEventListener: () => {},
    activeElement: null
  };

  return loadScripts(['week-view.js'], {
    document,
    window: { addEventListener: () => {} },
    HTMLElement: MockElement,
    alert: () => {},
    confirm: () => true,
    state: { absences: [], schedule: {}, employees: [] },
    getShiftSelectOptions: () => [
      { group: 'Schichten', value: '-', label: '-' },
      { group: 'Schichten', value: 'FO', label: 'FO' },
      { group: 'Abwesenheiten', value: 'K', label: 'K' }
    ],
    getWeekCellFlags: () => ({ isLateToEarlyBridge: false }),
    isClosingResolvedEntry: () => false,
    isEarlyStartEntry: () => false,
    getResolvedEntryForEmployeeOnIso: () => ({ type: 'none' }),
    getDialogTypeFromResolvedEntry: () => null,
    getShiftCodeForSelectValue: (value) => value,
    getShiftClassByKey: () => 'free',
    isDialogShift: () => false,
    openShiftDialog: () => {},
    getBlockingTypeForEmployeeOnIso: () => null,
    buildEarlyShiftEntry: (code) => ({ type: 'shift', code }),
    setPlanEntry: () => {},
    clearDay: () => {},
    commitPlanChange: () => {},
    subtractRangeFromAbsenceEntry: (entry) => [entry],
    saveAppStateDebounced: () => {},
    renderAllViews: () => {},
    fromIsoDate: () => new Date('2026-03-29T00:00:00Z'),
    toIsoDate: () => '2026-03-29',
    syncVacationScheduleFromAbsences: () => {},
    setAbsence: () => {},
    clearPlanEntry: () => {},
    getPlanEntry: () => null,
    diffMinutesBetweenHHMM: () => 60,
    getExternalHelpBreakDeductionMinutes: () => 0,
    getExternalHelpWorkedMinutes: () => 60,
    normalizePlanTime: (v) => v,
    isAllowedPlanTime: () => true,
    ENTRY_STATUS: { EXTERNAL: 'external' },
    getShiftRuleByCode: () => ({ entryType: 'shift' }),
    buildLateShiftEntry: () => ({ type: 'shift' }),
    buildFullShiftEntry: () => ({ type: 'shift' }),
    buildFoShiftEntry: () => ({ type: 'shift' }),
    buildFlexibleShiftEntry: () => ({ type: 'shift' }),
    getQuarterPickerValue: () => '08:00',
    addMinutesToHHMM: () => '09:00',
    formatQuarterHourTime: () => '00:00',
    hhmmToMinutes: () => 0,
    minutesToHM: () => '0:00',
    getEmployeeTargetMinutesForWeek: () => 0,
    formatSignedMinutes: () => '0:00',
    getAbsenceTypeMeta: () => ({ invalidRangeMessage: 'x', confirmDeleteMessage: 'x', title: 'x' }),
    getAbsenceTypeFromDialogContext: (v) => (v === 'K' ? 'sick' : 'vacation')
  });
}

test('vacation day can be changed directly to shift and only that day is removed from absence coverage', () => {
  const ctx = buildContext();
  const calls = [];

  ctx.getWeekSelectValueForDay = () => 'U';
  ctx.getBlockingTypeForEmployeeOnIso = () => 'vacation';
  ctx.removeAbsenceCoverageForEmployee = (...args) => calls.push(['remove', ...args]);
  ctx.clearDay = (...args) => calls.push(['clearDay', ...args]);
  ctx.setPlanEntry = (...args) => calls.push(['setPlanEntry', ...args]);

  const wrap = ctx.createWeekSelect({ id: 'e1' }, '2026-04-02');
  const select = wrap.children[0];
  select.value = 'FO';
  select.dispatchEvent('change');

  assert.deepEqual(calls[0], ['remove', 'e1', '2026-04-02', '2026-04-02', 'vacation']);
  assert.equal(calls.some((entry) => entry[0] === 'setPlanEntry'), true);
});

test('vacation day can directly switch to sick absence (other absence type)', () => {
  const ctx = buildContext();
  const calls = [];

  ctx.getWeekSelectValueForDay = () => 'U';
  ctx.getBlockingTypeForEmployeeOnIso = () => 'vacation';
  ctx.removeAbsenceCoverageForEmployee = (...args) => calls.push(args);
  ctx.openShiftDialogForSelectValue = () => true;

  const wrap = ctx.createWeekSelect({ id: 'e1' }, '2026-04-03');
  const select = wrap.children[0];
  select.value = 'K';
  select.dispatchEvent('change');

  assert.deepEqual(calls[0], ['e1', '2026-04-03', '2026-04-03', 'vacation']);
});

test('vacation day can be cleared with "-" and removes vacation coverage for that day', () => {
  const ctx = buildContext();
  const calls = [];

  ctx.getWeekSelectValueForDay = () => 'U';
  ctx.getBlockingTypeForEmployeeOnIso = () => 'vacation';
  ctx.removeAbsenceCoverageForEmployee = (...args) => calls.push(args);

  const wrap = ctx.createWeekSelect({ id: 'e1' }, '2026-04-04');
  const select = wrap.children[0];
  select.value = '-';
  select.dispatchEvent('change');

  assert.deepEqual(calls[0], ['e1', '2026-04-04', '2026-04-04', 'vacation']);
});

test('holiday remains locked and disabled', () => {
  const ctx = buildContext();
  ctx.getWeekSelectValueForDay = () => 'H';
  ctx.getBlockingTypeForEmployeeOnIso = () => 'holiday';

  const wrap = ctx.createWeekSelect({ id: 'e1' }, '2026-12-25');
  const select = wrap.children[0];

  assert.equal(select.disabled, true);
  assert.equal(select.value, 'H');
  assert.equal(select.children.length, 1);
  assert.equal(select.children[0].value, 'H');
});
