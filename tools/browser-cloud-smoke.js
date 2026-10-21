const { choosePlanningQuickShift } = require('./browser-planning-helpers');
// Real browser SDK against a synthetic, intercepted Supabase HTTP API.
// No external request, email, real account or personal plan is used.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const {chromium,webkit}=require('playwright');
let doc=null;const api=[];const pages=[];
const user={id:'00000000-0000-4000-8000-000000000101',email:'synthetic@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
const now=Math.floor(Date.now()/1000);
const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',aud:'authenticated',iat:now,exp:now+3600})).toString('base64url')+'.c3ludGhldGlj';
async function main(){
const server=http.createServer((req,res)=>{const f=path.join(process.cwd(),req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(b)})});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const engine=process.env.BROWSER_ENGINE==='webkit'?webkit:chromium;
const browser=await engine.launch({executablePath:process.env.BROWSER_EXECUTABLE || undefined,args:engine===chromium?['--no-sandbox']:[]});
async function device(){
 const c=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
 await c.route('https://**/*',r=>r.abort());
 await c.route('https://zrosdhfxnwolxemqqvok.supabase.co/**',async r=>{
  const q=r.request(),u=new URL(q.url());api.push(q.method()+' '+u.pathname+' '+u.search);
  const send=(status,body)=>r.fulfill({status,contentType:'application/json',body:body===null?'':JSON.stringify(body)});
  if(u.pathname==='/auth/v1/token')return send(200,{access_token:token,refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,expires_at:now+3600,user});
  if(u.pathname==='/auth/v1/user')return send(200,user);
  if(u.pathname==='/auth/v1/logout')return send(204,null);
  if(u.pathname==='/rest/v1/rpc/wochenplan_collaboration'&&q.postDataJSON().p_action==='list')return send(200,[]);
  if(u.pathname==='/rest/v1/wochenplan_documents'){
   if(q.method()==='GET')return send(200,doc?[doc]:[]);
   const v=q.postDataJSON();
   if(q.method()==='POST'&&doc)return send(409,{code:'23505',message:'duplicate'});
   if(q.method()==='PATCH'&&u.searchParams.get('revision')!=='eq.'+doc.revision)return send(406,{code:'PGRST116',details:'The result contains 0 rows',message:'JSON object requested, multiple (or no) rows returned'});
   doc={...v,updated_at:new Date().toISOString()};return send(200,q.headers()['accept']?.includes('object')?doc:[doc]);
  }
  return send(404,{message:'unexpected path'});
 });
 const p=await c.newPage();pages.push(p);p.on('dialog',d=>d.accept());p.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await p.goto(url);await p.waitForFunction(()=>window.__APP_BOOT_OK__===true);return{c,p};
}
async function mode(p,name){await p.waitForFunction(name=>document.querySelector('#dataStatus').dataset.mode===name,name,{timeout:10000});console.log('MODE',name);}
async function editWeek(p,code){
 if(await p.locator('#dataDialog').isVisible())await p.locator('#btnCloseData').click();
 await p.locator('#weeks button').filter({hasText:'19.10'}).click();
 await p.locator('.cell[data-eid="test-one"][data-day="2026-10-20"]').click();
 await choosePlanningQuickShift(p,code);
}
async function login(p){await p.locator('#btnDataPanel').click();await p.locator('#cloudEmail').fill(user.email);await p.locator('#cloudPassword').fill('Synthetic-Password-123');await p.locator('#btnCloudLogin').click();}
try{
 const a=await device();console.log('device A booted');
 const fixture={master:{employees:[{id:'test-one',name:'Synthetic',target:'20:00',roleKey:'TZ20'}]},plan:{weekFrom:'2026-10-19',schedule:{'2026-10-20':{'test-one':{type:'shift',code:'F4',start:'09:00',end:'13:00',minutes:240,pause:0}}},absences:[]},ui:{teamCollapsed:true,currentView:'week'}};
 await a.p.evaluate(b=>importBackupFromObject(b,{reload:false}),fixture);await a.p.reload();await a.p.waitForFunction(()=>window.__APP_BOOT_OK__===true);console.log('A imported');
 await login(a.p);await mode(a.p,'first-upload');
 await a.p.locator('#btnCloudUpload').click();await mode(a.p,'synced');assert.equal(doc.revision,1);console.log('A uploaded');
 const b=await device();await login(b.p);await mode(b.p,'choose');
 await Promise.all([b.p.waitForEvent('load'),b.p.locator('#btnCloudDownload').click()]);await b.p.waitForFunction(()=>window.__APP_BOOT_OK__===true);assert.equal(await b.p.evaluate(()=>getBackupSummary(collectFullBackupSnapshot()).shifts),1);console.log('B adopted');
 await mode(b.p,'synced');
 await editWeek(a.p,'F5');await mode(a.p,'synced');assert.equal(doc.revision,2);console.log('A autosaved');
 await editWeek(b.p,'F6');await mode(b.p,'choose');
 assert.equal(doc.revision,2);assert.equal(doc.payload.storage.wochenplan_plan_v10.schedule['2026-10-20']['test-one'].code,'F5');
 console.log(JSON.stringify({realSdkMockApiBrowser:'passed',apiRequests:api.length}));
}catch(e){
 console.log('FAILED',e.message,'API',api,'REV',doc?.revision);
 for(const p of pages){try{console.log(await p.evaluate(()=>({mode:document.querySelector('#dataStatus').dataset.mode,message:document.querySelector('#cloudMessage').textContent,action:document.querySelector('#dataActionMessage').textContent})));}catch{}}
 throw e;
}finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exit(1)});
