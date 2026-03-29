const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./test-helpers');

const ctx = loadScripts(['backup-utils.js'], {
  MASTER_KEY: 'wochenplan_master_v1',
  PLAN_KEY: 'wochenplan_plan_v1',
  UI_KEY: 'wochenplan_ui_v1'
});

test('validateBackupData accepts current storage envelope format', () => {
  const payload = {
    storage: {
      wochenplan_master_v1: { employees: [] },
      wochenplan_plan_v1: {},
      wochenplan_ui_v1: {}
    }
  };

  assert.equal(ctx.validateBackupData(payload), '');
});

test('validateBackupData accepts legacy top-level format', () => {
  const payload = {
    master: { employees: [] },
    plan: {},
    uiState: {}
  };

  assert.equal(ctx.validateBackupData(payload), '');
});

test('validateBackupData rejects invalid employee payload', () => {
  const payload = {
    storage: {
      wochenplan_master_v1: { employees: null },
      wochenplan_plan_v1: {},
      wochenplan_ui_v1: {}
    }
  };

  assert.match(ctx.validateBackupData(payload), /Stammdaten/);
});
