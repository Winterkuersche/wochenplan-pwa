const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const {loadScripts}=require('./test-helpers');
const app=fs.readFileSync('app.js','utf8');
function harness(manual=null){
 const data={ '2026-10-01':{type:'shift',minutesForMonth:240},'2026-10-02':{type:'external-help',minutesForMonth:180},'2026-10-03':{type:'vacation',minutesForMonth:200},'2026-09-30':{type:'shift',minutesForMonth:999} };
 const ctx=loadScripts(['date-utils.js','balance-utils.js'],{state:{schedule:data,absences:[]},BALANCE_HISTORY_START_MONTH:'2026-01',
 getEmployeeAccountMinutesForMonth:()=>620,getEmployeeContractTargetMinutesPerMonth:()=>600,
 getEmployeeActualMinutesForMonth:(_employee,month)=>month==='2026-09'?540:(manual??620),getManualMonthActualMinutes:()=>manual,
 getWeeksForYearMonth:()=>[[{iso:'2026-09-30'},{iso:'2026-10-01'},{iso:'2026-10-02'}],[{iso:'2026-10-02'},{iso:'2026-10-03'}]],
 getResolvedEntryForEmployeeOnIso:(_employee,day)=>data[day],isGfbEmployee:employee=>employee.roleKey==='GFB'});
 vm.runInContext(app.slice(app.indexOf('function getEmployeeHourBreakdown('),app.indexOf('function openEmployeeHourBreakdown(')),ctx);
 return ctx;
}
test('hours detail counts work, external help and credits once, excluding adjacent months',()=>{
 const d=harness().getEmployeeHourBreakdown({},'2026-10');assert.equal(d.work,240);assert.equal(d.external,180);assert.equal(d.credited,200);
 assert.equal(d.planned,d.work+d.external+d.credited);assert.equal(d.carry,-60);assert.equal(d.difference,20);assert.equal(d.manual,null);
});
test('manual month hours replace rather than add to the plan, including a zero override',()=>{
 for(const minutes of [0,700]){const d=harness(minutes).getEmployeeHourBreakdown({},'2026-10');assert.equal(d.actual,minutes);assert.equal(d.difference,minutes-600);assert.equal(d.planned,620)}
});
test('GFB uses monthly facts and is identified separately from a running balance',()=>{
 const d=harness().getEmployeeHourBreakdown({roleKey:'GFB'},'2026-10');assert.equal(d.gfb,true);assert.equal(d.target,600);
});
test('strict date parser rejects impossible dates and accepts a leap day',()=>{
 const ctx=harness();for(const date of ['2026-02-30','2025-02-29','2026-13-01'])assert.equal(ctx.fromIsoDate(date),null);assert.equal(ctx.toIsoDate(ctx.fromIsoDate('2024-02-29')),'2024-02-29');
});
