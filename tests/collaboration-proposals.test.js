const test=require('node:test'),assert=require('node:assert/strict');
const {loadScripts}=require('./test-helpers');
const model=loadScripts(['collaboration-proposals.js']).WochenplanProposals;
const payload=()=>({storage:{wochenplan_master_v10:{employees:[]},wochenplan_plan_v10:{schedule:{'2026-10-19':{a:{code:'F4',start:'09:00'}}},absences:[]},wochenplan_ui_v10:{}}});
test('partially decided proposals keep stable indices and mark only their open entries',()=>{
 const a=payload(),b=payload();b.storage.wochenplan_plan_v10.schedule['2026-10-19'].a.code='F5';
 b.storage.wochenplan_plan_v10.schedule['2026-10-20']={a:{code:'F6'}};
 const changes=model.diff(a,b);changes[0].decision='accepted';
 const proposal={status:'pending',changes};
 assert.deepEqual(Array.from(model.items(proposal),i=>i.index),[0,1]);assert.equal(model.pending(proposal).length,1);
 assert.equal(model.pending(proposal).some(c=>model.affectsCell(c,'2026-10-19','a')),false);
 assert.equal(model.pending(proposal).some(c=>model.affectsCell(c,'2026-10-20','a')),true);
 assert.equal(model.pending({status:'accepted',changes:[{path:['legacy']}]}).length,0);
});
test('proposal shifts are atomic and ignore device view/week settings',()=>{
 const a=payload(),b=payload();b.storage.wochenplan_plan_v10.weekFrom='2026-10-01';b.storage.wochenplan_ui_v10={currentView:'month'};
 assert.equal(model.diff(a,b).length,0);b.storage.wochenplan_plan_v10.schedule['2026-10-19'].a.code='F5';
 const changes=model.diff(a,b);assert.equal(changes.length,1);assert.equal(changes[0].path.length,5);
 assert.equal(changes[0].before.code,'F4');assert.equal(changes[0].after.code,'F5');
});
test('proposal conflicts include removed ancestors and preserve the latest full plan',()=>{
 const a=payload(),b=payload();b.storage.wochenplan_plan_v10.schedule['2026-10-19'].a.code='F5';const changes=model.diff(a,b);
 const latest=payload();latest.storage.wochenplan_plan_v10.schedule['2026-10-19'].a.start='10:00';
 assert.equal(model.conflicts(latest,changes).length,1);assert.throws(()=>model.apply(latest,changes),/geändert/);
 delete latest.storage.wochenplan_plan_v10.schedule['2026-10-19'];assert.equal(model.conflicts(latest,changes).length,1);
 assert.equal(a.storage.wochenplan_plan_v10.schedule['2026-10-19'].a.code,'F4');
});
test('pending indicators target only affected shifts, new days and absence days',()=>{
 const a=payload(),b=payload();b.storage.wochenplan_plan_v10.schedule['2026-10-20']={a:{code:'F5'}};
 b.storage.wochenplan_plan_v10.absences=[{employeeId:'b',from:'2026-10-21',to:'2026-10-23',type:'vacation'}];
 const changes=model.diff(a,b);
 assert.ok(changes.some(c=>model.affectsCell(c,'2026-10-20','a')));
 assert.ok(changes.some(c=>model.affectsCell(c,'2026-10-22','b')));
 assert.equal(changes.some(c=>model.affectsCell(c,'2026-10-20','b')),false);
 assert.equal(changes.some(c=>model.affectsCell(c,'2026-10-19','a')),false);
});
