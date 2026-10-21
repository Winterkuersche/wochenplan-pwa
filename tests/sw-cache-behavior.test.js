const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSwContext({ fetchImpl, cachesImpl }) {
  const listeners = {};
  const context = vm.createContext({
    APP_META: { cacheName: 'cache-test-v1' },
    importScripts: () => {},
    self: {
      location: { origin: 'https://example.test' },
      addEventListener: (name, fn) => {
        listeners[name] = fn;
      },
      skipWaiting: () => {},
      clients: { claim: () => Promise.resolve() }
    },
    caches: cachesImpl,
    fetch: fetchImpl,
    URL
  });

  const swCode = fs.readFileSync(path.join(process.cwd(), 'sw.js'), 'utf8');
  vm.runInContext(swCode, context, { filename: 'sw.js' });
  return listeners;
}

test('SW: Navigation nutzt index.html Fallback bei Offline', async () => {
  const cacheCalls = [];
  const listeners = loadSwContext({
    fetchImpl: () => Promise.reject(new Error('offline')),
    cachesImpl: {
      open: async () => ({ put: () => Promise.resolve() }),
      match: async (request, options) => {
        cacheCalls.push({ request, options });
        if (request === './index.html') return { ok: true, source: 'index-cache' };
        return null;
      }
    }
  });

  let response;
  await listeners.fetch({
    request: {
      method: 'GET',
      url: 'https://example.test/month?tab=1',
      mode: 'navigate',
      destination: 'document'
    },
    respondWith: (promise) => {
      response = promise;
    }
  });

  const resolved = await response;
  assert.equal(resolved.source, 'index-cache');
  assert.equal(
    JSON.stringify(cacheCalls[0]),
    JSON.stringify({ request: './index.html', options: { ignoreSearch: true } })
  );
});

test('SW: Script-Fallback nutzt ignoreSearch, API-Fallback nicht', async () => {
  const cacheCalls = [];
  const listeners = loadSwContext({
    fetchImpl: () => Promise.reject(new Error('offline')),
    cachesImpl: {
      open: async () => ({ put: () => Promise.resolve() }),
      match: async (request, options) => {
        cacheCalls.push({ request, options });
        return { ok: true };
      }
    }
  });

  let scriptResponse;
  await listeners.fetch({
    request: {
      method: 'GET',
      url: 'https://example.test/app.js?v=2026-03-29-1',
      mode: 'same-origin',
      destination: 'script'
    },
    respondWith: (promise) => {
      scriptResponse = promise;
    }
  });
  await scriptResponse;

  let apiResponse;
  await listeners.fetch({
    request: {
      method: 'GET',
      url: 'https://example.test/api/data?x=1',
      mode: 'same-origin',
      destination: ''
    },
    respondWith: (promise) => {
      apiResponse = promise;
    }
  });
  await apiResponse;

  assert.equal(JSON.stringify(cacheCalls[0].options), JSON.stringify({ ignoreSearch: true }));
  assert.equal(cacheCalls[1].options, undefined);
});

test('SW: HTTP 503 cannot poison an existing navigation or script cache before going offline', async () => {
  for (const destination of ['document', 'script']) {
    let offline = false, writes = 0;
    const cached = new Response('working application', { status: 200 });
    const listeners = loadSwContext({
      fetchImpl: async () => { if (offline) throw Error('offline'); return new Response('server unavailable', { status: 503 }); },
      cachesImpl: {
        open: async () => ({ put: async () => { writes++; } }),
        match: async () => cached.clone()
      }
    });
    const request = { method: 'GET', url: 'https://example.test/index.html', mode: destination === 'document' ? 'navigate' : 'same-origin', destination };
    let pending;
    listeners.fetch({ request, respondWith: result => { pending = result; } });
    assert.equal((await pending).status, 503);
    await new Promise(setImmediate);
    assert.equal(writes, 0);
    offline = true;
    listeners.fetch({ request, respondWith: result => { pending = result; } });
    assert.equal(await (await pending).text(), 'working application');
  }
});

test('SW: a failed cache write does not reject a successful network response', async () => {
  const writes = [], lifetime = [];
  const listeners = loadSwContext({
    fetchImpl: async () => new Response('fresh application', { status: 200 }),
    cachesImpl: {
      open: async () => ({ put: async (_request, response) => { writes.push(await response.text()); throw Error('quota'); } }),
      match: async () => null
    }
  });
  let pending;
  listeners.fetch({ request: { method: 'GET', url: 'https://example.test/app.js', destination: 'script' },
    respondWith: result => { pending = result; }, waitUntil: result => lifetime.push(result) });
  assert.equal(await (await pending).text(), 'fresh application');
  await Promise.all(lifetime);
  assert.deepEqual(writes, ['fresh application']);
});
