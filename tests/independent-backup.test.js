const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyBackupBytes } = require('../tools/verify-backup');
const fixture = () => ({ backupVersion: 2, storage: {
  wochenplan_master_v10: { employees: [{ id: 'synthetic', name: 'Testperson' }] },
  wochenplan_plan_v10: {
    schedule: { '2026-10-21': { synthetic: { type: 'shift', code: 'F4', start: '09:00', end: '13:00' } } },
    absences: [], salesByDate: { '2026-10-21': 450 },
    monthlyPlanBaselines: { '2026-10': { entries: { '2026-10-21': { synthetic: { code: 'F4' } } } } }
  }, wochenplan_ui_v10: {}, wochenplan_dark: 'false', 'mep-calibration': { x: 42 }
} });
const bytes = value => Buffer.from(JSON.stringify(value));
test('independent backup restores all plan fields and verifies identical downloaded bytes', () => {
  const data = bytes(fixture()), result = verifyBackupBytes(data);
  assert.equal(result.restored, true); assert.equal(result.employees, 1); assert.equal(result.shifts, 1);
  assert.equal(result.bytes, data.length); assert.deepEqual(verifyBackupBytes(data, result.sha256), result);
  const changed = fixture(); changed.storage.wochenplan_plan_v10.salesByDate['2026-10-21'] = 451;
  assert.throws(() => verifyBackupBytes(bytes(changed), result.sha256), /Prüfsumme/);
});
test('truncated or missing plan content never counts as a successful backup', () => {
  assert.throws(() => verifyBackupBytes(Buffer.from('{"backupVersion":2')));
  const invalid = fixture(); delete invalid.storage.wochenplan_plan_v10;
  assert.throws(() => verifyBackupBytes(bytes(invalid)), /Planungsdaten/);
});
test('an unset theme and absent optional calibration remain restorable', () => {
  const data = fixture(); data.storage.wochenplan_dark = null; delete data.storage['mep-calibration'];
  assert.equal(verifyBackupBytes(bytes(data)).restored, true);
});
test('shared archive history stays in the original file and has an explicit count', () => {
  const data = fixture(); data.sharedArchive = { format: 'wochenplan-filialarchiv-v1', events: [{ id: 1, kind: 'created' }] };
  const encoded = bytes(data); assert.equal(verifyBackupBytes(encoded).archiveEvents, 1);
  assert.deepEqual(JSON.parse(encoded).sharedArchive, data.sharedArchive);
  delete data.sharedArchive.events;
  assert.throws(() => verifyBackupBytes(bytes(data)), /Filialarchiv/);
});
