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
