const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8'),live=fs.readFileSync('planning2-live.js','utf8');
function extract(source,name){const start=source.indexOf('function '+name+'(');let depth=0,open=false;for(let i=start;i<source.length;i++){if(source[i]==='{'){depth++;open=true}if(source[i]==='}'&&--depth===0&&open)return source.slice(start,i+1)}}
test('drawing the current view never mutates the plan or draws invisible export pages',()=>{
 for(const view of ['week','day','month','overview','mep']){
  const calls=[];const ctx={uiState:{currentView:view},window:{WochenplanVacationCalendarPanel:{render:()=>calls.push('calendar')}},renderSummary:()=>calls.push('summary')};
  for(const [name,key] of [['renderDayView','day'],['renderMonthView','month'],['renderOverviewView','overview'],['renderMepTemplateView','mep']])ctx[name]=()=>calls.push(key);
  vm.runInNewContext(extract(app,'renderAllViews')+';renderAllViews()',ctx);
  assert.deepEqual(calls,['summary',...(view==='week'?[]:view==='day'?['day','calendar']:[view])]);
 }
});
test('selected month and overlapping week are published without writing plan data',()=>{
 for(const month of ['2026-11','2027-01']){
  let received;const dates=month==='2026-11'?['2026-10-26','2026-10-31']:['2026-12-28','2027-01-02'];
  const ctx={d:month,activeWeek:0,weeks:()=>[[dates[0],null,null,null,null,dates[1]]],iso:x=>x,window:{dispatchEvent:e=>received=e},CustomEvent:class{constructor(type,args){this.type=type;this.detail=args.detail}}};
  vm.runInNewContext(extract(live,'publishPlanning2Period')+';publishPlanning2Period()',ctx);
  assert.equal(received.type,'planning2:period-selected');assert.equal(received.detail.month,month);assert.equal(received.detail.from,dates[0]);
 }
});

test('full restart selects today in every view even when saved Monday is in the previous month',()=>{
 for(const [today,previous,month,monday] of [
  ['2026-10-01','2026-09-28','2026-10','2026-09-28'],
  ['2026-11-01','2026-10-26','2026-11','2026-10-26'],
  ['2027-01-01','2026-12-28','2027-01','2026-12-28'],
  ['2028-02-29','2026-09-01','2028-02','2028-02-28']
 ]){
  for(const view of ['week','month','day','overview','mep']){
   const schedule={'2026-09-01':{a:{type:'off'}}},absences=[{employeeId:'a',type:'vacation',from:'2026-10-19',to:'2026-10-19'}];
   const state={activeMonth:previous.slice(0,7),weekFrom:previous,schedule,absences};
   const ctx={state,uiState:{currentView:view},toIsoDate:()=>today,
    getMonthPlanFromYearMonth:month=>({weeks:[[{iso:monday},...Array.from({length:6},(_,i)=>({iso:new Date(Date.parse(monday+'T00:00:00Z')+(i+1)*86400000).toISOString().slice(0,10)}))]]}),
    weekFromEl:null,weekToEl:null};
   vm.runInNewContext(['getActiveMonthPlan','syncMonthPlanToState','getCurrentMonthWeeks','getActiveWeekDays','syncWeekRangeFromActiveWeek','selectCurrentPlanningPeriod'].map(name=>extract(app,name)).join('\n')+';selectCurrentPlanningPeriod()',ctx);
   assert.equal(state.activeMonth,month);assert.equal(state.weekFrom,monday);
   assert.equal(state.schedule,schedule);assert.equal(state.absences,absences);assert.equal(ctx.uiState.currentView,view);
  }
 }
});
