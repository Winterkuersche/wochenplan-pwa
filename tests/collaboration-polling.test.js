const test=require('node:test'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {loadScripts}=require('./test-helpers');
const payload=code=>({backupVersion:2,storage:{wochenplan_master_v10:{employees:[{id:'synthetic'}]},wochenplan_plan_v10:{schedule:{'2026-10-20':{synthetic:{code}}},absences:[]},wochenplan_ui_v10:{}}});

function fixture(t,{shared=false}={}) {
 const nodes=new Map(),timers=new Map(),documentEvents=new Map(),windowEvents=new Map(),values=new Map();let next=0,local=payload('F4'),hasBranch=shared,reads=0;
 const node=()=>({value:'',textContent:'',dataset:{},options:[],children:[],classList:{toggle(){},add(){}},addEventListener(){},replaceChildren(){this.options=[];this.children=[];},append(child){this.options.push(child);this.children.push(child);},querySelectorAll:()=>[]});
 const document={hidden:false,getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node,querySelectorAll:()=>[],addEventListener:(name,fn)=>documentEvents.set(name,fn),removeEventListener:name=>documentEvents.delete(name)};
 const window={addEventListener:(name,fn)=>windowEvents.set(name,fn),removeEventListener:name=>windowEvents.delete(name)};
 const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const ctx=loadScripts(['cloud-sync.js','collaboration-proposals.js','collaboration.js','collaboration-panel.js'],{window,document,navigator:{onLine:true},localStorage:storage,sessionStorage:storage,location:{hash:''},state:{weekFrom:'2026-10-19'},crypto:webcrypto,TextEncoder,Uint8Array,URLSearchParams,MutationObserver:class{observe(){}disconnect(){}},setTimeout:(fn,delay)=>{timers.set(++next,{fn,delay});return next;},clearTimeout:id=>timers.delete(id)});
 const client={rpc:async(_,args)=>{
  if(args.p_action==='list')return{data:hasBranch?[{id:'b',name:'Synthetische Filiale'}]:[]};
  reads++;return{data:{id:'b',name:'Synthetische Filiale',revision:1,payload:payload('F4'),owner:true,can_edit:true,can_publish:true,members:[],delegations:[],snapshots:[],proposals:[],invites:[],publications:[]}};
 }};
 const c=window.WochenplanCollaborationPanel.mount({client,cloud:{resetLink(){}},config:{projectRef:'synthetic'},getSnapshot:()=>local});
 t.after(()=>c.dispose());
 async function fire(id){const timer=timers.get(id);timers.delete(id);return timer.fn();}
 return{c,ctx,window,storage,timers,document,documentEvents,windowEvents,fire,set:code=>local=payload(code),setShared:value=>hasBranch=value,get local(){return local;},get reads(){return reads;}};
}

test('personal online autosave is not interrupted by a shared-plan polling timer',{timeout:2000},async t=>{
 const f=fixture(t);await f.c.setUser({id:'synthetic'});
 let online={revision:1,payload:payload('F4')},writes=0,resolveWrite;const written=new Promise(resolve=>resolveWrite=resolve);
 const client={auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),getSession:async()=>({data:{session:{user:{id:'synthetic'}}}})},from(){let update;const query={select(){return query;},eq(){return query;},update(value){update=value;return query;},async maybeSingle(){if(update){online=structuredClone(update);writes++;resolveWrite();}return{data:structuredClone(online)};}};return query;}};
 const cloud=f.window.WochenplanCloud.create({client,projectRef:'synthetic',storage:f.storage,getSnapshot:()=>f.local,isPersonalActive:()=>f.c.personalActive});
 t.after(()=>cloud.dispose());await cloud.start();f.set('F5');cloud.scheduleSave();
 assert.equal([...f.timers.values()].filter(timer=>timer.delay===15000).length,0,'personal accounts must not start the shared refresh interval');
 const save=[...f.timers].find(([,timer])=>timer.delay===1500);await f.fire(save[0]);
 // The browser callback starts an asynchronous fingerprint before writing.
 await written;
 assert.equal(writes,1);assert.equal(online.payload.storage.wochenplan_plan_v10.schedule['2026-10-20'].synthetic.code,'F5');
});

test('shared polling refreshes once and pauses while hidden, offline or signed out',async t=>{
 const f=fixture(t,{shared:true});await f.c.setUser({id:'synthetic'});
 assert.equal(f.timers.size,1);const before=f.reads;await f.fire([...f.timers.keys()][0]);
 assert.equal(f.reads,before+1);assert.equal(f.timers.size,1);
 f.document.hidden=true;f.documentEvents.get('visibilitychange')();assert.equal(f.timers.size,0);
 f.document.hidden=false;f.documentEvents.get('visibilitychange')();assert.equal(f.timers.size,1);
 f.ctx.navigator.onLine=false;f.windowEvents.get('offline')();assert.equal(f.timers.size,0);
 f.ctx.navigator.onLine=true;f.windowEvents.get('online')();assert.equal(f.timers.size,1);
 await f.c.setUser(null);assert.equal(f.timers.size,0);
});

test('switching from shared to personal account cancels the previous polling interval',async t=>{
 const f=fixture(t,{shared:true});await f.c.setUser({id:'synthetic'});assert.equal(f.timers.size,1);
 f.setShared(false);await f.c.setUser({id:'other-synthetic'});assert.equal(f.c.personalActive,true);
 assert.equal(f.timers.size,0);
});
