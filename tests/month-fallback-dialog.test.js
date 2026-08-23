const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./test-helpers');
const fs = require('node:fs');

function buildSimpleDocumentStub() {
  return {
    activeElement: null,
    getElementById: () => null,
    addEventListener: () => {},
    body: { style: {}, dataset: {} }
  };
}

test('month fallback options use the complete central week selection source', () => {
  const ctx = loadScripts([
    'time-utils.js',
    'shift-rules.js',
    'month-engine.js',
    'month-view.js'
  ], {
    document: buildSimpleDocumentStub()
  });

  const options = ctx.getMonthFallbackDialogOptions();
  const codes = options.map((option) => option.code);

  assert.ok(codes.includes('G'));
  assert.ok(codes.includes('U'));
  assert.ok(codes.includes('K'));
  assert.ok(codes.includes('AH'));
  assert.ok(codes.includes('FLEX'));
  assert.ok(codes.includes('L'));
  assert.ok(codes.includes('FO'));
  assert.ok(codes.includes('F3'));
  assert.ok(codes.includes('FR'));
  assert.deepEqual(codes, ctx.getShiftSelectOptions().map((option) => ctx.getShiftCodeForSelectValue(option.value)));
});

test('month planning menu groups early and late shifts around one Flex editor', () => {
  const source = fs.readFileSync('month-view.js', 'utf8');
  const main = source.match(/function renderMonthFallbackMainLevel[\s\S]*?\n\}/)?.[0] || '';
  const early = source.match(/function renderMonthFallbackEarlyLevel[\s\S]*?\n\}/)?.[0] || '';
  const late = source.match(/function renderMonthFallbackLateLevel[\s\S]*?\n\}/)?.[0] || '';
  const more = source.match(/function renderMonthFallbackMoreLevel[\s\S]*?\n\}/)?.[0] || '';

  assert.match(main, /createButton\("Früh"/);
  assert.match(main, /createButton\("Spät"/);
  assert.match(main, /"G", "FLEX", "FR", "U"/);
  assert.match(main, /code === "FLEX"[\s\S]*renderMonthFallbackFlexEditor/);
  assert.doesNotMatch(main, /Individuell/);
  assert.match(early, /\["F3", "F4", "F5", "F6", "FO"\]/);
  assert.match(early, /renderMonthFallbackSubmenu/);
  assert.match(late, /\["L"\]/);
  assert.match(late, /renderMonthFallbackSubmenu/);
  assert.match(more, /"F3", "F4", "F5", "F6"/);
  assert.match(more, /!groupedCodes\.has/);
  assert.equal((source.match(/function renderMonthFallbackFlexEditor/g) || []).length, 1);
});

test('month selections pass normalized dialog codes and apply F3-F6 directly', () => {
  const env = buildInteractiveDocumentStub();
  const dialogCalls = [];
  const directCalls = [];
  const ctx = loadScripts([
    'status-utils.js',
    'time-utils.js',
    'shift-rules.js',
    'month-engine.js',
    'month-view.js'
  ], {
    document: env.doc,
    openShiftDialogForSelectValue(code, context) {
      dialogCalls.push({ code, context });
      return ['FO', 'L', 'G', 'FLEX'].includes(code);
    },
    applyWeekSelection(emp, isoDate, value) {
      directCalls.push({ emp, isoDate, value });
      return { applied: false };
    }
  });
  const emp = { id: 'emp-dialog', name: 'Dialog' };

  for (const [value, expectedCode] of [['FÖ', 'FO'], ['L', 'L'], ['G', 'G'], ['FLEX', 'FLEX']]) {
    ctx.openMonthFallbackDialog(emp, '2026-03-20');
    ctx.selectMonthFallbackOption(value);
    assert.equal(dialogCalls.at(-1).code, expectedCode);
    assert.equal(dialogCalls.at(-1).context.source, 'month');
    assert.equal(directCalls.length, 0);
  }

  for (const code of ['F3', 'F4', 'F5', 'F6']) {
    ctx.openMonthFallbackDialog(emp, '2026-03-21');
    ctx.selectMonthFallbackOption(code);
    assert.equal(dialogCalls.at(-1).code, code);
    assert.equal(directCalls.at(-1).value, code);
  }
  assert.equal(directCalls.length, 4);
});

