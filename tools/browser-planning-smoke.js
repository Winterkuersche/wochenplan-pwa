const { choosePlanningQuickShift } = require('./browser-planning-helpers');
// Actual week controls, synthetic data only. No external service or credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const {chromium, webkit} = require('playwright');
const day='2026-10-20';
const fixture={backupVersion:2,storage:{
 wochenplan_master_v10:{employees:[{id:'a',name:'Test Alpha',roleKey:'TZ20',target:'20:00',manualMonthActualMinutes:{'2026-10':600}},{id:'b',name:'Test Beta',roleKey:'TZ20',target:'20:00'},{id:'c',name:'Test Gamma',roleKey:'GFB',target:'9:30'}]},
 wochenplan_plan_v10:{weekFrom:'2026-10-19',weekTo:'2026-10-25',schedule:{[day]:{a:{type:'shift',code:'F4',start:'09:00',end:'13:00',minutes:240,pause:0},b:{type:'shift',code:'L5',start:'14:00',end:'19:00',minutes:300,pause:0}},'2026-10-23':Object.fromEntries(['a','b','c'].map(id=>[id,{type:'off',status:'off',code:'FR',label:'FR',minutes:0}]))},absences:[],salesByDate:{[day]:500},monthlyPlanBaselines:{}},
 wochenplan_ui_v10:{currentView:'week',teamCollapsed:true}}};
