const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadScripts } = require('./test-helpers');

const payload = (code = 'F4') => ({ backupVersion: 2, createdAt: '2026-10-20', storage: {
  wochenplan_master_v10: { employees: [{ id: 'one', name: 'Test' }] },
  wochenplan_plan_v10: { schedule: { '2026-10-20': { one: { type: 'shift', code } } }, salesByDate: { '2026-10-20': 100 }, weekFrom: '2026-10-19' },
  wochenplan_ui_v10: { currentView: 'week' }
} });

function server(initial = null) {
  return { record: initial ? { revision: 1, payload: initial, updated_at: '2026-10-20' } : null, reads: 0, writes: 0, unavailable: false, beforeResult: null };
}
function client(db) {
  const user = { id: 'test-user', email: 'test@example.invalid' };
  return { auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    getSession: async () => ({ data: { session: { user } } }),
    signOut: async () => ({}),
    signInWithPassword: async () => ({ data: { user } })
  }, from() {
    let action = 'read', values = null; const filters = {};
    const query = {
      select() { return query; }, eq(key, value) { filters[key] = value; return query; },
      update(value) { action = 'update'; values = value; return query; },
      insert(value) { action = 'insert'; values = value; return query; },
      async maybeSingle() {
        if (db.unavailable) throw Error('offline');
        if (action === 'read') { db.reads++; return { data: structuredClone(db.record) }; }
        if (action === 'insert' && db.record) return { error: { code: '23505' } };
        if (action === 'update' && filters.revision !== db.record?.revision) return { data: null, error: { code: 'PGRST116', details: 'The result contains 0 rows' } };
        db.writes += 1;
        db.record = { ...structuredClone(values), updated_at: '2026-10-20' };
        const result = structuredClone(db.record);
        if (db.beforeResult) await db.beforeResult();
        return { data: result };
      }
    };
    return query;
  } };
}
function controller(t, db, initial = payload(), options = {}) {
  const ctx = loadScripts(['cloud-sync.js'], { crypto: options.crypto || webcrypto, TextEncoder, Uint8Array });
  const map = new Map(); let current = initial; let adopted = null;
  const c = ctx.WochenplanCloud.create({ client: client(db), storage: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) },
    projectRef: 'test', isPersonalActive: options.isPersonalActive, getSnapshot: () => current, applySnapshot: (value) => { adopted = value; }, delayMs: 100000 });
  t.after(() => c.dispose());
  return { c, map, set(value) { current = value; }, get adopted() { return adopted; }, fingerprint: ctx.WochenplanCloud.fingerprint };
}

test('first connection never uploads a local plan without selecting it', async (t) => {
  const db = server(); const { c } = controller(t, db); await c.start();
  assert.equal(c.status.mode, 'first-upload');
  assert.equal(await c.save(), false);
  assert.equal(db.writes, 0);
});

test('membership lookup and an existing workplace block legacy reads and uploads', async t => {
  const db=server(payload());const f=controller(t,db,payload(),{isPersonalActive:()=>false});
  await f.c.start();assert.equal(db.reads,0);assert.equal(await f.c.save({overwrite:true}),false);assert.equal(db.writes,0);
});

test('selecting the workplace during a legacy fingerprint prevents a write or import', async t => {
  let active=true,hold=false,entered,release;
  let started,gate;
  const crypto={subtle:{digest:async(...args)=>{if(hold){hold=false;entered();await gate;}return webcrypto.subtle.digest(...args);}}};
  const db=server(payload());const f=controller(t,db,payload(),{crypto,isPersonalActive:()=>active});await f.c.start();f.set(payload('F6'));
  started=new Promise(r=>entered=r);gate=new Promise(r=>release=r);hold=true;
  const saving=f.c.save();await started;active=false;release();assert.equal(await saving,false);assert.equal(db.writes,0);
  active=true;started=new Promise(r=>entered=r);gate=new Promise(r=>release=r);hold=true;
  const adopting=f.c.adopt();await started;active=false;release();assert.equal(await adopting,false);assert.equal(f.adopted,null);
});

test('different local and online plans require a choice; neither is overwritten', async (t) => {
  const db = server(payload('F6')); const f = controller(t, db); await f.c.start();
  assert.equal(f.c.status.mode, 'choose');
  assert.equal(await f.c.save(), false);
  assert.equal(f.adopted, null);
  assert.equal(db.record.payload.storage.wochenplan_plan_v10.schedule['2026-10-20'].one.code, 'F6');
});