test('last month shift accepts only work and keeps a deep independent template', () => {
  const ctx = loadScripts([
    'status-utils.js',
    'time-utils.js',
    'shift-rules.js',
    'month-engine.js',
    'month-view.js'
  ], { document: buildSimpleDocumentStub() });
  const fixed = {
    type: 'shift', status: 'work', code: 'F3', mode: 'early', start: '09:00', end: '15:00',
    pause: 0, breakMinutes: 0, minutes: 360, meta: { ruleCode: 'F3', checkout: false }
  };

  assert.equal(ctx.rememberLastMonthWorkShift(fixed), true);
  const copied = ctx.getLastMonthWorkShift();
  assert.notEqual(copied, fixed);
  assert.notEqual(copied.meta, fixed.meta);
  copied.meta.checkout = true;
  assert.equal(ctx.getLastMonthWorkShift().meta.checkout, false);
  assert.equal(ctx.getLastMonthWorkShiftLabel(), 'F3');

  for (const entry of [
    { type: 'vacation', status: 'vacation', code: 'U' },
    { type: 'sick', status: 'sick', code: 'K' },
    { type: 'off', status: 'off', code: 'FR' },
    { type: 'external-help', status: 'external', code: 'AH', externalHelp: true },
    null
  ]) assert.equal(ctx.rememberLastMonthWorkShift(entry), false);
  assert.equal(ctx.getLastMonthWorkShift().code, 'F3');
});

test('FLEX template retains manual pause and net minutes when cloned', () => {
  const ctx = loadScripts([
    'status-utils.js', 'time-utils.js', 'shift-rules.js', 'month-engine.js', 'month-view.js'
  ], { document: buildSimpleDocumentStub() });
  const flex = {
    type: 'shift', status: 'work', code: 'FLEX', shiftKey: 'FLEX', mode: 'flex',
    start: '11:00', end: '18:00', pause: 60, breakMinutes: 60, minutes: 360,
    meta: { ruleCode: 'FLEX' }
  };

  ctx.rememberLastMonthWorkShift(flex);
  const copied = ctx.getLastMonthWorkShift();
  assert.deepEqual(JSON.parse(JSON.stringify(copied)), flex);
  assert.notEqual(copied, flex);
  assert.notEqual(copied.meta, flex.meta);
  assert.equal(ctx.getLastMonthWorkShiftLabel(), 'Flex 11:00–18:00');

  const checkout = {
    ...flex,
    end: '19:10',
    minutes: 430,
    withCheckout: true,
    meta: { ruleCode: 'FLEX', checkoutEnd: '19:10' }
  };
  ctx.rememberLastMonthWorkShift(checkout);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.getLastMonthWorkShift())), checkout);
  assert.equal(ctx.getLastMonthWorkShiftLabel(), 'Flex 11:00–19:10');
});

test('last-shift quick action is rendered only after a valid work shift was remembered', () => {
  const env = buildInteractiveDocumentStub();
  const ctx = loadScripts([
    'status-utils.js', 'time-utils.js', 'shift-rules.js', 'month-engine.js', 'month-view.js'
  ], { document: env.doc });
  const emp = { id: 'emp-quick', name: 'Quick' };

  ctx.openMonthFallbackDialog(emp, '2026-03-18');
  assert.equal(env.optionsContainer.children.some((button) => button.textContent.startsWith('↻')), false);
  ctx.closeMonthFallbackDialog();
  ctx.rememberLastMonthWorkShift({ type: 'shift', status: 'work', code: 'F4', mode: 'early' });
  ctx.openMonthFallbackDialog(emp, '2026-03-19');
  assert.equal(env.optionsContainer.children.find((button) => button.textContent.startsWith('↻'))?.textContent, '↻ F4');
});

