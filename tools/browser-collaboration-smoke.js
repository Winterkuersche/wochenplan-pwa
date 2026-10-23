const { choosePlanningQuickShift } = require('./browser-planning-helpers');
// Actual PostgreSQL + browser SDK, local synthetic identities only.
const fs=require('node:fs'), http=require('node:http'), path=require('node:path'), assert=require('node:assert/strict');
const { chromium, webkit }=require('playwright');
const { PGlite }=require('@electric-sql/pglite');
const ids=['20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002'];
async function main(){
 const db=new PGlite(); let browser,server;let queue=Promise.resolve();
 const errors=[], pages=[];
 try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
   insert into auth.users values ('${ids[0]}'),('${ids[1]}');`);
  await db.exec(fs.readFileSync('supabase/collaboration-schema.sql','utf8'));
  server=http.createServer((req,res)=>{
   const root=process.cwd(),file=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
   if(!file.startsWith(root+path.sep)||file.includes('/node_modules/')||file.includes('/.git/'))return res.writeHead(403).end();
   fs.readFile(file,(err,body)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(body);});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;
  const engine=process.env.BROWSER_ENGINE==='webkit'?webkit:chromium;
  browser=await engine.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,args:engine===chromium?['--no-sandbox']:[]});
  async function device(index){
   let oldServer=false;
   const user={id:ids[index],email:`synthetic-${index}@example.invalid`,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
   const now=Math.floor(Date.now()/1000),token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',aud:'authenticated',iat:now,exp:now+3600})).toString('base64url')+'.c3ludGhldGlj';
   const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
   const personalRequests=[];
   await context.route('https://**/*',r=>r.abort());
   await context.route('https://zrosdhfxnwolxemqqvok.supabase.co/**',async route=>{
    const req=route.request(),u=new URL(req.url());
    const send=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(u.pathname==='/auth/v1/token')return send(200,{access_token:token,refresh_token:'synthetic',expires_in:3600,token_type:'bearer',user});
    if(u.pathname==='/auth/v1/user')return send(200,user);
    if(u.pathname==='/rest/v1/wochenplan_documents'){personalRequests.push(req.method());return send(200,[]);}
    if(u.pathname==='/rest/v1/rpc/wochenplan_collaboration'){
     const task=queue.then(async()=>{
      try{
       await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user.id]);await db.exec('set role authenticated');
       const body=req.postDataJSON(),r=await db.query('select public.wochenplan_collaboration($1,$2::jsonb) as data',[body.p_action,JSON.stringify(body.p_args)]);
       const data=r.rows[0].data;
       if(oldServer&&body.p_action==='read')delete data.capabilities;
       return {status:200,body:data};
      }catch(e){return {status:400,body:{code:e.code,message:e.message}};}
     });queue=task.then(()=>{});const r=await task;return send(r.status,r.body);
    }
    return send(404,{message:'Unexpected synthetic route'});
   });
   const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.goto(url);await page.waitForFunction(()=>window.__APP_BOOT_OK__===true);
   return {page,context,user,personalRequests,setOldServer:value=>oldServer=value};
  }
  async function login(d){await d.page.locator('#btnDataPanel').click();await d.page.locator('#cloudEmail').fill(d.user.email);await d.page.locator('#cloudPassword').fill('Synthetic-Password-123');await d.page.locator('#btnCloudLogin').click();await d.page.locator('#collaborationPanel').waitFor({state:'visible'});}
  const a=await device(0),b=await device(1);
  const fixture={master:{employees:[{id:'test-one',name:'Testperson',target:'20:00',roleKey:'TZ20'}]},plan:{weekFrom:'2026-10-19',schedule:{'2026-10-20':{'test-one':{type:'shift',code:'F4',start:'09:00',end:'13:00',minutes:240,pause:0}}},absences:[]},ui:{teamCollapsed:true,currentView:'week'}};
  await a.page.evaluate(b=>importBackupFromObject(b,{reload:false}),fixture);await a.page.reload();await a.page.waitForFunction(()=>window.__APP_BOOT_OK__===true);
  await login(a);await a.page.locator('#sharedSetup>summary').click();await a.page.locator('#sharedDisplayName').fill('TL Test');await a.page.locator('#sharedBranchName').fill('Testfiliale');await a.page.locator('#btnSharedCreate').click();
  await a.page.locator('#sharedSummary').filter({hasText:'Filialverwaltung'}).waitFor();
  console.log('Shared owner created');
  await a.page.locator('#sharedOwner>summary').click();await a.page.locator('#btnSharedInvite').click();await a.page.waitForFunction(()=>document.getElementById('sharedInviteLink').value.includes('#wp-invite='));
  const invite=await a.page.locator('#sharedInviteLink').inputValue();
  await login(b);await b.page.locator('#sharedSetup>summary').click();await b.page.locator('#sharedDisplayName').fill('SV Test');await b.page.locator('#sharedInviteToken').fill(invite);await b.page.locator('#btnSharedJoin').click();
  await b.page.locator('#sharedSummary').filter({hasText:'Ansehen und Vorschläge'}).waitFor();assert.equal(await b.page.locator('#btnSharedSave').isDisabled(),true);
  assert.equal(await b.page.locator('#sharedBranchPicker').isVisible(),false);
  assert.equal(await b.page.locator('#personalCloudActions').isVisible(),false);
  assert.equal(await b.page.locator('#sharedSetup').isVisible(),false);
  console.log('Shared deputy joined');
  await Promise.all([b.page.waitForEvent('load'),b.page.locator('#btnSharedAdopt').click()]);await b.page.waitForFunction(()=>window.__APP_BOOT_OK__===true);
  assert.equal(await b.page.evaluate(()=>state.schedule['2026-10-20']['test-one'].code),'F4');
  console.log('Shared deputy adopted');
  if(await b.page.locator('#dataDialog').isVisible())await b.page.locator('#btnCloseData').click();
  await b.page.locator('#weeks button').filter({hasText:'19.10'}).click();
  await b.page.locator('.cell[data-eid="test-one"][data-day="2026-10-20"]').click();await choosePlanningQuickShift(b.page,'F5');
  await b.page.locator('.cell[data-eid="test-one"][data-day="2026-10-21"]').click();await choosePlanningQuickShift(b.page,'F6');
  await b.page.locator('#btnDataPanel').click();await b.page.locator('#sharedReason').fill('Vertretungsvorschlag');await b.page.locator('#btnSharedPropose').click();
  await b.page.locator('#dataActionMessage').filter({hasText:'Vorschlag eingereicht'}).waitFor();
  await b.page.waitForFunction(()=>state.schedule['2026-10-20']['test-one'].code==='F4');
  assert.equal(await b.page.locator('#btnSharedProposalOverview').textContent(),'Offene Vorschläge (1)');
  await b.page.reload();await b.page.waitForFunction(()=>window.__APP_BOOT_OK__===true);
  await b.page.locator('#btnSharedProposalOverview').filter({hasText:'(1)'}).waitFor();
  assert.equal(await b.page.evaluate(()=>state.schedule['2026-10-20']['test-one'].code),'F4');
  await b.page.locator('#weeks button').filter({hasText:'19.10'}).click();
  await b.page.locator('.cell[data-eid="test-one"][data-day="2026-10-20"] .sharedProposalMark').waitFor();
  console.log('Shared proposal submitted');
  await a.page.locator('#btnSharedRefresh').click();await a.page.locator('#sharedProposalSection>summary').click();await a.page.locator('#sharedProposals').getByText('SV Test: Vertretungsvorschlag',{exact:false}).waitFor();
  a.setOldServer(true);await a.page.locator('#btnSharedRefresh').click();
  await a.page.locator('#sharedProposals').getByRole('button',{name:'Vorschlag annehmen',exact:true}).waitFor();
  assert.equal(await a.page.locator('#sharedProposals').getByRole('button',{name:'Änderung annehmen',exact:true}).count(),0);
  a.setOldServer(false);await a.page.locator('#btnSharedRefresh').click();
  const firstItem=a.page.locator('#sharedProposals .sharedProposalItem').filter({hasText:'2026-10-20'});
  await firstItem.getByRole('button',{name:'Änderung annehmen',exact:true}).click();
  await a.page.locator('#sharedSummary').filter({hasText:'Stand 2'}).waitFor();
  assert.equal(await a.page.evaluate(()=>state.schedule['2026-10-20']['test-one'].code),'F5');
  await b.page.locator('#btnSharedProposalOverview').click();
  await b.page.locator('#btnSharedRefresh').click();await b.page.waitForFunction(()=>state.schedule['2026-10-20']['test-one'].code==='F5');
  assert.equal(await b.page.locator('#btnSharedProposalOverview').textContent(),'Offene Vorschläge (1)');
  assert.equal(await b.page.locator('#sharedProposals .sharedProposalItem[data-status="accepted"]').count(),1);
  assert.equal(await b.page.locator('#sharedProposals .sharedProposalItem[data-status="pending"]').count(),1);
  assert.equal(await b.page.locator('.cell[data-eid="test-one"][data-day="2026-10-20"] .sharedProposalMark').count(),0);
  await b.page.locator('.cell[data-eid="test-one"][data-day="2026-10-21"] .sharedProposalMark').waitFor({state:'attached'});
  // A reload retains the undecided remainder on the author's device.
  await b.page.reload();await b.page.waitForFunction(()=>window.__APP_BOOT_OK__===true);
  await b.page.locator('#btnSharedProposalOverview').filter({hasText:'(1)'}).waitFor();
  const secondItem=a.page.locator('#sharedProposals .sharedProposalItem').filter({hasText:'2026-10-21'});
  await secondItem.getByRole('button',{name:'Änderung ablehnen',exact:true}).click();
  await a.page.locator('#btnSharedProposalOverview').filter({hasText:'(0)'}).waitFor();
  await b.page.locator('#btnSharedProposalOverview').click();await b.page.locator('#btnSharedRefresh').click();
  await b.page.locator('#btnSharedProposalOverview').filter({hasText:'(0)'}).waitFor();
  assert.equal(await b.page.locator('#sharedResolvedProposals .sharedProposalItem[data-status="accepted"]').count(),1);
  assert.equal(await b.page.locator('#sharedResolvedProposals .sharedProposalItem[data-status="rejected"]').count(),1);
  assert.notEqual(await b.page.evaluate(()=>state.schedule['2026-10-21']?.['test-one']?.code),'F6');
  // Another proposal remains separate even while the owner changes the same cell.
  await b.page.locator('#btnCloseData').click();
  await b.page.locator('.cell[data-eid="test-one"][data-day="2026-10-20"]').click();await choosePlanningQuickShift(b.page,'F6');
  await b.page.locator('#btnDataPanel').click();await b.page.locator('#sharedReason').fill('Konflikttest');await b.page.locator('#btnSharedPropose').click();
  await b.page.locator('#dataActionMessage').filter({hasText:'Vorschlag eingereicht'}).waitFor();
  await a.page.locator('#btnCloseData').click();await a.page.locator('#weeks button').filter({hasText:'19.10'}).click();
  await a.page.locator('.cell[data-eid="test-one"][data-day="2026-10-20"]').click();await choosePlanningQuickShift(a.page,'F4');
  await a.page.locator('#btnDataPanel').click();await a.page.locator('#sharedMessage').filter({hasText:'aktuell'}).waitFor();
  await a.page.locator('#btnSharedRefresh').click();
  await a.page.locator('#sharedProposals .sharedProposalConflict').waitFor();
  assert.equal(await a.page.locator('#sharedProposals').getByRole('button',{name:'Änderung annehmen',exact:true}).isDisabled(),true);
  await a.page.locator('#sharedProposals').getByRole('button',{name:'Änderung ablehnen',exact:true}).click();
  await a.page.locator('#btnSharedProposalOverview').filter({hasText:'(0)'}).waitFor();
  assert.equal(await a.page.evaluate(()=>state.schedule['2026-10-20']['test-one'].code),'F4');
  await b.page.locator('#btnSharedRefresh').click();await b.page.waitForFunction(()=>state.schedule['2026-10-20']['test-one'].code==='F4');
  assert.equal(await b.page.locator('#sharedResolvedProposals .sharedProposalItem[data-status="rejected"]').count(),2);
  await a.page.locator('#btnSharedRefresh').click();
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());
  await a.page.locator('#sharedMember').selectOption(ids[1]);await a.page.locator('#sharedGrantFrom').fill(today);await a.page.locator('#sharedGrantTo').fill(today);await a.page.locator('#btnSharedGrant').click();
  await a.page.locator('#sharedGrants').getByRole('button',{name:'Freigabe beenden'}).waitFor();
  await b.page.locator('#btnSharedRefresh').click();await b.page.locator('#sharedSummary').filter({hasText:'Vertretung darf bearbeiten'}).waitFor();
  await a.page.locator('#sharedGrants').getByRole('button',{name:'Freigabe beenden'}).click();await b.page.locator('#btnSharedRefresh').click();await b.page.locator('#sharedSummary').filter({hasText:'Ansehen und Vorschläge'}).waitFor();
  assert.equal(await b.page.locator('#btnSharedSave').isDisabled(),true);
  // A new device knows only its account, with no cached branch selection.
  // Membership resolves before any legacy account-plan read or write.
  const fresh=await device(1);await login(fresh);
  await fresh.page.locator('#sharedSummary').filter({hasText:'Ansehen und Vorschläge'}).waitFor();
  assert.equal(await fresh.page.locator('#sharedBranchPicker').isVisible(),false);
  assert.equal(await fresh.page.locator('#personalCloudActions').isVisible(),false);
  assert.equal(await fresh.page.locator('#sharedSetup').isVisible(),false);
  assert.equal(await fresh.page.locator('#sharedBranchSelect option').filter({hasText:'Persönliche Planung'}).count(),0);
  assert.deepEqual(fresh.personalRequests,[]);
  await fresh.context.close();
  await Promise.all([a.page.waitForEvent('load'),a.page.locator('#btnSharedAdopt').click()]);await a.page.waitForFunction(()=>window.__APP_BOOT_OK__===true);
  await a.page.locator('#weeks button').filter({hasText:'19.10'}).click();
  await a.page.locator('.cell[data-eid="test-one"][data-day="2026-10-20"]').click();await choosePlanningQuickShift(a.page,'F6');
  await a.page.locator('#btnDataPanel').click();await a.page.locator('#sharedMessage').filter({hasText:'aktuell'}).waitFor();
  // No refresh/adopt click and no reload on the receiving device: the foreground
  // interval must update both visible and stored plans on its own.
  await b.page.waitForFunction(()=>state.schedule['2026-10-20']['test-one'].code==='F6',null,{timeout:25000});
  assert.equal(await b.page.evaluate(()=>state.schedule['2026-10-20']['test-one'].code),'F6');
  // The independent archive is a valid standard backup, including attributed history.
  await a.page.locator('#sharedSnapshotSelect').locator('xpath=ancestor::details').locator('summary').click();
  const downloadPromise=a.page.waitForEvent('download');await a.page.locator('#btnSharedArchive').click();
  const downloaded=await downloadPromise,archive=JSON.parse(fs.readFileSync(await downloaded.path(),'utf8'));
  assert.equal(archive.backupVersion,2);assert.ok(archive.sharedArchive.events.some(e=>e.kind==='decide_proposal_items'));
  assert.equal(JSON.stringify(archive).includes('access_token'),false);assert.equal(JSON.stringify(archive).includes('refresh_token'),false);
  assert.equal(await b.page.evaluate(data=>validateAndNormalizeBackupData(data).error,archive),'');
  await b.page.evaluate(data=>importBackupFromObject(data,{reload:false}),archive);
  await b.page.reload();await b.page.waitForFunction(()=>window.__APP_BOOT_OK__===true);
  assert.equal(await b.page.evaluate(()=>state.schedule['2026-10-20']['test-one'].code),'F6');
  await b.page.locator('#btnDataPanel').click();
  await b.page.locator('#btnCloseData').click();assert.equal(await b.page.locator('#dataDialog').isVisible(),false);
  assert.equal(await b.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('Shared browser/database flow passed: durable separate proposals, reload, cell markers, accept, reject, conflict protection, automatic foreground updates, delegate/revoke and mobile layout.');
 }catch(error){for(const page of pages) console.error(await page.evaluate(()=>({message:document.getElementById('dataActionMessage').textContent,shared:document.getElementById('sharedMessage').textContent,summary:document.getElementById('sharedSummary').textContent})));throw error;
 }finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await db.close();}
}
main().catch(e=>{console.error(e);process.exit(1);});
