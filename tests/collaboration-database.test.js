const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const owner = '10000000-0000-4000-8000-000000000001';
const deputy = '10000000-0000-4000-8000-000000000002';
const outsider = '10000000-0000-4000-8000-000000000003';
const fixture = () => ({ backupVersion: 2, storage: {
  wochenplan_master_v10: { employees: [{ id: 'a', name: 'Testperson', roleKey: 'TZ20' }] },
  wochenplan_plan_v10: { schedule: { '2026-10-19': { a: { code: 'F4', start: '09:00', end: '13:00' } } }, absences: [], salesByDate: {} }, wochenplan_ui_v10: {}
} });

test('shared planning: actual Postgres authorization, atomic history, delegation, proposals and recovery', async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,anon;
      grant execute on function auth.uid() to authenticated,anon;
      insert into auth.users values ('${owner}'),('${deputy}'),('${outsider}');`);
    await db.exec(fs.readFileSync('supabase/collaboration-schema.sql', 'utf8'));
    async function rpc(user, action, args = {}) {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || '']);
      await db.exec(`set role ${user ? 'authenticated' : 'anon'}`);
      return (await db.query('select public.wochenplan_collaboration($1,$2::jsonb) as data', [action, JSON.stringify(args)])).rows[0].data;
    }
    const admin = async (sql) => { await db.exec('reset role'); return db.exec(sql); };
    await assert.rejects(rpc(null, 'list'), /permission denied/);
    const { id: branch_id } = await rpc(owner, 'create', { name: 'Testfiliale', display_name: 'TL Test', payload: fixture() });
    const args = (extra = {}) => ({ branch_id, ...extra });
    let plan = await rpc(owner, 'read', args());
    assert.equal(plan.revision, 1);
    assert.equal(plan.owner, true);
    await assert.rejects(rpc(outsider, 'read', args()), /ACCESS_DENIED/);
    await assert.rejects(db.query('select * from wochenplan_private.plans'), /permission denied/);
    const invite = await rpc(owner, 'invite', args());
    await rpc(deputy, 'accept_invite', { token: invite.token, display_name: 'SV Test' });
    await assert.rejects(rpc(outsider, 'accept_invite', { token: invite.token, display_name: 'Fremd' }), /INVITE_INVALID/);
    plan = await rpc(deputy, 'read', args());
    assert.equal(plan.can_edit, false);
    assert.deepEqual(plan.invites, []);
    const changed = fixture(); changed.storage.wochenplan_plan_v10.schedule['2026-10-19'].a.end = '14:00';
    const preview = await rpc(owner, 'compare', args({ payload: changed }));
    assert.equal(preview.revision, 1); assert.equal(preview.changes[0].after.end, '14:00');
    await assert.rejects(rpc(deputy, 'save', args({ expected_revision: 1, payload: changed })), /READ_ONLY/);
    await assert.rejects(rpc(deputy, 'grant', args({ user_id: deputy })), /OWNER_REQUIRED/);
    await rpc(deputy, 'propose', args({ expected_revision: 1, payload: changed, reason: 'Teständerung' }));
    plan = await rpc(owner, 'read', args());
    await rpc(owner, 'decide_proposal', args({ id: plan.proposals[0].id, decision: 'accepted', expected_revision: 1 }));
    plan = await rpc(owner, 'read', args());
    assert.equal(plan.revision, 2);
    assert.equal(plan.payload.storage.wochenplan_plan_v10.schedule['2026-10-19'].a.end, '14:00');
    await assert.rejects(rpc(owner, 'save', args({ expected_revision: 1, payload: fixture() })), /REVISION_CONFLICT/);
    await rpc(owner, 'grant', args({ user_id: deputy, starts_at: new Date(Date.now()-60000).toISOString(), ends_at: new Date(Date.now()+3600000).toISOString() }));
    plan = await rpc(deputy, 'read', args());
    assert.equal(plan.can_edit, true);
    assert.equal(plan.can_publish, false);
    const second = structuredClone(changed); second.storage.wochenplan_plan_v10.schedule['2026-10-19'].a.start = '10:00';
    await rpc(deputy, 'save', args({ expected_revision: 2, payload: second, reason: 'Tausch' }));
    let history = await rpc(owner, 'history', args());
    const event = history.find(e => e.kind === 'save');
    assert.equal(event.actor_id, deputy);
    assert.equal(event.actor_name, 'SV Test');
    assert.equal(event.changes[0].before.start, '09:00');
    assert.equal(event.changes[0].after.start, '10:00');
    await rpc(owner, 'revert', args({ id: event.id, expected_revision: 3 }));
    plan = await rpc(owner, 'read', args());
    assert.equal(plan.payload.storage.wochenplan_plan_v10.schedule['2026-10-19'].a.start, '09:00');
    await assert.rejects(rpc(owner, 'revert', args({ id: event.id, expected_revision: 4 })), /CHANGE_CONFLICT/);
    await assert.rejects(rpc(deputy, 'publish', args({ week_start: '2026-10-19', expected_revision: 4 })), /PUBLISH_DENIED/);
    await rpc(owner, 'publish', args({ week_start: '2026-10-19', expected_revision: 4 }));
    plan = await rpc(owner, 'read', args());
    assert.equal(plan.publications[0].changed, false);
    await rpc(owner, 'save', args({ expected_revision: 4, payload: second }));
    plan = await rpc(owner, 'read', args());
    assert.equal(plan.publications[0].changed, true);
    await rpc(owner, 'revoke_grant', args({ id: plan.delegations[0].id }));
    await assert.rejects(rpc(deputy, 'save', args({ expected_revision: 5, payload: changed })), /READ_ONLY/);
    await rpc(owner, 'grant', args({ user_id: deputy, starts_at: new Date(Date.now()-120000).toISOString(), ends_at: new Date(Date.now()-60000).toISOString() }));
    assert.equal((await rpc(deputy, 'read', args())).can_edit, false);
    await rpc(owner, 'restore', args({ id: plan.snapshots.find(s=>s.label==='Ausgangsstand').id, expected_revision: 5 }));
    plan = await rpc(owner, 'read', args());
    assert.equal(plan.revision, 6);
    assert.deepEqual(plan.payload, fixture());
    await rpc(owner, 'remove_member', args({ user_id: deputy }));
    await assert.rejects(rpc(deputy, 'read', args()), /ACCESS_DENIED/);
    const revoked = await rpc(owner, 'invite', args());
    plan = await rpc(owner, 'read', args());
    await rpc(owner, 'revoke_invite', args({ id: plan.invites[0].id }));
    await assert.rejects(rpc(outsider, 'accept_invite', { token: revoked.token, display_name: 'Fremd' }), /INVITE_INVALID/);
    await assert.rejects(rpc(owner, 'remove_member', args({ user_id: owner })), /OWNER_CANNOT_BE_REMOVED/);
    const other = await rpc(outsider, 'create', { name: 'Andere Filiale', display_name: 'Andere TL', payload: fixture() });
    const otherPlan = await rpc(outsider, 'read', { branch_id: other.id });
    await assert.rejects(rpc(owner, 'snapshot', args({ id: otherPlan.snapshots[0].id })), /SNAPSHOT_MISSING/);
    await assert.rejects(rpc(outsider, 'history', args()), /ACCESS_DENIED/);
    await assert.rejects(rpc(owner, 'save', args({ expected_revision: 6, payload: { storage: {} } })), /INVALID_PLAN/);
    await rpc(owner, 'propose', args({ expected_revision: 6, payload: second, reason: 'Überholter Vorschlag' }));
    plan = await rpc(owner, 'read', args());
    const staleProposal = plan.proposals.find(p => p.status === 'pending');
    await rpc(owner, 'save', args({ expected_revision: 6, payload: changed }));
    await assert.rejects(rpc(owner, 'decide_proposal', args({ id: staleProposal.id, decision: 'accepted', expected_revision: 7 })), /CHANGE_CONFLICT/);
    plan = await rpc(owner, 'read', args());
    assert.equal(plan.revision, 7, 'conflicted proposal must not partially save');
    assert.equal(plan.proposals.find(p => p.id === staleProposal.id).status, 'pending');
    for (let revision = 7; revision < 25; revision++) {
      await rpc(owner, 'save', args({ expected_revision: revision, payload: revision % 2 ? fixture() : changed }));
    }
    plan = await rpc(owner, 'read', args());
    assert.equal(plan.snapshots.filter(s => s.label.startsWith('Vor Änderung ')).length, 11);
    assert.ok(plan.snapshots.some(s => s.label === 'Ausgangsstand'));
    assert.ok(plan.snapshots.some(s => s.label === 'Vor Vertretungsfreigabe'));
    const latest = await rpc(owner, 'history', args());
    assert.equal(latest[0].revision, 25);
    const older = await rpc(owner, 'history', args({ before_id: latest.at(-1).id }));
    assert.equal(older.length, 0);
    await assert.rejects(db.query('delete from wochenplan_private.events'), /permission denied/);
    await admin('select 1');
    t.diagnostic('Server enforced membership, expiring/revoked rights, CAS, immutable attributed events, publication and recovery.');
  } finally { await db.close(); }
});
