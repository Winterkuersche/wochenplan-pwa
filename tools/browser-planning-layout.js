// Geometry regressions with an isolated, synthetic 13-person team.
const assert = require('node:assert/strict');
async function checkPlanningLayout(browser, url, fixture) {
  for (const viewport of [{width:390,height:844},{width:844,height:390},{width:768,height:1024}]) {
    const context = await browser.newContext({viewport,serviceWorkers:'block'});
    try {
      await context.route('https://**/*', route => route.abort());
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date('2026-10-20T08:00:00Z'));
      const storage = structuredClone(fixture.storage);
      storage.wochenplan_master_v10.employees = Array.from({length:13},(_,i)=>({id:'layout-'+i,name:'Test Person '+i,roleKey:'TZ20',target:'20:00'}));
      await page.addInitScript(storage => {for(const [key,value] of Object.entries(storage))localStorage.setItem(key,JSON.stringify(value))},storage);
      await page.goto(url);
      await page.waitForFunction(()=>window.__APP_BOOT_OK__===true);
      const before = await page.evaluate(()=>localStorage.getItem('wochenplan_plan_v10'));
      const scroll = page.locator('#weekView .scroll');
      await scroll.scrollIntoViewIfNeeded();
      await scroll.evaluate(el=>{el.scrollTop=el.scrollHeight;el.scrollLeft=el.scrollWidth});
      const geometry = await scroll.evaluate(el=>{
        const rect=node=>{const r=node.getBoundingClientRect();return{top:r.top,left:r.left,bottom:r.bottom}};
        return{box:rect(el),head:rect(el.querySelector('.head')),name:rect(el.querySelector('.row:last-child .person')),date:rect(el.querySelector('.head .day:last-child')),cell:rect(el.querySelector('.row:last-child .cell:last-child')),scrollTop:el.scrollTop};
      });
      assert.ok(geometry.scrollTop>0,'13-person plan scrolls vertically');
      assert.ok(Math.abs(geometry.head.top-geometry.box.top)<2,'Day headings stay at top');
      assert.ok(Math.abs(geometry.name.left-geometry.box.left)<2,'Names remain at left');
      assert.ok(Math.abs(geometry.date.left-geometry.cell.left)<2,'Dates align with shifts after horizontal scrolling');
      assert.equal(await page.evaluate(()=>localStorage.getItem('wochenplan_plan_v10')),before,'Scrolling never saves plan data');
      await scroll.evaluate(el=>{el.scrollLeft=0});
      await page.locator('.cell[data-eid="layout-12"][data-day="2026-10-20"]').click();
      await page.locator('[data-quick="FLEX"]').click();
      const save=page.locator('#saveCustom');
      const checkSave=async()=>{
        const r=await save.boundingBox();const body=await page.locator('#editorOverlay .editorScroll').boundingBox();
        assert.ok(r&&r.y>=0&&r.y+r.height<=viewport.height+1,'Save stays within viewport');
        assert.ok(body.y+body.height<=r.y+1,'Save does not cover editable content');
      };
      await checkSave();
      await page.locator('#editorMoreOptions').evaluate(el=>{el.open=true});
      await page.locator('#editorOverlay .editorScroll').evaluate(el=>{el.scrollTop=el.scrollHeight});
      await checkSave();
      await page.locator('#editStart').selectOption('10:00');
      await save.click();
      await page.waitForFunction(()=>JSON.parse(localStorage.getItem('wochenplan_plan_v10')).schedule['2026-10-20']?.['layout-12']?.start==='10:00');
      console.log(`Planning layout passed ${viewport.width}x${viewport.height}: pinned dates/names, aligned columns, reachable Save and unchanged scroll data.`);
    } finally { await context.close(); }
  }
}
module.exports={checkPlanningLayout};