test('explicit first upload links the device and later edits increment the revision', async (t) => {
  const db = server(); const f = controller(t, db); await f.c.start();
  assert.equal(await f.c.save({ overwrite: true }), true);
  assert.equal(db.record.revision, 1);
  f.set(payload('F6'));
  assert.equal(await f.c.save(), true);
  assert.equal(db.record.revision, 2);
  assert.equal(f.c.status.mode, 'synced');
});

test('two devices cannot silently overwrite each other with a stale revision', async (t) => {
  const db = server(payload()); const a = controller(t, db); const b = controller(t, db);
  await a.c.start(); await b.c.start();
  a.set(payload('F6')); assert.equal(await a.c.save(), true);
  b.set(payload('F3')); assert.equal(await b.c.save(), false);
  assert.equal(b.c.status.mode, 'choose');
  assert.equal(db.record.revision, 2);
  assert.equal(db.record.payload.storage.wochenplan_plan_v10.schedule['2026-10-20'].one.code, 'F6');
  assert.equal(await b.c.save(), false);
});

test('reconnecting after another device changed the online plan pauses automatic uploads', async (t) => {
  const db = server(payload()); const f = controller(t, db); await f.c.start();
  f.set(payload('F3')); db.record = { ...db.record, revision: 2, payload: payload('F6') };
  await f.c.refresh();
  assert.equal(f.c.status.mode, 'choose');
  assert.equal(db.writes, 0);
});

test('UI, export timestamp and navigation changes do not create new online revisions', async (t) => {
  const db = server(payload()); const f = controller(t, db); await f.c.start();
  const next = payload(); next.createdAt = 'later'; next.storage.wochenplan_ui_v10.currentView = 'month'; next.storage.wochenplan_plan_v10.weekFrom = '2026-10-26';
  f.set(next); assert.equal(await f.c.save(), true);
  assert.equal(db.writes, 0);
});

test('sales changes are included in cloud change detection', async (t) => {
  const db = server(payload()); const f = controller(t, db); await f.c.start();
  const next = payload(); next.storage.wochenplan_plan_v10.salesByDate['2026-10-20'] = 250;
  f.set(next); await f.c.save(); assert.equal(db.writes, 1);
  assert.equal(db.record.payload.storage.wochenplan_plan_v10.salesByDate['2026-10-20'], 250);
});

test('edits made during an in-flight save remain pending and are not marked synced', async (t) => {
  const db = server(payload()); const f = controller(t, db); await f.c.start();
  f.set(payload('F5')); db.beforeResult = async () => { f.set(payload('F6')); };
  await f.c.save();
  assert.equal(db.record.payload.storage.wochenplan_plan_v10.schedule['2026-10-20'].one.code, 'F5');
  assert.equal(f.c.status.mode, 'pending');
});

test('network failure leaves the local plan and last known revision available for retry', async (t) => {
  const db = server(payload()); const f = controller(t, db); await f.c.start(); f.set(payload('F6'));
  db.unavailable = true; assert.equal(await f.c.save(), false); assert.equal(f.c.status.mode, 'offline');
  db.unavailable = false; assert.equal(await f.c.save(), true); assert.equal(db.record.revision, 2);
});

test('adopting a chosen cloud snapshot applies it before marking the device linked', async (t) => {
  const db = server(payload('F6')); const f = controller(t, db); await f.c.start();
  assert.equal(await f.c.adopt(), true);
  assert.equal(f.adopted.storage.wochenplan_plan_v10.schedule['2026-10-20'].one.code, 'F6');
  assert.equal(f.c.status.mode, 'synced');
});

test('concurrent first uploads do not replace the first device plan', async (t) => {
  const db = server(); const a = controller(t, db); const b = controller(t, db, payload('F6'));
  await a.c.start(); await b.c.start();
  await a.c.save({ overwrite: true }); assert.equal(await b.c.save({ overwrite: true }), false);
  assert.equal(db.writes, 1); assert.equal(b.c.status.mode, 'choose');
});

test('signing out stops uploads and preserves local planning data', async (t) => {
  const db = server(payload()); const f = controller(t, db); await f.c.start(); await f.c.signOut();
  f.set(payload('F6')); assert.equal(await f.c.save(), false);
  assert.equal(f.c.status.user, null); assert.equal(db.writes, 0); assert.equal(f.adopted, null);
});
