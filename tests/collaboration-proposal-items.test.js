const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { buildUpgrade } = require('../tools/build-proposal-items-upgrade');
const owner = '30000000-0000-4000-8000-000000000001';
const deputy = '30000000-0000-4000-8000-000000000002';
const outsider = '30000000-0000-4000-8000-000000000003';
const fixture = () => ({ backupVersion: 2, storage: {
 wochenplan_master_v10: { employees: [{ id: 'a', name: 'Test A' }, { id: 'b', name: 'Test B' }] },
 wochenplan_plan_v10: { schedule: { '2026-10-19': { a: { code: 'F4' }, b: { code: 'F4' } } }, absences: [], salesByDate: {} }, wochenplan_ui_v10: {}
} });
async function setup() {
 const db = new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
  insert into auth.users values('${owner}'),('${deputy}'),('${outsider}');`);
 await db.exec(fs.readFileSync('supabase/collaboration-schema.sql', 'utf8'));
 async function rpc(user, action, args = {}) {
  await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);await db.exec('set role authenticated');
  return (await db.query('select public.wochenplan_collaboration($1,$2::jsonb) as data', [action, JSON.stringify(args)])).rows[0].data;
 }
 const { id: branch_id } = await rpc(owner, 'create', { name: 'Test', display_name: 'TL', payload: fixture() });
 const args = extra => ({ branch_id, ...extra });
 const invite = await rpc(owner, 'invite', args());
 await rpc(deputy, 'accept_invite', { token: invite.token, display_name: 'SV' });
 return { db, rpc, args };
}
test('partial decisions persist on both devices, reject exactly one item, and retain attributed history', async () => {
 const { db, rpc, args } = await setup();
 try {
  const proposed = fixture();
  proposed.storage.wochenplan_plan_v10.schedule['2026-10-19'].a.code = 'F5';
  proposed.storage.wochenplan_plan_v10.schedule['2026-10-19'].b.code = 'F6';
  proposed.storage.wochenplan_plan_v10.salesByDate['2026-10-20'] = 450;
  await rpc(deputy, 'propose', args({ expected_revision: 1, payload: proposed, reason: 'Drei Änderungen' }));
  let plan = await rpc(owner, 'read', args());
  assert.equal(plan.capabilities.proposal_items, true);
  const id = plan.proposals[0].id;
  const indices = plan.proposals[0].changes.map((c, i) => [c.path.at(-1), i]);
  const index = key => indices.find(([k]) => k === key)[1];
  await rpc(owner, 'decide_proposal_items', args({ id, indices: [index('a')], decision: 'accepted', expected_revision: 1 }));
  plan = await rpc(deputy, 'read', args());
  assert.equal(plan.revision, 2);assert.equal(plan.proposals[0].status, 'pending');assert.equal(plan.proposals[0].decided_at, null);
  assert.equal(plan.payload.storage.wochenplan_plan_v10.schedule['2026-10-19'].a.code, 'F5');
  assert.equal(plan.payload.storage.wochenplan_plan_v10.schedule['2026-10-19'].b.code, 'F4');
  assert.equal(plan.proposals[0].changes[index('a')].decided_by, owner);
  await assert.rejects(rpc(owner, 'decide_proposal_items', args({ id, indices: [index('a')], decision: 'rejected' })), /ITEM_ALREADY_DECIDED/);
  await rpc(owner, 'decide_proposal_items', args({ id, indices: [index('b')], decision: 'rejected' }));
  plan = await rpc(deputy, 'read', args());assert.equal(plan.revision, 2);assert.equal(plan.proposals[0].status, 'pending');
  // An old client deciding the whole proposal must only affect the open remainder.
  await rpc(owner, 'decide_proposal', args({ id, decision: 'accepted', expected_revision: 2 }));
  plan = await rpc(deputy, 'read', args());assert.equal(plan.revision, 3);assert.equal(plan.proposals[0].status, 'mixed');assert.ok(plan.proposals[0].decided_at);
  assert.equal(plan.payload.storage.wochenplan_plan_v10.schedule['2026-10-19'].b.code, 'F4');
  assert.equal(plan.payload.storage.wochenplan_plan_v10.salesByDate['2026-10-20'], 450);
  const history = await rpc(owner, 'history', args());
  const rejection = history.find(e => e.kind === 'decide_proposal_items' && e.changes[0].decision === 'rejected');
  assert.equal(rejection.revision, null);assert.equal(rejection.actor_id, owner);assert.equal(rejection.changes.length, 1);
  assert.equal(rejection.changes[0].proposal_id, id);
  const acceptance = history.find(e => e.kind === 'decide_proposal_items' && e.changes[0].decision === 'accepted');
  await rpc(owner, 'revert', args({ id: acceptance.id, expected_revision: 3 }));
  plan = await rpc(owner, 'read', args());assert.equal(plan.payload.storage.wochenplan_plan_v10.schedule['2026-10-19'].a.code, 'F4');
  assert.equal(plan.payload.storage.wochenplan_plan_v10.salesByDate['2026-10-20'], 450);
 } finally { await db.close(); }
});
test('item decisions enforce ownership, valid selections, stale/repeated decisions and atomic conflicts', async () => {
 const { db, rpc, args } = await setup();
 try {
  const proposed = fixture();for (const shift of Object.values(proposed.storage.wochenplan_plan_v10.schedule['2026-10-19'])) shift.code = 'F6';
  await rpc(deputy, 'propose', args({ expected_revision: 1, payload: proposed, reason: 'Konflikte' }));
  const plan = await rpc(owner, 'read', args()), id = plan.proposals[0].id;
  const accept = { id, indices: [0], decision: 'accepted', expected_revision: 1 };
  await assert.rejects(rpc(deputy, 'decide_proposal_items', args(accept)), /OWNER_REQUIRED/);
  await assert.rejects(rpc(outsider, 'decide_proposal_items', args(accept)), /ACCESS_DENIED/);
  for (const indices of [null, [], [-1], [2], [0, 0], ['0'], [0.5], [true], [999999999999999999999]]) {
   await assert.rejects(rpc(owner, 'decide_proposal_items', args({ ...accept, indices })), /INVALID_SELECTION/);
  }
  await assert.rejects(rpc(owner, 'decide_proposal_items', args({ ...accept, decision: null })), /INVALID_DECISION/);
  const latest = fixture();latest.storage.wochenplan_plan_v10.schedule['2026-10-19'].a.code = 'F5';
  await rpc(owner, 'save', args({ expected_revision: 1, payload: latest }));
  await assert.rejects(rpc(owner, 'decide_proposal_items', args(accept)), /REVISION_CONFLICT/);
  await assert.rejects(rpc(owner, 'decide_proposal_items', args({ ...accept, indices: [0, 1], expected_revision: 2 })), /CHANGE_CONFLICT/);
  let after = await rpc(owner, 'read', args());assert.equal(after.revision, 2);assert.deepEqual(after.payload, latest);
  assert.ok(after.proposals[0].changes.every(c => !c.decision), 'failed batch must leave every item open');
  await rpc(owner, 'decide_proposal_items', args({ ...accept, indices: [1], expected_revision: 2 }));
  after = await rpc(owner, 'read', args());assert.equal(after.payload.storage.wochenplan_plan_v10.schedule['2026-10-19'].a.code, 'F5');
  assert.equal(after.payload.storage.wochenplan_plan_v10.schedule['2026-10-19'].b.code, 'F6');
  await rpc(owner, 'decide_proposal_items', args({ id, indices: [0], decision: 'rejected' }));
  after = await rpc(owner, 'read', args());assert.equal(after.proposals[0].status, 'mixed');
 } finally { await db.close(); }
});
test('partial acceptance requires team dependencies and permits complete removal bundles', async () => {
 const { db, rpc, args } = await setup();
 try {
  const proposed = fixture();
  proposed.storage.wochenplan_master_v10.employees.push({ id: 'new-person', name: 'New synthetic colleague' });
  proposed.storage.wochenplan_plan_v10.schedule['2026-10-19']['new-person'] = { code: 'F5' };
  await rpc(deputy, 'propose', args({ expected_revision: 1, payload: proposed, reason: 'Neue Person und Schicht' }));
  let before = await rpc(owner, 'read', args());const id = before.proposals[0].id;
  const shift = before.proposals[0].changes.findIndex(c => c.path.at(-1) === 'new-person');
  const team = before.proposals[0].changes.findIndex(c => c.path.at(-1) === 'employees');
  const history = await rpc(owner, 'history', args());
  await assert.rejects(rpc(owner, 'decide_proposal_items', args({ id, indices: [shift], decision: 'accepted', expected_revision: 1 })), /DEPENDENT_CHANGE/);
  let plan = await rpc(deputy, 'read', args());
  assert.deepEqual(plan.payload, before.payload);assert.equal(plan.revision, 1);
  assert.deepEqual(plan.proposals, before.proposals);assert.deepEqual(plan.snapshots, before.snapshots);
  assert.deepEqual(await rpc(owner, 'history', args()), history, 'dependency failure must be fully atomic');
  await rpc(owner, 'decide_proposal_items', args({ id, indices: [team], decision: 'accepted', expected_revision: 1 }));
  await rpc(owner, 'decide_proposal_items', args({ id, indices: [shift], decision: 'accepted', expected_revision: 2 }));
  plan = await rpc(deputy, 'read', args());assert.equal(plan.proposals[0].status, 'accepted');
  assert.equal(plan.payload.storage.wochenplan_plan_v10.schedule['2026-10-19']['new-person'].code, 'F5');
  const removed = structuredClone(plan.payload);
  removed.storage.wochenplan_master_v10.employees = removed.storage.wochenplan_master_v10.employees.filter(e => e.id !== 'new-person');
  delete removed.storage.wochenplan_plan_v10.schedule['2026-10-19']['new-person'];
  await rpc(deputy, 'propose', args({ expected_revision: 3, payload: removed, reason: 'Person samt Eintrag entfernen' }));
  before = await rpc(owner, 'read', args());const removal = before.proposals.find(p => p.status === 'pending');
  const removeTeam = removal.changes.findIndex(c => c.path.at(-1) === 'employees');
  await assert.rejects(rpc(owner, 'decide_proposal_items', args({ id: removal.id, indices: [removeTeam], decision: 'accepted', expected_revision: 3 })), /DEPENDENT_CHANGE/);
  await rpc(owner, 'decide_proposal', args({ id: removal.id, decision: 'accepted', expected_revision: 3 }));
  plan = await rpc(deputy, 'read', args());assert.deepEqual(plan.payload, removed);assert.equal(plan.revision, 4);
 } finally { await db.close(); }
});
test('absence dependencies are protected and a new person plus absence can be accepted together', async () => {
 const { db, rpc, args } = await setup();
 try {
  const proposed = fixture();proposed.storage.wochenplan_master_v10.employees.push({ id: 'new-person', name: 'New synthetic colleague' });
  proposed.storage.wochenplan_plan_v10.absences.push({ employeeId: 'new-person', from: '2026-10-19', to: '2026-10-20', type: 'vacation' });
  await rpc(deputy, 'propose', args({ expected_revision: 1, payload: proposed, reason: 'Neue Person mit Urlaub' }));
  let plan = await rpc(owner, 'read', args());const proposal = plan.proposals[0];
  const absence = proposal.changes.findIndex(c => c.path.at(-1) === 'absences');
  await assert.rejects(rpc(owner, 'decide_proposal_items', args({ id: proposal.id, indices: [absence], decision: 'accepted', expected_revision: 1 })), /DEPENDENT_CHANGE/);
  await rpc(owner, 'decide_proposal_items', args({ id: proposal.id, indices: [0, 1], decision: 'accepted', expected_revision: 1 }));
  plan = await rpc(deputy, 'read', args());assert.equal(plan.revision, 2);assert.equal(plan.proposals[0].status, 'accepted');
  assert.equal(plan.payload.storage.wochenplan_plan_v10.absences[0].employeeId, 'new-person');
 } finally { await db.close(); }
});
test('new-day proposals split into shifts and the non-destructive upgrade preserves legacy pending proposals', async () => {
 assert.equal(fs.readFileSync('supabase/proposal-items-upgrade.sql', 'utf8'), buildUpgrade());
 const { db, rpc, args } = await setup();
 try {
  // Model the stored, untouched day-level proposal of the previous server.
  const c = { path: ['storage', 'wochenplan_plan_v10', 'schedule', '2026-10-20'], before: null, before_exists: false,
   after: { a: { code: 'F5' }, b: { code: 'F6' } }, after_exists: true };
  await db.exec('reset role');
  const inserted = await db.query(`insert into wochenplan_private.proposals(branch_id,author_id,author_name,reason,changes)
   values($1,$2,'SV','Altvorschlag',$3) returning id`, [args().branch_id, deputy, JSON.stringify([c])]);
  const id = inserted.rows[0].id;
  const before = await rpc(owner, 'read', args());
  const historyBefore = await rpc(owner, 'history', args());
  await db.exec('reset role');await db.exec(buildUpgrade());await db.exec(buildUpgrade());
  let plan = await rpc(deputy, 'read', args());assert.equal(plan.proposals[0].changes.length, 2);assert.deepEqual(plan.payload, before.payload);
  assert.deepEqual(await rpc(owner, 'history', args()), historyBefore, 'upgrade must not manufacture history');
  await assert.rejects(db.query("select wochenplan_private.proposal_items('[]'::jsonb)"), /permission denied/);
  await rpc(owner, 'decide_proposal_items', args({ id, indices: [1], decision: 'accepted', expected_revision: 1 }));
  plan = await rpc(deputy, 'read', args());assert.deepEqual(plan.payload.storage.wochenplan_plan_v10.schedule['2026-10-20'], { b: { code: 'F6' } });
  const partlyDecided = structuredClone(plan.proposals[0]);
  await db.exec('reset role');await db.exec(buildUpgrade());
  plan = await rpc(deputy, 'read', args());assert.deepEqual(plan.proposals[0], partlyDecided, 'reapplying the upgrade preserves decisions and indices');
  await rpc(owner, 'decide_proposal_items', args({ id, indices: [0], decision: 'accepted', expected_revision: 2 }));
  plan = await rpc(owner, 'read', args());assert.deepEqual(plan.payload.storage.wochenplan_plan_v10.schedule['2026-10-20'], c.after);
  assert.equal(plan.proposals[0].status, 'accepted');
  const proposed = structuredClone(plan.payload);proposed.storage.wochenplan_plan_v10.schedule['2026-10-21'] = c.after;
  await rpc(deputy, 'propose', args({ payload: proposed, expected_revision: 3, reason: 'Neuer Tag' }));
  plan = await rpc(owner, 'read', args());const pending = plan.proposals.find(p => p.status === 'pending');assert.equal(pending.changes.length, 2);
  await rpc(owner, 'decide_proposal', args({ id: pending.id, decision: 'rejected' }));
  plan = await rpc(deputy, 'read', args());assert.equal(plan.proposals.find(p => p.id === pending.id).status, 'rejected');
 } finally { await db.close(); }
});
