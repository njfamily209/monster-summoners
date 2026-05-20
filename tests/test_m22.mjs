/* ===========================================================
   Aetherbound M2.2 — collection vault + sort options
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
const U = window.GAME_UI;

const failures = [];
function assert(cond, msg) {
  if (!cond) { console.error('  FAIL:', msg); failures.push(msg); }
  else { console.log('  PASS:', msg); }
}
function section(name) { console.log('\n— ' + name + ' —'); }

section('Sort utilities');
assert(Array.isArray(U.SORT_OPTIONS) && U.SORT_OPTIONS.length >= 7, 'SORT_OPTIONS exposed with >= 7 options');
const sortKeys = U.SORT_OPTIONS.map(o => o.key);
['rarity','hp','atk','def','spd','name','element','role'].forEach(k => {
  assert(sortKeys.includes(k), `sort key "${k}" present`);
});
const byHp = U.sortHeroes(D.HEROES, 'hp');
assert(byHp[0].base.hp >= byHp[byHp.length - 1].base.hp, 'sort by hp descending');
const byAtk = U.sortHeroes(D.HEROES, 'atk');
assert(byAtk[0].base.atk >= byAtk[byAtk.length - 1].base.atk, 'sort by atk descending');
const bySpd = U.sortHeroes(D.HEROES, 'spd');
assert(bySpd[0].base.spd >= bySpd[bySpd.length - 1].base.spd, 'sort by spd descending');
const byName = U.sortHeroes(D.HEROES, 'name');
assert(byName[0].name.localeCompare(byName[byName.length - 1].name) <= 0, 'sort by name ascending');

section('Default state has sort + filter fields');
S.clear();
const fresh = S.defaultState();
assert(fresh.rosterSort === 'rarity', 'default rosterSort is rarity');
assert(fresh.vaultSort === 'rarity', 'default vaultSort is rarity');
assert(fresh.vaultFilter && fresh.vaultFilter.element === 'all', 'default vault element filter all');
assert(fresh.vaultFilter.role === 'all', 'default vault role filter all');
assert(fresh.vaultFilter.owned === 'all', 'default vault owned filter all');

section('Team-select sort selector');
S.clear();
G.state.player = S.loadOrInit();
G.grantAllHeroes();
G.navigate('team-select');
assert(document.querySelector('.sort-selector'), 'sort selector rendered on team-select');
assert(document.querySelector('select.sort-select'), 'sort select dropdown present');
const sel = document.querySelector('select.sort-select');
const opts = sel.querySelectorAll('option');
assert(opts.length === U.SORT_OPTIONS.length, `${U.SORT_OPTIONS.length} sort options in dropdown`);
// Change sort to "atk" via event
sel.value = 'atk';
sel.dispatchEvent(new window.Event('change'));
assert(G.state.player.rosterSort === 'atk', 'changing sort updates player state');
const firstCardName = document.querySelector('.roster-card .name').textContent;
const highestAtkHero = U.sortHeroes(G.state.player.ownedInstances.map(i => D.heroById(i.id)), 'atk')[0];
assert(firstCardName === highestAtkHero.name, `top card matches highest-ATK owned (${highestAtkHero.name})`);

section('Vault screen renders');
G.navigate('vault');
assert(document.querySelector('.completion-bar'), 'completion bar present');
assert(document.querySelector('.completion-fill'), 'completion fill present');
assert(document.querySelector('.vault-controls'), 'vault filter controls present');
assert(document.querySelectorAll('.pill-row').length === 3, '3 pill rows (element / role / owned)');
assert(document.querySelectorAll('.filter-pill').length >= 12, '12+ filter pills total');
// All 16 heroes shown when grantAllHeroes + 'all' filters
const cards = document.querySelectorAll('.roster-card');
assert(cards.length === 22, `22 cards shown when all owned + no filter (got ${cards.length})`);

section('Vault: unowned silhouettes');
S.clear();
G.state.player = S.loadOrInit();
G.navigate('vault');
const ownedSet = new Set(G.state.player.ownedInstances.map(i => i.id));
const unownedCards = document.querySelectorAll('.roster-card.unowned');
const ownedCards = document.querySelectorAll('.roster-card:not(.unowned)');
assert(unownedCards.length === 22 - ownedSet.size, `unowned card count = ${22 - ownedSet.size}`);
assert(ownedCards.length === ownedSet.size, `owned card count = ${ownedSet.size}`);
assert(document.querySelector('.locked-badge'), 'locked badge shown on unowned cards');

section('Vault: element filter');
G.grantAllHeroes();
G.state.player.vaultFilter.element = 'fire';
G.navigate('vault');
const fireCards = document.querySelectorAll('.roster-card');
const allFire = [...fireCards].every(card => card.classList.contains('rarity-3') || card.classList.contains('rarity-4') || card.classList.contains('rarity-5'));
assert(allFire, 'all cards rendered are valid rarity classes');
const fireCount = D.HEROES.filter(hh => hh.element === 'fire').length;
assert(fireCards.length === fireCount, `fire filter shows ${fireCount} heroes (got ${fireCards.length})`);

section('Vault: role filter (tank)');
G.state.player.vaultFilter.element = 'all';
G.state.player.vaultFilter.role = 'tank';
G.navigate('vault');
const tankCards = document.querySelectorAll('.roster-card');
const tankCount = D.HEROES.filter(hh => (hh.role || '').toLowerCase() === 'tank').length;
assert(tankCards.length === tankCount, `tank filter shows ${tankCount} heroes`);

section('Vault: owned filter (missing)');
S.clear();
G.state.player = S.loadOrInit();
G.state.player.vaultFilter = { element: 'all', role: 'all', owned: 'missing' };
G.navigate('vault');
const missingCount = D.HEROES.length - G.state.player.ownedInstances.length;
const missingCards = document.querySelectorAll('.roster-card.unowned');
assert(missingCards.length === missingCount, `missing filter shows ${missingCount} unowned heroes`);

section('Vault: hero detail modal');
G.grantAllHeroes();
G.state.player.vaultFilter = { element: 'all', role: 'all', owned: 'all' };
G.navigate('vault');
const someCard = document.querySelector('.roster-card');
someCard.click();
assert(document.querySelector('.hero-detail-modal'), 'hero detail modal opens on card click');
assert(document.querySelector('.hd-stat-grid'), 'stat grid present in modal');
assert(document.querySelectorAll('.hd-stat-cell').length === 6, '6 stat cells in modal');
assert(document.querySelector('.hd-skills'), 'skills list present');
assert(document.querySelectorAll('.hd-skill').length >= 1, 'at least one skill rendered');
// Close button removes modal
const closeBtn = [...document.querySelectorAll('.hero-detail-modal .btn-nav')].find(b => b.textContent === 'Close');
closeBtn.click();
assert(!document.querySelector('.hero-detail-modal'), 'modal closes via Close button');

section('Completion %');
S.clear();
G.state.player = S.loadOrInit();
G.navigate('vault');
const subtitle = document.querySelector('.screen-header .subtitle').textContent;
assert(/3\s*\/\s*22/.test(subtitle), `subtitle shows 3/22 (got "${subtitle}")`);
assert(/13%|14%/.test(subtitle), `completion % shown (~14%, got "${subtitle}")`);
const fill = document.querySelector('.completion-fill');
const widthPct = parseFloat(fill.style.width);
assert(widthPct > 11 && widthPct < 16, `progress bar fill ~14% (got ${widthPct}%)`);

section('10-pull batch animation');
S.clear();
G.state.player = S.loadOrInit();
G.state.player.crystals = 99999;
G.persistNow();
G.navigate('summon');
const tenBtn = document.querySelector('.summon-btn.ten');
assert(tenBtn && !tenBtn.disabled, 'ten-pull button enabled');
tenBtn.click();
// Should show batch-intro stage (not single-card reveal-card)
const batchStage = document.querySelector('.reveal-stage.batch-intro');
assert(batchStage, 'batch-intro stage rendered immediately (no per-card cycling)');
assert(document.querySelectorAll('.batch-orb').length === 10, '10 orbs in batch intro');
assert(document.querySelector('.batch-label'), 'batch label shown');
// Wait for transition to summary
await new Promise(r => setTimeout(r, 950));
assert(document.querySelector('.reveal-summary'), 'transitions to summary after intro');
assert(document.querySelectorAll('.reveal-cell').length === 10, '10 result cells in summary');
assert(document.querySelector('.reveal-cell.stagger-in'), 'cells have stagger-in animation class');

section('Click-anywhere-to-dismiss reveal');
// Continue button replaced by tap-to-continue overlay click handler.
const hint = document.querySelector('.reveal-hint');
assert(hint, 'reveal-hint shown (replaces Continue button)');
assert(/tap.*continue/i.test(hint.textContent), 'hint says tap to continue');
await new Promise(r => setTimeout(r, 1100));
document.querySelector('.reveal-overlay').click();
assert(!document.querySelector('.reveal-overlay'), 'overlay closes on click anywhere');

section('Errors during run');
console.log('  collected errors:', errors.length);
errors.forEach(e => console.log('    ', e?.message || e));
assert(errors.length === 0, 'no JS errors during M2.2 test run');

console.log('\n=================================');
console.log(`Total failures: ${failures.length}`);
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('All M2.2 tests passed.');
  process.exit(0);
}
