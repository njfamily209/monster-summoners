/* ===========================================================
   Aetherbound — sprite framework + procedural fallback tests
   Owner: QA
   =========================================================== */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const stripped = html.replace(/<script\s+src=[^>]*><\/script>/g, '');
const dom = new JSDOM(stripped, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
});
const window = dom.window;
const document = window.document;

function injectScript(file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const sc = document.createElement('script');
  sc.textContent = code;
  document.body.appendChild(sc);
}

let errors = [];
window.addEventListener('error', e => errors.push(e.error || e.message));
window.console.error = (...args) => errors.push(args.join(' '));

await new Promise(r => setTimeout(r, 30));
// Load in same order as index.html — sprites.js after art.js.
['data.js','art.js','sprites.js','save.js','summon.js','audio.js','combat.js','ui.js','game.js']
  .forEach(injectScript);
await new Promise(r => setTimeout(r, 80));

const A = window.GAME_ART;
const SP = window.GAME_SPRITES;
const D = window.GAME_DATA;

const failures = [];
function assert(cond, msg) {
  if (!cond) { console.error('  FAIL:', msg); failures.push(msg); }
  else { console.log('  PASS:', msg); }
}
function section(name) { console.log('\n— ' + name + ' —'); }

section('Sprite module shape');
assert(typeof SP === 'object' && SP !== null, 'GAME_SPRITES exposed');
assert(typeof SP.getSpriteUrl === 'function', 'getSpriteUrl is a function');
assert(typeof SP.hasSprite === 'function', 'hasSprite is a function');
assert(typeof SP.registerSprite === 'function', 'registerSprite is a function');
assert(typeof SP.LAYOUT === 'object' && SP.LAYOUT.frameSize === 64,
  'LAYOUT.frameSize === 64 (LPC standard)');
assert(SP.LAYOUT.rows && SP.LAYOUT.rows.idle === 2, 'LAYOUT.rows.idle === 2');
assert(SP.LAYOUT.rows.attack === 14, 'LAYOUT.rows.attack === 14');
assert(SP.LAYOUT.rows.hurt === 20, 'LAYOUT.rows.hurt === 20');

section('art.js getPack accessor');
assert(typeof A.getPack === 'function', 'GAME_ART.getPack exposed');
assert(A.getPack('procedural') && typeof A.getPack('procedural').renderPortrait === 'function',
  'procedural pack accessible via getPack');
assert(A.getPack('lpc') && typeof A.getPack('lpc').renderPortrait === 'function',
  'lpc pack registered by sprites.js');
assert(A.getCurrentPack() === 'lpc', 'lpc pack is active by default');
assert(A.getPack('does_not_exist') === null, 'getPack returns null for unknown id');

section('Fallback: unmapped IDs use procedural SVG');
const hero = D.heroById('ember_knight');
assert(hero, 'ember_knight hero exists');
assert(!SP.hasSprite('ember_knight'), 'ember_knight has no sprite by default');
const html1 = A.renderPortrait(hero);
assert(/<svg/i.test(html1), 'renderPortrait returns procedural SVG for unmapped id');
assert(!/lpc-sprite/.test(html1), 'no lpc-sprite class when no sprite mapped');

section('Sprite path: mapped IDs render LPC sprite');
SP.registerSprite('ember_knight', 'assets/sprites/ember_knight.png');
assert(SP.hasSprite('ember_knight'), 'hasSprite true after registerSprite');
assert(SP.getSpriteUrl('ember_knight') === 'assets/sprites/ember_knight.png',
  'getSpriteUrl returns registered path');
const html2 = A.renderPortrait(hero);
assert(/lpc-sprite/.test(html2), 'lpc-sprite class rendered for mapped id');
assert(html2.includes('assets/sprites/ember_knight.png'), 'sprite URL in inline style');
assert(html2.includes('--frame-size:64px'), '--frame-size CSS var set');
assert(html2.includes('--idle-y:-128px'), '--idle-y = -(row 2 * 64) = -128');
assert(html2.includes('--attack-y:-896px'), '--attack-y = -(row 14 * 64) = -896');
assert(html2.includes('--hurt-y:-1280px'), '--hurt-y = -(row 20 * 64) = -1280');
assert(html2.includes('data-sprite-id="ember_knight"'), 'data-sprite-id attribute set');
assert(html2.includes('aria-label='), 'aria-label set for accessibility');

section('Unmap restores procedural fallback');
delete SP.SPRITE_MAP['ember_knight'];
assert(!SP.hasSprite('ember_knight'), 'hasSprite false after delete');
const html3 = A.renderPortrait(hero);
assert(!/lpc-sprite/.test(html3), 'reverts to procedural after unmap');
assert(/<svg/i.test(html3), 'procedural SVG returned again');

section('CSS keyframes for sprite animation present');
const cssText = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
assert(/\.lpc-sprite\b/.test(cssText), '.lpc-sprite class defined');
assert(/@keyframes\s+lpc-idle/.test(cssText), 'lpc-idle keyframe defined');
assert(/@keyframes\s+lpc-attack\b/.test(cssText), 'lpc-attack keyframe defined');
assert(/@keyframes\s+lpc-attack-windup/.test(cssText), 'lpc-attack-windup keyframe defined');
assert(/@keyframes\s+lpc-hurt/.test(cssText), 'lpc-hurt keyframe defined');
assert(/@keyframes\s+lpc-die/.test(cssText), 'lpc-die keyframe defined');
assert(/\.unit\.lunge\s+\.lpc-sprite/.test(cssText),
  '.unit.lunge .lpc-sprite hook for attack swap');
assert(/\.unit\.windup\s+\.lpc-sprite/.test(cssText),
  '.unit.windup .lpc-sprite hook for windup');
assert(/\.unit\.dying\s+\.lpc-sprite/.test(cssText),
  '.unit.dying .lpc-sprite hook for death');
assert(/prefers-reduced-motion/.test(cssText), 'reduced-motion fallback honored');
assert(/image-rendering:\s*pixelated/.test(cssText),
  'pixelated rendering keeps sprite art crisp');

section('Assets folder + sourcing guide exist');
assert(fs.existsSync(path.join(ROOT, 'assets', 'sprites')),
  'assets/sprites/ folder exists');
assert(fs.existsSync(path.join(ROOT, 'assets', 'sprites', 'README.md')),
  'assets/sprites/README.md present (sourcing guide)');
const readme = fs.readFileSync(path.join(ROOT, 'assets', 'sprites', 'README.md'), 'utf8');
assert(/LPC/i.test(readme), 'README references LPC format');
assert(/SPRITE_MAP/.test(readme), 'README explains SPRITE_MAP registration');
assert(/opengameart\.org/i.test(readme), 'README links to OpenGameArt');

section('index.html loads sprites.js after art.js');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const artIdx = indexHtml.indexOf('art.js');
const spritesIdx = indexHtml.indexOf('sprites.js');
assert(artIdx > 0, 'art.js referenced in index.html');
assert(spritesIdx > artIdx, 'sprites.js loaded AFTER art.js (dependency order)');

section('Errors during run');
console.log('  collected errors:', errors.length);
errors.forEach(e => console.log('    ', e?.message || e));
assert(errors.length === 0, 'no JS errors during sprite test run');

console.log('\n=================================');
console.log(`Total failures: ${failures.length}`);
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('All sprite-framework tests passed.');
  process.exit(0);
}