function buildInteractiveDocumentStub() {
  const listeners = {};
  let buttonId = 0;

  function createClassList(initial = []) {
    const classes = new Set(initial);
    return {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name)
    };
  }

  function createElementStub(tagName) {
    const element = {
      tagName,
      className: '',
      textContent: '',
      dataset: {},
      attributes: {},
      children: [],
      listeners: {},
      appendChild(child) {
        this.children.push(child);
      },
      querySelector(selector) {
        if (selector === 'button') return this.children.find((child) => child.tagName === 'button') || null;
        return null;
      },
      addEventListener(type, handler) {
        this.listeners[type] = handler;
      },
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      focus() {
        doc.activeElement = this;
      }
    };

    if (tagName === 'button') {
      element.id = `btn-${++buttonId}`;
    }

    return element;
  }

  const optionsContainer = {
    children: [],
    appendChild(child) {
      this.children.push(child);
    },
    querySelector(selector) {
      if (selector === 'button') return this.children[0] || null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'button') return [...this.children];
      return [];
    }
  };

  Object.defineProperty(optionsContainer, 'innerHTML', {
    get() {
      return '';
    },
    set() {
      this.children = [];
    }
  });

  const overlay = {
    classList: createClassList(['hidden']),
    attributes: {},
    addEventListener() {},
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }
  };

  const cancelButton = createElementStub('button');
  const previousFocus = createElementStub('button');

  const idMap = {
    monthFallbackOverlay: overlay,
    monthFallbackOptions: optionsContainer,
    monthFallbackCancel: cancelButton
  };

  const doc = {
    body: { style: {}, dataset: {} },
    activeElement: previousFocus,
    getElementById(id) {
      return idMap[id] || null;
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    createElement(tagName) {
      return createElementStub(tagName);
    }
  };

  return {
    doc,
    overlay,
    previousFocus,
    optionsContainer,
    keydown: (event) => listeners.keydown?.(event)
  };
}

test('Escape closes month fallback dialog and restores previous focus', () => {
  const env = buildInteractiveDocumentStub();
  const ctx = loadScripts([
    'time-utils.js',
    'shift-rules.js',
    'month-engine.js',
    'month-view.js'
  ], {
    document: env.doc
  });

  const emp = { id: 'emp-1', name: 'Max' };
  ctx.openMonthFallbackDialog(emp, '2026-03-16');

  assert.equal(env.overlay.classList.contains('hidden'), false);
  assert.equal(env.doc.body.style.overflow, 'hidden');
  assert.notEqual(env.doc.activeElement, env.previousFocus);

  let preventDefaultCalled = false;
  env.keydown({
    key: 'Escape',
    preventDefault: () => {
      preventDefaultCalled = true;
    }
  });

  assert.equal(preventDefaultCalled, true);
  assert.equal(env.overlay.classList.contains('hidden'), true);
  assert.equal(env.doc.activeElement, env.previousFocus);
  assert.equal(env.doc.body.style.overflow, '');
});

test('month fallback dialog ignores non-focusable previous activeElement safely', () => {
  const env = buildInteractiveDocumentStub();
  env.doc.activeElement = { id: 'not-focusable' };
  const ctx = loadScripts([
    'time-utils.js',
    'shift-rules.js',
    'month-engine.js',
    'month-view.js'
  ], {
    document: env.doc
  });

  const emp = { id: 'emp-2', name: 'Anna' };
  assert.doesNotThrow(() => {
    ctx.openMonthFallbackDialog(emp, '2026-03-17');
    ctx.closeMonthFallbackDialog();
  });
  assert.equal(env.overlay.classList.contains('hidden'), true);
});
