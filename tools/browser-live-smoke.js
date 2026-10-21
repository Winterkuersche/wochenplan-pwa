// Check the actual published assets in a fresh, anonymous mobile context.
// All non-static-origin traffic and write requests are blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require('playwright');

async function main() {
  const expected = vm.runInNewContext(fs.readFileSync('version.js', 'utf8') + '\nAPP_META;');
  const url = 'https://winterkuersche.github.io/wochenplan-pwa/';
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
    args: ['--no-sandbox']
  });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const request = route.request();
      return new URL(request.url()).origin === new URL(url).origin && ['GET', 'HEAD'].includes(request.method())
        ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const errors = [], failedAssets = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400 && ['document', 'script', 'stylesheet'].includes(response.request().resourceType())) {
        failedAssets.push(`${response.status()} ${response.url()}`);
      }
    });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__APP_BOOT_OK__ === true);
    const actual = await page.evaluate(() => ({ version: APP_META.version, assetVersion: APP_META.assetVersion }));
    assert.deepEqual(actual, { version: expected.version, assetVersion: expected.assetVersion });
    assert.equal(await page.locator('#btnSharedCreate').count(), 1);
    assert.equal(await page.evaluate(() => typeof WochenplanCollaboration.create), 'function');
    for (let cycle = 0; cycle < 3; cycle++) {
      await page.locator('#btnDataPanel').click();
      assert.equal(await page.locator('#dataDialog').isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator('#btnCloseData').click();
      assert.equal(await page.locator('#dataDialog').isVisible(), false);
      assert.equal(await page.locator('#dataDialog').evaluate(dialog => dialog.getClientRects().length), 0);
    }
    assert.deepEqual(failedAssets, []);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ url, ...actual, mobileDialogCycles: 3, failedAssets, errors, productionWrites: 0 }));
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
