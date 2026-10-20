const fs = require('node:fs');
const path = require('node:path');
const version = require('../node_modules/@supabase/supabase-js/package.json').version;
if (version !== '2.118.0') throw new Error('Update the pinned vendor version and precache together.');
fs.mkdirSync('vendor', { recursive: true });
fs.copyFileSync(path.join('node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js'), `vendor/supabase-${version}.js`);
fs.copyFileSync(path.join('node_modules', '@supabase', 'supabase-js', 'LICENSE'), 'vendor/SUPABASE-LICENSE');
