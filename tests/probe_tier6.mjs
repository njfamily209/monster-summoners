import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const stripped = html.replace(/<script\s+src=[^>]*><\/script>/g, '');
const dom = new JSDOM(stripped, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
const window = dom.window;
const document = window.document;
window.confirm = () => true;

function inject(f) {
  const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const s = document.createElement('script');
  s.textContent = code;
  document.body.appendChild(s);
}
await new Promise(r => setTimeout(r, 50));
['data.js','art.js','sprites.js','save.js','summon.js','combat.js','ui.js','game.js'].forEach(inject);
await new Promise(r => setTimeout(r, 100));

const G = window.__GAME__;
G.navigate('stage-select');
await new Promise(r => setTimeout(r, 50));

const app = document.getElementById('app');
const cards = app.querySelectorAll('.stage-card');
console.log(`Stage cards rendered: ${cards.length}`);

let failures = 0;
const expectedDifficulties = ['Novice', 'Standard', 'Veteran', 'Elite', 'Legendary', 'Mythic'];
const expectedDots = [1, 2, 3, 4, 5, 6];

cards.forEach((card, i) => {
  const diff = card.querySelector('.stage-difficulty');
  const dots = card.querySelectorAll('.tier-dot.filled');
  const label = diff ? diff.textContent : '(none)';
  const dotCount = dots.length;
  const ok = label === expectedDifficulties[i] && dotCount === expectedDots[i];
  console.log(`  Stage ${i+1}: difficulty="${label}" dots=${dotCount} → ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) failures++;
});

const tier6 = app.querySelector('.stage-card.tier-6');
const passT6 = !!tier6;
console.log(`tier-6 card present: ${passT6 ? 'PASS' : 'FAIL'}`);
if (!passT6) failures++;

console.log(`\nTotal failures: ${failures}`);
process.exit(failures > 0 ? 1 : 0);
