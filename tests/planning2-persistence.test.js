const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const app = fs.readFileSync('app-storage.js', 'utf8') + '\n' + fs.readFileSync('app.js', 'utf8');
const masterKey = 'wochenplan_master_v10', planKey = 'wochenplan_plan_v10';
const plan = () => ({ weekFrom:'2026-10-19', schedule:{'2026-10-20':{a:{type:'shift',code:'F4',start:'09:00',end:'13:00'}}}, absences:[], salesByDate:{'2026-10-20':500}, monthlyPlanBaselines:{} });
function harness(initialPlan = plan()) {
  const values = new Map([[masterKey, JSON.stringify({ employees:[{id:'a'}] })],[planKey,JSON.stringify(initialPlan)]]);
  let fail = false;
  const storage = {getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(fail)throw Error('quota');values.set(key,value)},removeItem:key=>values.delete(key)};
  const events = [];
  const ctx = vm.createContext({ console, localStorage:storage, MASTER_KEY:masterKey, PLAN_KEY:planKey, UI_KEY:'ui', LAST_SAVED_AT_KEY:'savedAt',
    state:plan(), uiState:{}, autoSaveTimerId:null, lastSavedAt:null, planning2UndoState:null,
    saveStatusMessage:'', updateSaveStatus:message=>{ctx.saveStatusMessage=message},
    saveMasterData:()=>JSON.parse(values.get(masterKey)), savePlanData:()=>JSON.parse(JSON.stringify(ctx.state)),
    flushPendingAutoSave:()=>{}, window:{dispatchEvent:event=>events.push(event.type)}, CustomEvent:class{constructor(type){this.type=type}} });
  vm.runInContext(fs.readFileSync('storage-utils.js','utf8'),ctx);
  ctx.localDataStore=ctx.window.WochenplanStorage.create({keys:{master:masterKey,plan:planKey,ui:'ui',savedAt:'savedAt'},storage});
  const start=app.indexOf('function saveAppState()');
  vm.runInContext(app.slice(start,app.indexOf('window.WochenplanPlanning =',start)),ctx);
  return {ctx,values,events,fail:value=>{fail=value},stored:()=>JSON.parse(values.get(planKey))};
}
test('productive edit journals old plan, publishes central save signal, and can be undone once',()=>{
  const h=harness(), before=plan(), changed=plan();changed.schedule['2026-10-20'].a.end='14:00';
  assert.equal(h.ctx.commitPlanning2Plan(changed,before),true);
  assert.equal(h.stored().schedule['2026-10-20'].a.end,'14:00');
  assert.equal(JSON.parse(h.values.get('wochenplan_save_journal_v1')).previous[planKey],JSON.stringify(before));
  assert.deepEqual(h.events,['wochenplan:saved']);
  assert.equal(h.ctx.undoPlanning2Plan(),true);
  assert.deepEqual(h.stored(),before);
  assert.deepEqual(h.events,['wochenplan:saved','wochenplan:saved']);
  assert.throws(()=>h.ctx.undoPlanning2Plan(),/weitergeplant/);
});
test('stale editor cannot overwrite a newer plan and emits no save signal',()=>{
  const h=harness(), newer=plan();newer.salesByDate['2026-10-20']=900;
  h.values.set(planKey,JSON.stringify(newer));
  assert.throws(()=>h.ctx.commitPlanning2Plan(plan(),plan()),/inzwischen geändert/);
  assert.deepEqual(h.stored(),newer);assert.deepEqual(h.events,[]);
});
test('central stale-tab guard also applies without an editor base',()=>{
  const h=harness(), newer=plan();newer.schedule['2026-10-20'].a.end='15:00';h.values.set(planKey,JSON.stringify(newer));
  assert.throws(()=>h.ctx.commitPlanning2Plan(plan()),/anderes Fenster/);
  assert.deepEqual(h.stored(),newer);assert.equal(h.ctx.state.schedule['2026-10-20'].a.end,'13:00');
  assert.deepEqual(h.events,['wochenplan:storage-error']);
});
test('quota failure preserves previous plan, in-memory state and missing undo',()=>{
  const h=harness(), changed=plan();changed.absences=[{type:'vacation',employeeId:'a',from:'2026-10-21',to:'2026-10-21'}];h.fail(true);
  assert.throws(()=>h.ctx.commitPlanning2Plan(changed,plan()),/Gerätespeicher/);
  assert.deepEqual(h.stored(),plan());assert.deepEqual(h.ctx.state,plan());assert.equal(h.ctx.canUndoPlanning2Plan(),false);
  assert.deepEqual(h.events,['wochenplan:storage-error']);
});
test('undo refuses intervening edits, changed master data and pending autosave',()=>{
  for(const change of ['plan','master','pending']){
    const h=harness(), changed=plan();changed.schedule['2026-10-20'].a.end='14:00';h.ctx.commitPlanning2Plan(changed,plan());
    if(change==='plan')h.values.set(planKey,JSON.stringify({...changed,salesByDate:{another:20}}));
    if(change==='master')h.values.set(masterKey,JSON.stringify({employees:[{id:'b'}]}));
    if(change==='pending')h.ctx.autoSaveTimerId=1;
    assert.equal(h.ctx.canUndoPlanning2Plan(),false);assert.throws(()=>h.ctx.undoPlanning2Plan(),/weitergeplant/);
  }
});
test('full-plan changes preserve sales and baselines through central save and rollback',()=>{
  const h=harness(), changed=plan();changed.monthlyPlanBaselines={'2026-10':{marker:'synthetic'}};
  changed.schedule['2026-10-20'].b=changed.schedule['2026-10-20'].a;delete changed.schedule['2026-10-20'].a;
  h.ctx.commitPlanning2Plan(changed,plan());assert.deepEqual(h.stored(),changed);h.ctx.undoPlanning2Plan();assert.deepEqual(h.stored(),plan());
});

