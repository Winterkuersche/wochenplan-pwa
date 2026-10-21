const test=require('node:test'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {loadScripts}=require('./test-helpers');
const payload=code=>({backupVersion:2,storage:{wochenplan_master_v10:{employees:[{id:'one'}]},wochenplan_plan_v10:{schedule:{'2026-10-19':{one:{code}}},absences:[]},wochenplan_ui_v10:{}}});
function setup(t,{editable=true,crypto=webcrypto}={}) {
 const ctx=loadScripts(['cloud-sync.js','collaboration.js','collaboration-panel.js'],{crypto,TextEncoder,Uint8Array,Intl,Date});
 let local=payload('F4'),writes=0,adopted=null,beforeSave=null,offline=false;
 const record={id:'b',name:'Test',revision:1,payload:payload('F4'),can_edit:editable,can_publish:editable,owner:editable};
 const map=new Map();
 const c=ctx.WochenplanCollaboration.create({projectRef:'test',storage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},
 getSnapshot:()=>local,applySnapshot:v=>adopted=v,delayMs:100000,
 client:{rpc:async(_,args)=>{
  if(offline)throw Error('offline');
  const {p_action:a,p_args:p}=args;
  if(a==='list')return{data:[{id:'b',name:'Test'}]};
  if(a==='read')return{data:structuredClone(record)};
  if(a==='save'){
   if(!record.can_edit)return{error:{code:'42501',message:'READ_ONLY'}};
   if(record.revision!==p.expected_revision)return{error:{code:'40001',message:'REVISION_CONFLICT'}};
   writes++;record.revision++;record.payload=p.payload;if(beforeSave)await beforeSave();return{data:{revision:record.revision}};
  }
  if(a==='propose')return{data:{revision:record.revision}};
  if(a==='compare')return{data:{revision:record.revision,changes:[]}};
  throw Error(a);
 }}});
 t.after(()=>c.dispose());
 return{c,record,map,ctx,set:code=>{local=payload(code);},offline:value=>offline=value,beforeSave:fn=>beforeSave=fn,get writes(){return writes;},get adopted(){return adopted;}};
}
test('shared selection never uploads a differing local plan by itself',async t=>{
 const f=setup(t);f.set('F6');await f.c.setUser({id:'u'});await f.c.select('b');assert.equal(f.c.status.mode,'compare');
 await assert.rejects(f.c.save(),/vergleichen/);assert.equal(f.writes,0);assert.equal(f.adopted,null);
});
test('shared saves use revisions and preserve drafts after another device writes',async t=>{
 const f=setup(t);await f.c.setUser({id:'u'});await f.c.select('b');f.set('F5');await f.c.save();assert.equal(f.writes,1);
 f.record.revision++;f.record.payload=payload('F6');f.set('F3');await assert.rejects(f.c.save(),/neuer Stand/);
 assert.equal(f.record.payload.storage.wochenplan_plan_v10.schedule['2026-10-19'].one.code,'F6');assert.equal(f.adopted,null);
});
test('revoked rights reject a pending local save while preserving it as a proposal',async t=>{
 const f=setup(t);await f.c.setUser({id:'u'});await f.c.select('b');f.set('F5');f.record.can_edit=false;
 await assert.rejects(f.c.save(),/Vorschläge/);assert.equal(f.writes,0);await f.c.propose('Test');assert.equal(f.c.status.mode,'draft');
});
test('changes made while a shared save is in flight remain pending',async t=>{
 const f=setup(t);await f.c.setUser({id:'u'});await f.c.select('b');f.set('F5');f.beforeSave(()=>f.set('F6'));
 await f.c.save();assert.equal(f.c.status.mode,'draft');assert.equal(f.record.payload.storage.wochenplan_plan_v10.schedule['2026-10-19'].one.code,'F5');
});
test('Berlin delegation day boundaries include complete days and DST transitions',t=>{
 const f=setup(t),boundary=f.ctx.WochenplanCollaborationPanel.berlinBoundary;
 assert.equal(boundary('2026-03-29'),'2026-03-28T23:00:00.000Z');assert.equal(boundary('2026-03-29',true),'2026-03-29T22:00:00.000Z');
 assert.equal(boundary('2026-10-25'),'2026-10-24T22:00:00.000Z');assert.equal(boundary('2026-10-25',true),'2026-10-25T23:00:00.000Z');
});
test('explicit replacement is pinned to the preview and rejects a changed local draft',async t=>{
 const f=setup(t);await f.c.setUser({id:'u'});await f.c.select('b');f.set('F5');const preview=await f.c.compare();
 f.set('F6');await assert.rejects(f.c.save('',true,preview),/seit der Vorschau/);assert.equal(f.writes,0);
});
test('a completed shared request cannot attach its result to a signed-out account',async t=>{
 const f=setup(t);await f.c.setUser({id:'u'});await f.c.select('b');f.set('F5');f.beforeSave(()=>f.c.setUser(null));
 await assert.rejects(f.c.save(),/Konto oder der Planungsbereich/);assert.equal(f.c.status.user,null);assert.equal(f.c.status.mode,'signed-out');
});
test('switching accounts during fingerprinting cancels the old shared save before its RPC',async t=>{
 let holdNext=false,entered,release;
 const started=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
 const crypto={subtle:{digest:async(...args)=>{
  if(holdNext){holdNext=false;entered();await gate;}
  return webcrypto.subtle.digest(...args);
 }}};
 const f=setup(t,{crypto});await f.c.setUser({id:'u'});await f.c.select('b');f.set('F5');
 holdNext=true;
 const saving=assert.rejects(f.c.save(),/Konto oder der Planungsbereich/);
 await started;await f.c.setUser({id:'other'});await f.c.select('other-branch');
 release();await saving;
 assert.equal(f.writes,0,'the previous account must not write its draft into the newly selected branch');
 assert.equal(f.record.payload.storage.wochenplan_plan_v10.schedule['2026-10-19'].one.code,'F4');
 assert.equal(f.c.status.user.id,'other');assert.equal(f.c.status.selected,'other-branch');
});
test('view-only saves do not create repeated shared revisions or audit events',async t=>{
 const f=setup(t);await f.c.setUser({id:'u'});await f.c.select('b');await f.c.save();assert.equal(f.writes,0);
});
test('opening a shared refresh preserves a queued automatic save',async t=>{
 const f=setup(t),timers=new Map();let next=0;
 f.ctx.setTimeout=fn=>{timers.set(++next,fn);return next;};f.ctx.clearTimeout=id=>timers.delete(id);
 await f.c.setUser({id:'u'});await f.c.select('b');f.set('F5');f.c.scheduleSave();assert.equal(timers.size,1);
 await f.c.refresh();assert.equal(timers.size,1,'refresh must reschedule the pending write');
 const written=new Promise(resolve=>f.beforeSave(resolve));[...timers.values()][0]();await written;assert.equal(f.writes,1);
});
test('failed shared saves resume after reconnect when their server base is unchanged',async t=>{
 const f=setup(t),timers=new Map();let next=0;
 f.ctx.setTimeout=fn=>{timers.set(++next,fn);return next;};f.ctx.clearTimeout=id=>timers.delete(id);
 await f.c.setUser({id:'u'});await f.c.select('b');f.set('F5');f.offline(true);
 await assert.rejects(f.c.save(),/offline/);assert.equal(f.writes,0);assert.equal(timers.size,0);
 f.offline(false);await f.c.refresh();assert.equal(timers.size,1,'reconnect must retry an unsaved draft');
 const written=new Promise(resolve=>f.beforeSave(resolve));[...timers.values()][0]();await written;
 assert.equal(f.writes,1);assert.equal(f.record.payload.storage.wochenplan_plan_v10.schedule['2026-10-19'].one.code,'F5');
});
test('reconnect does not retry a failed shared save over another device revision',async t=>{
 const f=setup(t),timers=new Map();let next=0;
 f.ctx.setTimeout=fn=>{timers.set(++next,fn);return next;};f.ctx.clearTimeout=id=>timers.delete(id);
 await f.c.setUser({id:'u'});await f.c.select('b');f.set('F5');f.offline(true);
 await assert.rejects(f.c.save(),/offline/);f.offline(false);f.record.revision++;f.record.payload=payload('F6');
 await f.c.refresh();assert.equal(f.c.status.mode,'compare');assert.equal(timers.size,0);assert.equal(f.writes,0);
 assert.equal(f.record.payload.storage.wochenplan_plan_v10.schedule['2026-10-19'].one.code,'F6');assert.equal(f.adopted,null);
});
test('reconnect keeps a failed shared save as a draft after editing rights expire',async t=>{
 const f=setup(t),timers=new Map();let next=0;
 f.ctx.setTimeout=fn=>{timers.set(++next,fn);return next;};f.ctx.clearTimeout=id=>timers.delete(id);
 await f.c.setUser({id:'u'});await f.c.select('b');f.set('F5');f.offline(true);
 await assert.rejects(f.c.save(),/offline/);f.offline(false);f.record.can_edit=false;
 await f.c.refresh();assert.equal(f.c.status.mode,'draft');assert.equal(timers.size,0);assert.equal(f.writes,0);assert.equal(f.adopted,null);
});