async function main(){
 const root=process.cwd(),server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)||file.includes('/node_modules/')||file.includes('/.git/'))return res.writeHead(403).end();
  fs.readFile(file,(error,body)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(body)});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 const engine=process.env.BROWSER_ENGINE==='webkit'?webkit:chromium;
 const browser=await engine.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,args:engine===chromium?['--no-sandbox']:[]});
 try{
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  await context.route('https://**/*',route=>route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  const ready=()=>page.waitForFunction(()=>window.__APP_BOOT_OK__===true);
  await page.clock.setFixedTime(new Date('2026-10-01T08:00:00Z'));
  await page.goto(url);await ready();
  await page.locator('#btnDataPanel').click();
  await Promise.all([page.waitForEvent('load'),page.locator('#backupFileInput').setInputFiles({name:'synthetic-planning.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))})]);await ready();
  const week=async()=>{await page.locator('#weeks button').filter({hasText:'19.10'}).click()};await week();
  const cell=(id,date=day)=>page.locator(`.cell[data-eid="${id}"][data-day="${date}"]`);
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('wochenplan_plan_v10')));
  // Change the actual team form while Planning 2 remains mounted.
  await page.locator('#btnToggleTeam').click();
  const exit = page.locator('.teamRow').nth(2).locator('input[type="month"]').nth(1);
  await exit.fill('2026-09'); await exit.blur();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('wochenplan_master_v10')).employees[2].activeToMonth==='2026-09');
  await page.waitForFunction(()=>document.querySelectorAll('.cell[data-eid="c"]').length===0);
  const history = JSON.stringify((await read()).schedule);
  await page.locator('#prev').click();
  assert.ok(await page.locator('.cell[data-eid="c"]').count()>0, 'Departed person remains visible in historical September');
  await page.locator('#next').click();
  assert.equal(await page.locator('.cell[data-eid="c"]').count(),0);
  await page.reload(); await ready(); await week();
  assert.equal(await page.locator('.cell[data-eid="c"]').count(),0, 'Departure survives reload');
  assert.equal(JSON.stringify((await read()).schedule),history);
  if (await page.locator('#teamSection').evaluate(el=>el.classList.contains('hidden'))) await page.locator('#btnToggleTeam').click();
  await page.locator('.teamRow').nth(2).locator('input[type="month"]').nth(1).fill('');
  await page.locator('.teamRow').nth(2).locator('input[type="month"]').nth(1).blur();
  await page.waitForFunction(()=>document.querySelectorAll('.cell[data-eid="c"]').length>0);
  await page.locator('#btnToggleTeam').click();
  const before=await read();
  await cell('a').click();await choosePlanningQuickShift(page,'F5');
  assert.equal((await read()).schedule[day].a.code,'F5');
  assert.equal(await page.evaluate(()=>JSON.parse(JSON.parse(localStorage.getItem('wochenplan_save_journal_v1')).previous.wochenplan_plan_v10).schedule['2026-10-20'].a.code),'F4');
  await page.locator('#planningUndo').click();assert.deepEqual(await read(),before);
  await cell('a','2026-10-21').click();await page.locator('#editFavorites [data-favorite]').first().click();
  assert.ok((await read()).schedule['2026-10-21'].a);await page.locator('#planningUndo').click();
  await cell('a').click();await page.locator('#multiEntry').click();await cell('a','2026-10-21').click();
  assert.ok((await read()).schedule['2026-10-21'].a);await page.locator('#planning2MultiStop').click();await page.locator('#planningUndo').click();
  await cell('a').click();await page.locator('#swapEntry').click();await page.locator('#transferTarget').selectOption('b');await page.locator('#confirmTransfer').click();
  assert.equal((await read()).schedule[day].a.start,'14:00');await page.locator('#planningUndo').click();assert.deepEqual(await read(),before);
  await cell('a').click();await page.locator('#moveEntry').click();await page.locator('#transferTarget').selectOption('c');await page.locator('#confirmTransfer').click();
  assert.equal((await read()).schedule[day].a,undefined);assert.ok((await read()).schedule[day].c);await page.locator('#planningUndo').click();assert.deepEqual(await read(),before);
  await page.locator('#createBaseline').click();assert.ok((await read()).monthlyPlanBaselines['2026-10']);await page.locator('#planningUndo').click();assert.deepEqual(await read(),before);
  await page.locator('#grid [data-hours-person="a"]').click();assert.equal(await page.locator('#hourBreakdownDialog').isVisible(),true);
  assert.match(await page.locator('#hourBreakdownValues').innerText(),/10:00/);assert.match(await page.locator('#hourBreakdownExplanation').innerText(),/ersetzt/);await page.locator('#closeHourBreakdown').click();
  // An eligible future gap with a closing team and next-day opener already in place.
  const proposalFixture=structuredClone(fixture), proposalPlan=proposalFixture.storage.wochenplan_plan_v10;
  proposalPlan.schedule[day].b={type:'shift',code:'G',start:'08:55',end:'19:10',minutes:540,pause:70};
  proposalPlan.schedule[day].c={type:'shift',code:'L4',start:'15:00',end:'19:10',minutes:240,pause:10};
  proposalPlan.schedule['2026-10-21']={b:{type:'shift',code:'F4',start:'08:55',end:'12:55',minutes:240,pause:0}};
  await page.locator('#btnDataPanel').click();
  await Promise.all([page.waitForEvent('load'),page.locator('#backupFileInput').setInputFiles({name:'synthetic-proposals.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(proposalFixture))})]);await ready();await week();
  await page.locator('#planningWarnings summary').click();assert.ok(await page.locator('#planningWarningList button').count()>0);
  assert.equal(await page.locator('#planningSuggestionsToggle').getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('[data-targeted-day]').count(),0);await page.locator('#planningSuggestionsToggle').click();
  const revisionBeforeSuggestions=JSON.stringify(await read());
  await page.locator('[data-targeted-day="'+day+'"]').first().click();assert.equal(await page.locator('#targetedSuggestionsOverlay').isVisible(),true);
  assert.equal(JSON.stringify(await read()),revisionBeforeSuggestions,'requesting suggestions must never change the plan');
  const suggested=page.locator('[data-targeted-apply]');
  assert.ok(await suggested.count()>0,'The synthetic future week must offer an eligible change');
  await suggested.first().click();assert.notEqual(JSON.stringify(await read()),revisionBeforeSuggestions,'accepting a suggestion must persist it');
  await page.locator('#planningUndo').click();assert.equal(JSON.stringify(await read()),revisionBeforeSuggestions);
  await page.locator('#planningSuggestionsToggle').click();
  await page.locator('#btnDataPanel').click();await page.locator('[data-data-target="cloudTitle"]').click();
  assert.equal(await page.locator('#cloudTitle').evaluate(el=>document.activeElement===el),true);await page.locator('#btnCloseData').click();
  // Same-browser stale editor: a newer journaled save must not be lost.
  await cell('a').click();await page.evaluate(()=>{state.salesByDate['2026-10-20']=900;saveAppState()});
  await choosePlanningQuickShift(page,'F6');assert.equal((await read()).salesByDate[day],900);assert.equal((await read()).schedule[day].a.code,'F4');
  assert.match(await page.locator('#toast').innerText(),/inzwischen geändert/);await page.locator('#closeEditor').click();
  // Quota failure leaves editor open with no success toast and keeps all bytes.
  const safe=JSON.stringify(await read());await cell('a').click();await page.evaluate(()=>{window.__originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Synthetic quota','QuotaExceededError')}});
  await choosePlanningQuickShift(page,'F5');assert.equal(JSON.stringify(await read()),safe);assert.equal(await page.locator('#editorOverlay').isVisible(),true);
  assert.match(await page.locator('#toast').innerText(),/Gerätespeicher|Speichern/);await page.evaluate(()=>{Storage.prototype.setItem=window.__originalSet});await page.locator('#closeEditor').click();
  await page.reload();await ready();await week();assert.equal((await read()).salesByDate[day],900);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  await context.close();
  // Real service worker coverage (the other online smokes intentionally block it).
  const offline=await browser.newContext({serviceWorkers:'allow',viewport:{width:390,height:844}});
  await offline.route('https://**/*',route=>route.abort());
  const offlinePage=await offline.newPage();offlinePage.on('dialog',dialog=>dialog.accept());offlinePage.on('pageerror',error=>errors.push(error.message));
  await offlinePage.goto(url);await offlinePage.waitForFunction(()=>window.__APP_BOOT_OK__===true);
  await offlinePage.waitForFunction(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.active),null,{timeout:20000});
  // The app reloads itself on the initial controllerchange. Do not start a
  // competing navigation before that reload has settled (especially WebKit).
  await offlinePage.waitForFunction(()=>window.__APP_BOOT_OK__===true&&Boolean(navigator.serviceWorker.controller));
  await offlinePage.waitForLoadState('networkidle');
  await offlinePage.locator('#btnDataPanel').click();
  await Promise.all([offlinePage.waitForEvent('load'),offlinePage.locator('#backupFileInput').setInputFiles({name:'offline-synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))})]);await offlinePage.waitForFunction(()=>window.__APP_BOOT_OK__===true);
  await offline.setOffline(true);await offlinePage.reload();await offlinePage.waitForFunction(()=>window.__APP_BOOT_OK__===true);
  await offlinePage.locator('#weeks button').filter({hasText:'19.10'}).click();await offlinePage.locator('.cell[data-eid="a"][data-day="2026-10-20"]').click();await choosePlanningQuickShift(offlinePage,'F5');
  await offlinePage.reload();await offlinePage.waitForFunction(()=>window.__APP_BOOT_OK__===true);
  assert.equal(await offlinePage.evaluate(()=>state.schedule['2026-10-20'].a.code),'F5');
  assert.deepEqual(errors,[]);await offline.close();
  console.log('Planning controls passed: journal, undo, favorite, multi, swap, move, baseline, hours, warnings, lazy suggestions, navigation, stale editor and quota failure.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(error=>{console.error(error);process.exitCode=1});
