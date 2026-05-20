/* ===========================================================
   Aetherbound M2.1 — summon + reveal
   Verifies: cost deduction, rates with deterministic rng,
   pity at 50, 4★+ guarantee on 10-pull, scroll alternative,
   summon screen render, reveal modal lifecycle, NEW badge,
   persistent skills panel.
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
['data.js','art.js','save.js','summon.js','combat.js','ui.js','game.js'].forEach(injectScript);
await new Promise(r => setTimeout(r, 80));

const G = window.__GAME__;
const D = window.GAME_DATA;
const S = window.GAME_SAVE;
const SUM = window.GAME_SUMMON;

const failures = [];
function assert(cond, msg) {
  if (!cond) { console.error('  FAIL:', msg); failures.push(msg); }
  else { console.log('  PASS:', msg); }
}
function section(name) { console.log('\n— ' + name + ' —'); }

// Deterministic RNG that returns from a queue, falling back to a cycler.
function makeRng(values) {
  let i = 0;
  return () => {
    if (i < values.length) return values[i++];
    return ((i++ * 0.2718) % 1);
  };
}

section('Summon module exposed');
assert(typeof SUM === 'object', 'GAME_SUMMON exposed');
assert(SUM.COST_SINGLE_CRYSTALS === 300, 'single cost 300');
assert(SUM.COST_TEN_CRYSTALS === 2700, 'ten cost 2700');
assert(SUM.COST_SINGLE_SCROLL === 1, 'single scroll cost 1');
assert(SUM.PITY_THRESHOLD === 50, 'pity threshold 50');
assert(Math.abs(SUM.RATE[5] - 0.05) < 1e-9, '5★ rate 5%');
assert(Math.abs(SUM.RATE[4] - 0.20) < 1e-9, '4★ rate 20%');
assert(Math.abs(SUM.RATE[3] - 0.75) < 1e-9, '3★ rate 75%');

section('Rarity roll boundaries');
assert(SUM.rollRarity(() => 0.01) === 5, 'r=0.01 → 5★');
assert(SUM.rollRarity(() => 0.10) === 4, 'r=0.10 → 4★');
assert(SUM.rollRarity(() => 0.99) === 3, 'r=0.99 → 3★');
assert(SUM.rollRarity(() => 0.05) === 4, 'r=0.05 (boundary) → 4★');
assert(SUM.rollRarity(() => 0.25) === 3, 'r=0.25 (boundary) → 3★');

section('Charge / refund');
const p1 = S.defaultState();
p1.crystals = 500; p1.scrolls = 2;
assert(SUM.chargeSingle(p1, 'crystal'), 'single crystal charge ok');
assert(p1.crystals === 200, 'crystals deducted by 300');
assert(SUM.chargeSingle(p1, 'scroll'), 'scroll charge ok');
assert(p1.scrolls === 1, 'scrolls -1');
assert(!SUM.chargeSingle(p1, 'crystal'), 'cannot charge when insufficient crystals');
assert(p1.crystals === 200, 'crystals unchanged on failed charge');
assert(!SUM.chargeTen(p1), 'cannot charge ten when insufficient');
p1.crystals = 5000;
assert(SUM.chargeTen(p1), 'ten charge ok');
assert(p1.crystals === 2300, 'crystals deducted by 2700');

section('Single pull behavior');
const p2 = S.defaultState({ starterIds: [] });
p2.crystals = 99999;
const beforeOwned = p2.ownedInstances.length;
// Force a 3★ result with rng 0.99
const r = SUM.performPull(p2, { rng: makeRng([0.99, 0.0]) });
assert(r.rarity === 3, 'forced rng 0.99 yields 3★');
assert(D.heroById(r.hero.id).stars === 3, 'hero pulled is actually 3★');
assert(r.isNew === true, 'first-time pull marks isNew');
assert(p2.ownedInstances.length === beforeOwned + 1, 'instance granted');
assert(p2.totalSummons === 1, 'totalSummons incremented');
assert(p2.pityCount === 1, 'pity advanced (no 5★)');

// 5★ pull resets pity
const r5 = SUM.performPull(p2, { rng: makeRng([0.0, 0.0]) });
assert(r5.rarity === 5, 'rng 0.0 yields 5★');
assert(p2.pityCount === 0, 'pity reset on 5★');

section('Pity triggers on 50th pull');
const p3 = S.defaultState({ starterIds: [] });
p3.crystals = 99999;
// Always roll 3★ (rng 0.99) so pity must engage
const ratesObserved = [];
for (let i = 0; i < 49; i++) {
  const x = SUM.performPull(p3, { rng: () => 0.99 });
  ratesObserved.push(x.rarity);
}
assert(p3.pityCount === 49, `pity counter at 49 (got ${p3.pityCount})`);
const x50 = SUM.performPull(p3, { rng: () => 0.99 });
assert(x50.rarity === 5, '50th pull forced to 5★ via pity');
assert(x50.pityActivated === true, 'pityActivated flag set');
assert(p3.pityCount === 0, 'pity reset after pity-fire');

section('10-pull guarantees 4★+');
const p4 = S.defaultState({ starterIds: [] });
p4.crystals = 99999;
// Force every roll to 3★ (rng 0.99) so the bonus must trigger
const results10 = SUM.performTenPull(p4, { rng: () => 0.99 });
assert(results10.length === 10, '10 results returned');
const tenth = results10[9];
assert(tenth.rarity >= 4, `10th result is 4★+ (got ${tenth.rarity}★)`);
assert(tenth.guaranteedFourPlus === true, 'guaranteedFourPlus flag set');
assert(p4.totalSummons === 10, 'totalSummons incremented by 10');

// If a natural 4★+ rolls within first 9, no upgrade applied to 10th
const p5 = S.defaultState({ starterIds: [] });
p5.crystals = 99999;
// First pull rolls 4★, rest 3★
const rng5 = makeRng([0.10, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99]);
const r5res = SUM.performTenPull(p5, { rng: rng5 });
assert(r5res[0].rarity === 4, 'first roll is 4★');
assert(!r5res[9].guaranteedFourPlus, '10th not flagged as bonus when natural 4★ rolled');

section('Rate distribution sanity (5000 pulls)');
const p6 = S.defaultState({ starterIds: [] });
p6.crystals = 1e9;
let r3 = 0, r4 = 0, r5_count = 0;
// Use a uniform pseudo-rng for distribution sanity
let seed = 12345;
const seedRng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
// Run 5000 pulls but disable pity by zeroing it between rolls
for (let i = 0; i < 5000; i++) {
  const x = SUM.performPull(p6, { rng: seedRng });
  if (x.rarity === 5) r5_count++;
  else if (x.rarity === 4) r4++;
  else r3++;
  // Cancel pity influence to measure raw rates
  p6.pityCount = 0;
}
const pct = n => (n / 5000 * 100).toFixed(1);
console.log(`  observed rates: 3★ ${pct(r3)}% / 4★ ${pct(r4)}% / 5★ ${pct(r5_count)}%`);
assert(Math.abs(r3/5000 - 0.75) < 0.04, '3★ rate within 4pp of 75%');
assert(Math.abs(r4/5000 - 0.20) < 0.04, '4★ rate within 4pp of 20%');
assert(Math.abs(r5_count/5000 - 0.05) < 0.025, '5★ rate within 2.5pp of 5%');

section('Summon screen renders');
S.clear();
G.state.player = S.loadOrInit();
// Force a known low-crystal state so we can verify enable/disable logic
// independent of test starter currency (which is intentionally huge for dev).
G.state.player.crystals = 1500;
G.state.player.scrolls = 1;
G.persistNow();
G.navigate('summon');
assert(document.querySelector('.summon-banner'), 'summon banner present');
assert(document.querySelectorAll('.summon-btn').length === 3, '3 summon buttons (single c, single s, ten)');
const tenBtn = document.querySelector('.summon-btn.ten');
assert(tenBtn, 'ten-pull button present');
const buttons = document.querySelectorAll('.summon-btn');
const singleC = buttons[0], singleS = buttons[1], ten = buttons[2];
assert(!singleC.disabled, 'single crystal pull enabled at 1500 crystals');
assert(!singleS.disabled, 'single scroll pull enabled at 1 scroll');
assert(ten.disabled, 'ten-pull disabled at 1500 crystals (needs 2700)');

section('UI flow: single pull triggers reveal');
G.state.player.crystals = 1500;
G.state.player.scrolls = 0;
G.navigate('summon');
const sc1 = document.querySelectorAll('.summon-btn')[0];
sc1.click();
assert(document.querySelector('.reveal-overlay'), 'reveal overlay shown after pull');
assert(G.state.player.crystals === 1200, 'crystals deducted (1500 → 1200)');
assert(document.querySelector('.reveal-stage'), 'reveal stage rendered');

section('Persistent skill panel');
G.navigate('title');
G.S.clear();
G.state.player = G.S.defaultState({ starterIds: ['ember_knight','dawn_cleric','shade_stalker'] });
G.persistNow();
G.setSelectedHeroIds(['ember_knight','dawn_cleric','shade_stalker']);
G.confirmTeam();
await new Promise(r => setTimeout(r, 50));
assert(document.querySelector('.skills-panel'), 'skill panel renders immediately');
// Force an enemy-turn scenario by setting acting to an enemy
const b = G.state.battle;
b.acting = b.enemy[0];
G.U.renderBattle(document.getElementById('app'), { state: G.state,
  navigate: G.navigate, confirmTeam: G.confirmTeam, onSkillPick: () => {},
  selectTarget: () => {}, toggleAuto: G.toggleAuto, resetSave: G.resetSave });
assert(document.querySelector('.skills-panel'), 'skill panel still rendered on enemy turn');
assert(document.querySelector('.skills-panel.read-only'), 'skill panel marked read-only on enemy turn');
const buttons2 = document.querySelectorAll('.skills-panel .skill-btn');
assert(buttons2.length >= 1, 'skill buttons rendered');
assert([...buttons2].every(btn => btn.disabled), 'all buttons disabled in read-only mode');

section('Skill button on-cooldown class');
// Set up an ally turn, then put a skill on cooldown and re-render.
const b2 = G.state.battle;
b2.acting = b2.ally[0];
b2.ally[0].cooldowns[b2.ally[0].skills[1]] = 3; // second skill on cd
G.state.player.autoBattle = false;
G.U.renderBattle(document.getElementById('app'), { state: G.state,
  navigate: G.navigate, confirmTeam: G.confirmTeam, onSkillPick: () => {},
  selectTarget: () => {}, toggleAuto: G.toggleAuto, resetSave: G.resetSave });
const cdBtn = document.querySelector('.skill-btn.on-cooldown');
assert(cdBtn, 'skill on cooldown has on-cooldown class');
assert(cdBtn.disabled, 'cooldown button is disabled');
const cdTag = cdBtn.querySelector('.cd-tag');
assert(cdTag && cdTag.textContent.includes('Cooldown'), 'cooldown tag shown with turn count');
const offCdBtn = [...document.querySelectorAll('.skill-btn')].find(b => !b.classList.contains('on-cooldown'));
assert(offCdBtn, 'off-cooldown button still present and clickable');

section('Errors during run');
console.log('  collected errors:', errors.length);
errors.forEach(e => console.log('    ', e?.message || e));
assert(errors.length === 0, 'no JS errors during M2.1 test run');

console.log('\n=================================');
console.log(`Total failures: ${failures.length}`);
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('All M2.1 tests passed.');
  process.exit(0);
}
