const test=require('node:test');
const assert=require('node:assert/strict');
global.getPlanning2DomainTargetMinutesPerWeek=employee=>employee.weekTarget;
global.getPlanning2DomainContractTargetMinutesPerMonth=employee=>employee.monthTarget;
const api=require('../planning2-manual-tools.js');

test('personal favorites use only real work patterns and rank frequency before recency',()=>{const shift=(start,end)=>({type:'shift',status:'work',start,end,minutes:300,pause:0});const schedule={'2026-08-01':{a:shift('09:00','14:00')},'2026-08-02':{a:{type:'vacation',status:'vacation'}},'2026-08-03':{a:shift('10:00','15:00')},'2026-08-04':{a:shift('09:00','14:00')},'2026-08-05':{a:{type:'external-help',externalHelp:true,start:'09:00',end:'14:00'}}};const result=api.getPlanning2PersonalShiftFavorites(schedule,'a',2);assert.equal(result.length,2);assert.equal(result[0].count,2);assert.equal(result[0].entry.start,'09:00');assert.notStrictEqual(result[0].entry,schedule['2026-08-04'].a)});

test('balance preview replaces an existing shift rather than adding the new effect',()=>{const current={schedule:{'2026-09-08':{a:{minutes:300}}}},next={schedule:{'2026-09-08':{a:{minutes:360}}}},employee={id:'a',weekTarget:1800,monthTarget:7800},resolve=(plan,emp,iso)=>({minutesForMonth:plan.schedule[iso]?.[emp.id]?.minutes||0});const result=api.getPlanning2ManualBalancePreview({currentPlan:current,nextPlan:next,employee,isoDate:'2026-09-08',resolve});assert.equal(result.weekAfter-result.weekBefore,60);assert.equal(result.monthAfter-result.monthBefore,60)});

test('editor warning selects one cell/day warning with carryover priority',()=>{const warnings=[{kind:'free-day',employeeId:'a'},{kind:'coverage',isoDate:'2026-09-08',source:{gaps:[{kind:'closing'}]}},{kind:'carryover',isoDate:'2026-09-08'}];assert.equal(api.getPlanning2EditorWarning(warnings,'2026-09-08','a'),'Öffner am Folgetag prüfen');assert.equal(api.getPlanning2EditorWarning([{kind:'coverage',isoDate:'2026-09-08',source:{gaps:[{kind:'closing'}]}}],'2026-09-08','a'),'Zweiter Schließer fehlt')});

test('copy and multi templates accept only genuine work shifts',()=>{assert.equal(api.isPlanning2ManualWorkShift({type:'shift',status:'work'}),true);assert.equal(api.isPlanning2ManualWorkShift({type:'shift',status:'vacation'}),false);assert.equal(api.isPlanning2ManualWorkShift({type:'external-help',status:'external'}),false)});
