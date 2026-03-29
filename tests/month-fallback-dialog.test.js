const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./test-helpers');

function buildSimpleDocumentStub() {
  return {
    activeElement: null,
    getElementById: () => null,
    addEventListener: () => {},
    body: { style: {}, dataset: {} }
  };
}

test('month fallback options are limited to G/U/K/AH/FLEX and include FLEX', () => {
  const ctx = loadScripts([
    'time-utils.js',
    'shift-rules.js',
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
  assert.ok(!codes.includes('L'));
  assert.ok(!codes.includes('FO'));
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
