# Supabase browser client

Pinned to `@supabase/supabase-js` 2.118.0 in package.json and package-lock.json.
The unmodified UMD browser bundle is committed so GitHub Pages needs no build
step and the offline app can start without a CDN. Rebuild with:

```sh
npm ci --ignore-scripts
node tools/vendor-supabase.js
```

Keep the versioned filename, index script tag and Service Worker precache in sync.
