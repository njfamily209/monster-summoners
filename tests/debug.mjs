import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve('..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const stripped = html.replace(/<script\s+src=[^>]*><\/script>/g, '');
const dom = new JSDOM(stripped, { url: 'file://'+ROOT+'/', runScripts:'dangerously', pretendToBeVisual:true });
const w = dom.window;
function inj(f){ const s=w.document.createElement('script'); s.textContent=fs.readFileSync(path.join(ROOT,f),'utf8'); w.document.body.appendChild(s); }
['data.js','art.js','save.js','combat.js','ui.js','game.js'].forEach(inj);
await new Promise(r=>setTimeout(r,80));
const S = w.GAME_SAVE;
console.log('localStorage exists:', typeof w.localStorage);
console.log('save():', S.save({version:1,test:true}));
console.log('load():', S.load());
console.log('localStorage[KEY]:', w.localStorage.getItem('aetherbound.save.v1'));
process.exit(0);
