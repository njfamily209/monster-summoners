/* ===========================================================
   Aetherbound M2.0 — save/load + currencies + expanded roster
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
  const script = document.createElement('script');
  script.textContent = code;
  document.body.appendChild(script);
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

const failures = [];
function assert(cond, msg) {
  if (!cond) { console.error('  FAIL:', msg); failures.push(msg); }
  else { console.log('  PASS:', msg); }
}
function section(name) { console.log('\n— ' + name + ' —'); }

section('Expanded roster');
assert(D.HEROES.length === 22, `roster has 22 heroes (got ${D.HEROES.length})`);
const byStars = { 3: 0, 4: 0, 5: 0 };
D.HEROES.forEach(h => { byStars[h.stars] = (byStars[h.stars] || 0) + 1; });
assert(byStars[3] === 9, `9 3★ heroes (got ${byStars[3]})`);
assert(byStars[4] === 8, `8 4★ heroes (got ${byStars[4]})`);
assert(byStars[5] === 5, `5 5★ heroes (got ${byStars[5]})`);

const ids = new Set();
let allValid = true;
for (const h of D.HEROES) {
  if (ids.has(h.id)) { allValid = false; console.error('  dup id', h.id); }
  ids.add(h.id);
  if (!D.ELEMENTS[h.element]) { allValid = false; console.error('  bad element', h.id); }
  if (!Array.isArray(h.skills) || h.skills.length < 1) { allValid = false; console.error('  no skills', h.id); }
  for (const sid of (h.skills || [])) if (!D.SKILLS[sid]) { allValid = false; console.error('  missing skill', sid); }
  if (!(h.base && h.base.hp > 0 && h.base.atk > 0 && h.base.spd > 0)) { allValid = false; console.error('  bad stats', h.id); }
}
assert(allValid, 'every hero has unique id, valid element, skills, stats');

function avg(arr) { return arr.reduce((x, y) => x + y, 0) / arr.length; }
const hp3 = avg(D.HEROES.filter(h => h.stars === 3).map(h => h.base.hp));
const hp4 = avg(D.HEROES.filter(h => h.stars === 4).map(h => h.base.hp));
const hp5 = avg(D.HEROES.filter(h => h.stars === 5).map(h => h.base.hp));
console.log(`  avg HP: 3★ ${hp3.toFixed(0)}, 4★ ${hp4.toFixed(0)}, 5★ ${hp5.toFixed(0)}`);
assert(hp4 > hp3 * 1.1, '4★ avg HP meaningfully higher than 3★');
assert(hp5 > hp4 * 1.1, '5★ avg HP meaningfully higher than 4★');
const els3 = new Set(D.HEROES.filter(h => h.stars === 3).map(h => h.element));
assert(els3.size === 5, 'all 5 elements appear at 3★ tier');

section('Save module');
assert(typeof S.defaultState === 'function', 'defaultState exposed');
assert(typeof S.load === 'function', 'load exposed');
assert(typeof S.save === 'function', 'save exposed');
assert(typeof S.loadOrInit === 'function', 'loadOrInit exposed');
assert(typeof S.migrate === 'function', 'migrate exposed');
assert(S.SAVE_VERSION === 1, 'save version is 1');

S.clear();
const fresh = S.defaultState();
assert(fresh.version === 1, 'fresh.version === 1');
assert(fresh.crystals === S.STARTER_CRYSTALS, `fresh starts with STARTER_CRYSTALS (got ${fresh.crystals})`);
assert(fresh.scrolls === S.STARTER_SCROLLS, `fresh starts with STARTER_SCROLLS (got ${fresh.scrolls})`);
assert(fresh.pityCount === 0, 'fresh pityCount 0');
assert(fresh.totalSummons === 0, 'fresh totalSummons 0');
assert(fresh.autoBattle === false, 'fresh autoBattle false');
assert(Array.isArray(fresh.ownedInstances) && fresh.ownedInstances.length === 3, '3 starter instances granted');
const starterIds = fresh.ownedInstances.map(i => i.id);
assert(new Set(starterIds).size === 3, 'starter ids are unique');
const allStarters3 = fresh.ownedInstances.every(i => D.heroById(i.id) && D.heroById(i.id).stars === 3);
assert(allStarters3, 'all starters are 3★');
const inst = fresh.ownedInstances[0];
assert(typeof inst.instanceId === 'string' && inst.instanceId.length > 4, 'instance has id');
assert(inst.level === 1 && inst.xp === 0, 'instance starts level 1, xp 0');

section('Save round-trip');
S.clear();
const a = S.defaultState({ starterIds: ['ember_knight', 'dawn_cleric'] });
a.crystals = 999;
a.scrolls = 7;
a.pityCount = 12;
a.totalSummons = 42;
a.autoBattle = true;
a.selectedHeroIds = ['ember_knight'];
assert(S.save(a), 'save returns true');
const b = S.load();
assert(b !== null, 'load returns saved state');
assert(b.crystals === 999 && b.scrolls === 7, 'currencies preserved');
assert(b.pityCount === 12 && b.totalSummons === 42, 'pity/totalSummons preserved');
assert(b.autoBattle === true, 'autoBattle preserved');
assert(b.ownedInstances.length === 2, '2 starter instances preserved');
assert(b.ownedInstances[0].id === 'ember_knight', 'instance hero id preserved');
assert(b.selectedHeroIds[0] === 'ember_knight', 'selected team preserved');

section('Migration');
const oldShape = { crystals: 500 };
const migrated = S.migrate(oldShape);
assert(migrated.version === 1, 'missing version becomes 1');
assert(migrated.crystals === 500, 'existing field preserved');
assert(migrated.scrolls === 0, `missing scrolls defaults to 0 (got ${migrated.scrolls})`);
assert(Array.isArray(migrated.ownedInstances), 'missing ownedInstances becomes []');
assert(Array.isArray(migrated.selectedHeroIds), 'missing selectedHeroIds becomes []');
assert(typeof migrated.autoBattle === 'boolean', 'autoBattle is boolean');
assert(S.migrate(null) === null, 'migrate(null) === null');
assert(S.migrate('garbage') === null, 'migrate(string) === null');

section('loadOrInit');
S.clear();
const init1 = S.loadOrInit();
assert(init1.ownedInstances.length === 3, 'first call creates starter pack');
const init2 = S.loadOrInit();
assert(init2.ownedInstances.length === 3, 'second call returns same save');
assert(init2.ownedInstances[0].instanceId === init1.ownedInstances[0].instanceId, 'same instance ids on reload');

section('Currency mutators');
const tst = S.defaultState();
const startCrystals = tst.crystals, startScrolls = tst.scrolls;
S.addCrystals(tst, 500); assert(tst.crystals === startCrystals + 500, 'addCrystals adds');
S.addCrystals(tst, -(startCrystals + 99999)); assert(tst.crystals === 0, 'addCrystals clamps at 0');
S.addScrolls(tst, 5); assert(tst.scrolls === startScrolls + 5, 'addScrolls adds');
S.addScrolls(tst, -9999); assert(tst.scrolls === 0, 'addScrolls clamps at 0');

section('Owned helpers');
const t = S.defaultState({ starterIds: ['ember_knight'] });
S.grantHero(t, 'ember_knight');
S.grantHero(t, 'tide_caller');
assert(t.ownedInstances.length === 3, 'duplicates allowed');
assert(S.ownsHero(t, 'ember_knight'), 'ownsHero true for ember_knight');
assert(!S.ownsHero(t, 'shade_stalker'), 'ownsHero false for unowned');
const unique = S.uniqueOwnedHeroIds(t);
assert(unique.length === 2, 'uniqueOwnedHeroIds dedupes');
assert(unique.includes('ember_knight') && unique.includes('tide_caller'), 'unique ids correct');

section('Fresh game UI integration');
S.clear();
G.state.player = S.loadOrInit();
G.persistNow();
G.navigate('title');
assert(document.querySelector('.currency-bar'), 'currency bar renders on title');
const crystEl = document.querySelector('.cur-crystal .cur-val');
assert(crystEl && crystEl.textContent.length > 0, `crystal value rendered (got "${crystEl && crystEl.textContent}")`);
const scrollEl = document.querySelector('.cur-scroll .cur-val');
assert(scrollEl && scrollEl.textContent.length > 0, `scroll value rendered (got "${scrollEl && scrollEl.textContent}")`);
// Title v2 moved Reset to a corner icon-btn; accept either old or new selector.
assert(document.querySelector('.reset-btn, .reset-icon'),
  'reset save button present (corner icon or legacy text link)');
assert(document.querySelector('button.btn-nav.btn-danger, button.icon-btn.reset-icon'),
  'reset save uses recognized danger styling');

G.navigate('team-select');
const cardCount = document.querySelectorAll('.roster-card').length;
assert(cardCount === 3, `only owned heroes show (3 cards, got ${cardCount})`);
assert(document.querySelector('.btn-back'), 'team-select has back button (not text link)');
const visibleNames = [...document.querySelectorAll('.roster-card .name')].map(n => n.textContent);
const allOwned = visibleNames.every(name => {
  const hero = D.HEROES.find(h => h.name === name);
  return hero && G.state.player.ownedInstances.some(i => i.id === hero.id);
});
assert(allOwned, 'every visible card matches an owned hero');

section('Roster grid with all heroes');
G.grantAllHeroes();
G.navigate('team-select');
const allCardCount = document.querySelectorAll('.roster-card').length;
assert(allCardCount === 22, `22 unique-hero cards rendered (got ${allCardCount})`);
assert(document.querySelector('.roster-card.rarity-4'), '4★ rarity card class present');
assert(document.querySelector('.roster-card.rarity-5'), '5★ rarity card class present');

section('Duplicate badge');
G.grantHero('ember_knight');
G.grantHero('ember_knight');
G.navigate('team-select');
const dupes = document.querySelectorAll('.dupe-badge');
assert(dupes.length >= 1, 'at least one dupe badge rendered');

section('Empty roster state');
G.state.player.ownedInstances = [];
G.persistNow();
G.navigate('team-select');
assert(document.querySelector('.empty-roster'), 'empty-roster element shown when no heroes');
assert(!document.querySelector('.roster-grid'), 'no roster-grid when empty');

section('Role icons + card layout');
S.clear();
G.state.player = S.loadOrInit();
G.grantAllHeroes();
G.navigate('team-select');
// Inline role icon next to name (no overlap with corner badges).
assert(document.querySelector('.roster-card .name-row .role-icon'), 'role icon rendered in name row');
assert(document.querySelector('.role-icon.role-tank'), 'tank role icon (e.g. Stone Guardian)');
assert(document.querySelector('.role-icon.role-healer'), 'healer role icon (e.g. Dawn Cleric)');
assert(document.querySelector('.role-icon.role-dps'), 'dps role icon (e.g. Ember Knight)');
// Layout pieces — no overlapping rows.
assert(document.querySelector('.roster-card .name-row'), 'name-row present');
assert(document.querySelector('.roster-card .meta-top'), 'meta-top row (element + stars) present');
assert(document.querySelector('.roster-card .role-text'), 'role-text descriptor present');
assert(document.querySelector('.roster-card .stat-row'), 'stat-row present');
assert(document.querySelector('.roster-card .stat-key'), 'stat-key label present');
assert(document.querySelector('.roster-card .stat-val'), 'stat-val value present');
// roleClass mapping
assert(G.U.roleClass({ role: 'Tank' }) === 'tank', 'roleClass maps Tank → tank');
assert(G.U.roleClass({ role: 'Healer' }) === 'healer', 'roleClass maps Healer → healer');
assert(G.U.roleClass({ role: 'Warrior' }) === 'dps', 'roleClass maps Warrior → dps');
assert(G.U.roleClass({ role: 'Mage' }) === 'dps', 'roleClass maps Mage → dps');
assert(G.U.roleClass({ role: 'Champion' }) === 'dps', 'roleClass maps Champion → dps');

section('Selection persists');
S.clear();
G.state.player = S.loadOrInit();
G.persistNow();
G.navigate('team-select');
const cards = document.querySelectorAll('.roster-card');
assert(cards.length >= 1, 'cards present');
cards[0].click();
const firstId = G.state.player.selectedHeroIds[0];
assert(firstId, 'selection added');
G.persistNow();
const reloaded = S.load();
assert(reloaded.selectedHeroIds[0] === firstId, 'selection persists after save+load');

section('confirmTeam blocks unowned');
S.clear();
G.state.player = S.loadOrInit();
G.state.player.selectedHeroIds = ['pyre_sovereign', 'aurora_seraph', 'twilight_reaver'];
G.persistNow();
G.confirmTeam();
assert(G.state.battle === null, 'no battle started with unowned heroes');
assert(G.state.player.selectedHeroIds.length === 0, 'selection cleared after refusal');

section('Reset save');
G.grantHero('pyre_sovereign');
G.resetSave();
const ownedAfter = G.state.player.ownedInstances.length;
assert(ownedAfter === 3, `resetSave grants new starter pack (got ${ownedAfter})`);
assert(G.state.player.crystals === S.STARTER_CRYSTALS, `crystals reset to STARTER_CRYSTALS (got ${G.state.player.crystals})`);

section('Battle Again rebattle');
S.clear();
G.state.player = S.loadOrInit();
G.persistNow();
G.setSelectedHeroIds(G.state.player.ownedInstances.slice(0, 3).map(i => i.id));
G.confirmTeam();
const firstBattle = G.state.battle;
assert(firstBattle, 'first battle started');
// Battle layout features
assert(document.querySelector('.field-divider'), 'field-divider rendered between ally/enemy columns');
assert(document.querySelector('.field-divider .vs-label'), 'VS label inside divider');
// Role overlay still present on battle unit cards (bottom-right corner now)
assert(document.querySelector('.unit .role-overlay'), 'role overlay present on battle unit cards');
const firstStage = G.state.lastStage;
G.state.battle.enemy.forEach(e => { e.hp = 0; });
G.state.battle.result = 'victory';
G.grantVictoryRewards();
assert(G.state.battle.rewards, 'rewards object set on victory');
assert(G.state.battle.rewards.crystals >= 200 && G.state.battle.rewards.crystals <= 500, 'rewards crystals in 200-500');
G.rebattle();
assert(G.state.battle, 'rebattle started new battle');
assert(G.state.battle !== firstBattle, 'rebattle is a new battle object');
assert(G.state.lastStage === firstStage, 'rebattle reuses last stage');
assert(G.state.battle.ally.length === 3, 'rebattle has 3 allies');

section('Errors during run');
console.log('  collected errors:', errors.length);
errors.forEach(e => console.log('    ', e?.message || e));
assert(errors.length === 0, 'no JS errors during M2.0 test run');

console.log('\n=================================');
console.log(`Total failures: ${failures.length}`);
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('All M2.0 tests passed.');
  process.exit(0);
}
 {
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('All M2.0 tests passed.');
  process.exit(0);
}
