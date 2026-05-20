import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '..';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const stripped = html.replace(/<script\s+src=[^>]*><\/script>/g, '');
const dom = new JSDOM(stripped, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
});
const window = dom.window;
const document = window.document;
const errors = [];
window.addEventListener('error', e => errors.push('ERR: ' + (e.error?.message || e.message)));
window.console.error = (...args) => errors.push('console.error: ' + args.join(' '));
window.console.warn  = (...args) => console.log('warn:', ...args);

function inject(file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const sc = document.createElement('script');
  sc.textContent = code;
  document.body.appendChild(sc);
}

await new Promise(r => setTimeout(r, 30));
['data.js','art.js','sprites.js','save.js','summon.js','audio.js','combat.js','ui.js','game.js'].forEach(inject);
await new Promise(r => setTimeout(r, 100));

console.log('GAME_DATA:', !!window.GAME_DATA);
console.log('GAME_ART:',  !!window.GAME_ART);
console.log('GAME_SAVE:', !!window.GAME_SAVE);
console.log('GAME_UI:',   !!window.GAME_UI);
console.log('GAME_AUDIO:',!!window.GAME_AUDIO);
console.log('GAME_COMBAT:',!!window.GAME_COMBAT);
console.log('__GAME__:',  !!window.__GAME__);
console.log('GAME_SPRITES:', !!window.GAME_SPRITES);
console.log('');
console.log('Title rendered:', !!document.querySelector('.title h1'));
console.log('Start button:', !!document.querySelector('.btn-primary-cta'));
console.log('');
console.log('ERRORS:', errors.length);
errors.forEach(e => console.log('  ', e));
process.exit(errors.length > 0 ? 1 : 0);
