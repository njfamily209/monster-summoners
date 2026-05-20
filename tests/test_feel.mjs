/* ===========================================================
   Aetherbound M-Combat-Feel — animation + audio hook tests
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
window.confirm = () => true;

await new Promise(r => setTimeout(r, 30));
['data.js','art.js','save.js','summon.js','audio.js','combat.js','ui.js','game.js'].forEach(injectScript);
await new Promise(r => setTimeout(r, 80));

const G = window.__GAME__;
const D = window.GAME_DATA;
const S = window.GAME_SAVE;
const U = window.GAME_UI;
const AU = window.GAME_AUDIO;

const failures = [];
function assert(cond, msg) {
  if (!cond) { console.error('  FAIL:', msg); failures.push(msg); }
  else { console.log('  PASS:', msg); }
}
function section(name) { console.log('\n— ' + name + ' —'); }

section('Audio module');
assert(typeof AU === 'object' && AU !== null, 'GAME_AUDIO module exposed');
assert(typeof AU.play === 'function', 'AU.play exists');
assert(typeof AU.setMuted === 'function', 'AU.setMuted exists');
assert(typeof AU.isMuted === 'function', 'AU.isMuted exists');
// No-op should never throw
let threw = false;
try { AU.play('hit_crit'); AU.play('summon_pop', { volume: 0.5 }); }
catch (e) { threw = true; }
assert(!threw, 'AU.play never throws on unknown sounds (stub)');

section('UI hooks exposed');
assert(typeof U.shakeField === 'function', 'shakeField exposed');
assert(typeof U.hitStop === 'function', 'hitStop exposed');

section('Battle field has id for shake target');
S.clear();
G.state.player = S.loadOrInit();
G.persistNow();
G.pickStage('goblin_camp_1');
G.setSelectedHeroIds(G.state.player.ownedInstances.slice(0, 3).map(i => i.id));
G.confirmTeam();
const field = document.getElementById('battle-field');
assert(field, 'battle-field id present on .field');

section('Avatar-dominant unit layout');
const unitNodes = document.querySelectorAll('.unit');
assert(unitNodes.length === 6, '6 units rendered (3 allies + 3 enemies)');
const firstUnit = unitNodes[0];
assert(firstUnit.querySelector('.unit-name-bar'), 'each unit has a name bar');
assert(firstUnit.querySelector('.unit-name-bar .name'), 'name text inside name bar');
assert(firstUnit.querySelector('.unit-name-bar .el-badge'), 'element badge inside name bar');
assert(firstUnit.querySelector('.unit-avatar'), 'each unit has a .unit-avatar wrapper');
assert(firstUnit.querySelector('.unit-avatar .portrait'), 'portrait sits inside the avatar');
assert(firstUnit.querySelector('.unit-avatar .role-overlay'), 'role overlay sits inside the avatar');
assert(firstUnit.querySelector('.unit-avatar .hp-overlay'), 'HP overlay pinned to avatar');
assert(firstUnit.querySelector('.unit-avatar .hp-overlay .hp-bar'), 'HP bar inside hp-overlay');
assert(firstUnit.querySelector('.unit-avatar .hp-overlay .hp-text'), 'HP text inside hp-overlay');
assert(firstUnit.querySelector('.unit-avatar .status-row.floating'), 'status row floats on avatar');
assert(firstUnit.querySelector('.unit-avatar .fx-layer'), 'fx-layer sits inside avatar (so popups position over character)');
const atbWrap = firstUnit.querySelector('.atb-wrap');
assert(atbWrap, 'ATB wrap exists inside .unit (sits below avatar)');
assert(atbWrap.querySelector('.atb-label'), 'ATB has a TURN label so attack order reads clearly');
assert(atbWrap.querySelector('.atb-bar .atb-fill'), 'ATB fill bar present');
// Avatar IDs preserved so combat hooks still find them
const allyId = G.state.battle.ally[0].id;
assert(document.getElementById('unit-' + allyId), 'unit-<id> still findable');
assert(document.getElementById('fx-' + allyId), 'fx-<id> still findable for popups');

section('shakeField applies a shake class');
U.shakeField('small');
assert(field.classList.contains('shake-small'), 'shake-small class applied');
U.shakeField('big');
assert(field.classList.contains('shake-big'), 'shake-big class applied (replaces shake-small)');
U.shakeField('crit');
assert(field.classList.contains('shake-crit'), 'shake-crit class applied');

section('hitStop applies hit-stop class');
U.hitStop(50);
assert(field.classList.contains('hit-stop'), 'hit-stop class applied');

section('Popup → crit triggers shake-crit + hit-stop');
const ally = G.state.battle.ally[0];
// Reset field state
field.classList.remove('shake-small', 'shake-big', 'shake-crit', 'hit-stop');
U.showPopup(G.state.battle.enemy[0], '999!', 'crit');
assert(field.classList.contains('shake-crit'), 'crit popup triggers shake-crit');
assert(field.classList.contains('hit-stop'), 'crit popup triggers hit-stop');

section('Popup → dmg triggers shake-small');
field.classList.remove('shake-small', 'shake-big', 'shake-crit');
U.showPopup(G.state.battle.enemy[0], '-200', 'dmg');
assert(field.classList.contains('shake-small'), 'normal damage triggers shake-small');

section('Popup → strong triggers shake-big');
field.classList.remove('shake-small', 'shake-big', 'shake-crit');
U.showPopup(G.state.battle.enemy[0], 'Strong!', 'strong');
assert(field.classList.contains('shake-big'), 'strong popup triggers shake-big');

section('animateUnit lunge does windup-then-lunge');
const allyNode = document.getElementById('unit-' + ally.id);
assert(allyNode, 'ally unit node exists');
U.animateUnit(ally, 'lunge');
const allyBody = allyNode.querySelector('.unit-body') || allyNode;
assert(allyBody.classList.contains('windup'), 'windup class applied immediately');
// CSS var set inline?
assert(allyNode.style.getPropertyValue('--windup-color'), 'windup-color CSS var set');
await new Promise(r => setTimeout(r, 220));
assert(allyBody.classList.contains('lunge-ally') || allyBody.classList.contains('lunge'), 'lunge class applied after windup phase');

section('Death drop triggers when popup brings HP to 0');
const target = G.state.battle.enemy[0];
target.hp = 0;
target._dyingAnimDone = undefined;
U.showPopup(target, '-9999!', 'crit');
await new Promise(r => setTimeout(r, 150));
const targetNode = document.getElementById('unit-' + target.id);
assert(targetNode && targetNode.classList.contains('dying'), 'unit gets dying class on lethal hit');
assert(target._dyingAnimDone === true, 'dying flag set (prevents re-trigger)');

section('Death drop fires only once');
target._dyingAnimDone = true;
targetNode.classList.remove('dying');
U.showPopup(target, '-200', 'dmg'); // again
await new Promise(r => setTimeout(r, 150));
assert(!targetNode.classList.contains('dying'), 'second lethal popup does NOT re-trigger drop');

section('Element burst on hit');
assert(typeof U.elementBurst === 'function', 'elementBurst exposed');
const target2 = G.state.battle.ally[1];
const fxBefore = document.getElementById('fx-' + target2.id).children.length;
U.elementBurst(target2, 'fire');
const fxAfter = document.getElementById('fx-' + target2.id).children.length;
assert(fxAfter === fxBefore + 1, 'elementBurst adds one node to fx layer');
const burstNode = document.getElementById('fx-' + target2.id).querySelector('.element-burst.el-fire');
assert(burstNode, 'fire burst has .element-burst.el-fire class');
['water','wind','light','dark'].forEach(el => {
  U.elementBurst(target2, el);
  const n = document.getElementById('fx-' + target2.id).querySelector('.element-burst.el-' + el);
  assert(n, el + ' burst class renders');
});

section('CSS keyframes present');
const cssText = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
assert(/@keyframes\s+pop-crit/.test(cssText), 'pop-crit keyframe exists');
assert(/@keyframes\s+shake-crit/.test(cssText), 'shake-crit keyframe exists');
assert(/@keyframes\s+windup-charge/.test(cssText), 'windup-charge keyframe exists');
assert(/@keyframes\s+unit-die/.test(cssText), 'unit-die keyframe exists');
assert(/@keyframes\s+element-burst/.test(cssText), 'element-burst keyframe exists');
assert(/@keyframes\s+idle-breath/.test(cssText), 'idle-breath keyframe exists (avatar idle animation)');
assert(/\.unit-avatar/.test(cssText), 'unit-avatar CSS class defined');
assert(/\.hp-overlay/.test(cssText), 'hp-overlay CSS class defined');
assert(/\.unit-name-bar/.test(cssText), 'unit-name-bar CSS class defined');
assert(/\.status-row\.floating/.test(cssText), 'status-row.floating CSS class defined');
assert(/\.hit-stop/.test(cssText), 'hit-stop class defined');
// Responsive
assert(/@media\s*\(max-width:\s*640/.test(cssText), 'small mobile breakpoint defined');
assert(/@media\s*\(max-width:\s*900/.test(cssText), 'medium breakpoint defined');

section('Errors during run');
console.log('  collected errors:', errors.length);
errors.forEach(e => console.log('    ', e?.message || e));
assert(errors.length === 0, 'no JS errors during M-Combat-Feel test run');

console.log('\n=================================');
console.log(`Total failures: ${failures.length}`);
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('All M-Combat-Feel tests passed.');
  process.exit(0);
}
