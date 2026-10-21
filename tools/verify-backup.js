// Offline verification only: no credentials, network or production writes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

function verifyBackupBytes(bytes, expectedSha256) {
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (expectedSha256 && sha256 !== expectedSha256.toLowerCase()) throw Error('Prüfsumme stimmt nicht mit der exportierten Datei überein.');
  const payload = JSON.parse(bytes.toString('utf8'));
  const keys = { master: 'wochenplan_master_v10', plan: 'wochenplan_plan_v10', ui: 'wochenplan_ui_v10', theme: 'wochenplan_dark', calibration: 'mep-calibration' };
  const context = vm.createContext({ MASTER_KEY: keys.master, PLAN_KEY: keys.plan, UI_KEY: keys.ui });
  for (const file of ['backup-utils.js', 'storage-utils.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  const validated = context.validateAndNormalizeBackupData(payload);
  if (validated.error) throw Error(validated.error);
  const entries = new Map();
  const storage = { getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, String(v)), removeItem: k => entries.delete(k) };
  const restored = context.WochenplanStorage.create({ keys, storage });
  const result = restored.writeBatch(validated.backup.storage, { allowRecovery: true, source: 'offline-restore-check' });
  if (!result.ok) throw Error(result.error);
  // Re-open the actual journaled store, then compare every imported value.
  const reopened = context.WochenplanStorage.create({ keys, storage });
  if (reopened.blocked) throw Error(reopened.error);
  for (const [key, value] of Object.entries(validated.backup.storage)) {
    if (value === undefined) continue;
    const actual = key === keys.theme ? storage.getItem(key) : reopened.readJson(key, null);
    const expected = key === keys.theme && value !== null ? String(value) : value;
    assert.deepEqual(actual === null ? null : JSON.parse(JSON.stringify(actual)), expected === null ? null : JSON.parse(JSON.stringify(expected)), `Wiederherstellung unterscheidet sich: ${key}`);
  }
  let archiveEvents = null;
  if (payload.sharedArchive !== undefined) {
    if (payload.sharedArchive?.format !== 'wochenplan-filialarchiv-v1' || !Array.isArray(payload.sharedArchive.events)) throw Error('Filialarchiv ist unvollständig.');
    archiveEvents = payload.sharedArchive.events.length;
  }
  return { sha256, bytes: bytes.length, ...context.getBackupSummary(validated.backup), archiveEvents, restored: true };
}

if (require.main === module) {
  try {
    const [file, expectedSha256] = process.argv.slice(2);
    if (!file) throw Error('Aufruf: node tools/verify-backup.js DATEI.json [ERWARTETER_SHA256]');
    console.log(JSON.stringify(verifyBackupBytes(fs.readFileSync(file), expectedSha256), null, 2));
  } catch (error) {
    // Do not echo JSON parser errors: they can contain private file contents.
    console.error(error instanceof SyntaxError ? 'Die Sicherungsdatei ist kein vollständiges JSON.' : error.message);
    process.exitCode = 1;
  }
}
module.exports = { verifyBackupBytes };