test('undo preserves stored week metadata even when the current view selected a different week',()=>{
  const h=harness(), changed=plan();h.ctx.state.weekFrom='2026-10-05';changed.schedule['2026-10-20'].a.end='14:00';
  h.ctx.commitPlanning2Plan(changed,plan());h.ctx.undoPlanning2Plan();assert.deepEqual(h.stored(),plan());
});
test('semantically equal editor bases tolerate key order and missing optional baseline map',()=>{
  const h=harness(), base=plan();delete base.monthlyPlanBaselines;
  const reordered=Object.fromEntries(Object.entries(base).reverse());h.values.set(planKey,JSON.stringify(reordered));
  h.ctx.localDataStore=h.ctx.window.WochenplanStorage.create({keys:{master:masterKey,plan:planKey,ui:'ui',savedAt:'savedAt'},storage:{getItem:key=>h.values.get(key)??null,setItem:(key,value)=>h.values.set(key,value),removeItem:key=>h.values.delete(key)}});
  const next=plan();next.schedule['2026-10-20'].a.end='14:00';assert.equal(h.ctx.commitPlanning2Plan(next,plan()),true);
});

test('undo removes a newly created baseline when a legacy plan omitted its map',()=>{
  const legacy=plan();delete legacy.monthlyPlanBaselines;
  const h=harness(legacy), changed=plan();
  changed.monthlyPlanBaselines={'2026-10':{marker:'new-baseline'}};
  h.ctx.commitPlanning2Plan(changed,plan());
  assert.ok(h.stored().monthlyPlanBaselines['2026-10']);
  h.ctx.undoPlanning2Plan();
  assert.deepEqual(h.stored(),{...legacy,monthlyPlanBaselines:{}});
  assert.deepEqual(h.events,['wochenplan:saved','wochenplan:saved']);
  assert.equal(h.ctx.canUndoPlanning2Plan(),false);
  const journal=JSON.parse(h.values.get('wochenplan_save_journal_v1'));
  assert.deepEqual(JSON.parse(journal.previous[planKey]),changed);
});
test('undo clears optional plan fields absent from the stored snapshot',()=>{
  const legacy={weekFrom:'2026-10-19'}, h=harness(legacy), changed=plan();
  changed.absences=[{employeeId:'a',type:'vacation',from:'2026-10-21',to:'2026-10-21'}];
  changed.monthlyPlanBaselines={'2026-10':{marker:'new-baseline'}};
  h.ctx.commitPlanning2Plan(changed);
  h.ctx.undoPlanning2Plan();
  assert.deepEqual(h.stored(),{weekFrom:'2026-10-19',schedule:{},absences:[],salesByDate:{},monthlyPlanBaselines:{}});
});

