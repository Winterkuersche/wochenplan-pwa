// Deterministic maintenance report. Similarity and reachability are review hints.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=process.cwd(),html=fs.readFileSync('index.html','utf8');
const meta=vm.runInNewContext(fs.readFileSync('version.js','utf8')+'\nAPP_META;');
const files=fs.readdirSync(root).filter(f=>f.endsWith('.js'));
const failures=[],hints=[],blocks=new Map();
const loaded=new Set(Array.from(html.matchAll(/<script[^>]+src="(?:\.\/)?([^"?]+\.js)(?:\?v=([^"]+))?"/g)).filter(m=>!m[1].startsWith('http')).map(m=>{
 if(m[2]!==meta.assetVersion) failures.push(`Asset-Version: ${m[1]} (${m[2]||'fehlt'})`);return m[1];
}));
const htmlFiles=fs.readdirSync(root).filter(f=>f.endsWith('.html')).map(f=>fs.readFileSync(f,'utf8')).join('\n');
for(const file of files){
 const source=fs.readFileSync(file,'utf8');
 try{new vm.Script(source,{filename:file});}catch(e){failures.push(`${file}: ${e.message}`);}
 if(!htmlFiles.includes(file)&&!['sw.js','version.js'].includes(file))hints.push(`${file}: kein direkter Verweis in HTML; dynamische Nutzung vor Entfernen prüfen.`);
 const lines=source.split('\n');
 // Exact repeated blocks only. No rewriting, semantic-equivalence claims or auto-removal.
 for(let i=0;i+24<lines.length;i+=25){
  const block=lines.slice(i,i+25).map(l=>l.trim()).join('\n');if(block.length<700)continue;
  const key=crypto.createHash('sha256').update(block).digest('hex');
  const previous=blocks.get(key);if(previous&&previous.file!==file)hints.push(`Gleicher Codeblock: ${previous.file}:${previous.line} und ${file}:${i+1}. Fachliche Absicht prüfen.`);
  else blocks.set(key,{file,line:i+1});
 }
}
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const report=`# Wartungsprüfung\n\nCommit: ${commit}\nApp: ${meta.version}\n\n## Fehler\n\n${failures.length?failures.map(x=>'- '+x).join('\n'):'Keine Fehler bei Syntax und Asset-Versionen.'}\n\n## Hinweise zur manuellen Prüfung\n\n${hints.length?hints.map(x=>'- '+x).join('\n'):'Keine Fundstellen in diesen begrenzten Prüfungen.'}\n\nGleiche Blöcke und fehlende direkte Verweise sind Hinweise, keine nachgewiesenen Fehler. Sicherheits-/Funktions-/Browserprüfungen laufen separat.\n`;
const index=process.argv.indexOf('--report');if(index>=0)fs.writeFileSync(process.argv[index+1],report);
console.log(report);if(failures.length)process.exitCode=1;
