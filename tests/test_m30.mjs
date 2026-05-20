/* ===========================================================
   Aetherbound M3.0 — stage progression + stage-select
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
['data.js','art.js','save.js','summon.js','combat.js','ui.js','game.js'].forEach(injectScript);
await new Promise(r => setTimeout(r, 80));

const G = window.__GAME__;
const D = window.GAME_DATA;
const S = window.GAME_SAVE;
const C = window.GAME_COMBAT;

const failures = [];
function assert(cond, msg) {
  if (!cond) { console.error('  FAIL:', msg); failures.push(msg); }
  else { console.log('  PASS:', msg); }
}
function section(name) { console.log('\n— ' + name + ' —'); }

section('Stage data shape');
assert(Array.isArray(D.STAGES) && D.STAGES.length >= 4, `at least 4 stages defined (got ${D.STAGES.length})`);
const tiers = D.STAGES.map(s => s.tier);
assert(tiers.includes(1) && tiers.includes(2) && tiers.includes(3) && tiers.includes(4), 'tiers 1, 2, 3, 4 present');
D.STAGES.forEach(s => {
  assert(typeof s.id === 'string' && s.id.length > 0, `${s.name} has id`);
  assert(typeof s.enemyMul === 'number' && s.enemyMul >= 1.0, `${s.name} has enemyMul >= 1.0`);
  assert(typeof s.rewardMul === 'number' && s.rewardMul >= 1.0, `${s.name} has rewardMul >= 1.0`);
  assert(Array.isArray(s.enemyIds) && s.enemyIds.length > 0, `${s.name} has enemyIds`);
  s.enemyIds.forEach(eid => assert(D.enemyById(eid), `${s.name}: enemy "${eid}" exists`));
});
// Difficulty escalates across tiers — use ID-based lookup so array order doesn't matter
const t1s = D.stageById('goblin_camp_1');
const t2s = D.stageById('forest_path');
const t3s = D.stageById('cursed_ruins');
const t4s = D.stageById('warchief_hall');
assert(t1s.enemyMul < t2s.enemyMul, 'tier 2 enemyMul > tier 1');
assert(t2s.enemyMul < t3s.enemyMul, 'tier 3 enemyMul > tier 2');
assert(t3s.enemyMul < t4s.enemyMul, 'tier 4 enemyMul > tier 3');
assert(t1s.rewardMul < t2s.rewardMul, 'tier 2 rewardMul > tier 1');

section('stageById / stagesByTier helpers');
assert(D.stageById('goblin_camp_1').name === 'Goblin Camp · I', 'stageById finds tier 1');
assert(D.stageById('cursed_ruins').tier === 3, 'stageById finds tier 3 (cursed_ruins)');
assert(D.stageById('warchief_hall').tier === 4, 'stageById finds tier 4 (warchief_hall)');
assert(D.stageById('nonsense') === null, 'stageById returns null for unknown');
assert(D.stagesByTier(1).length >= 1, '>=1 stage in tier 1');
assert(D.stagesByTier(3).length >= 1, '>=1 stage in tier 3');
assert(D.stagesByTier(4).length >= 1, '>=1 stage in tier 4');

section('Stage unlock logic');
S.clear();
const p = S.defaultState();
assert(p.stagesCleared.length === 0, 'fresh save has no cleared stages');
const t1 = D.stageById('goblin_camp_1');
const t2 = D.stageById('forest_path');
const t3 = D.stageById('cursed_ruins');
const t4 = D.stageById('warchief_hall');
assert(S.isStageUnlocked(p, t1) === true, 'tier 1 unlocked by default');
assert(S.isStageUnlocked(p, t2) === false, 'tier 2 locked initially');
assert(S.isStageUnlocked(p, t3) === false, 'tier 3 locked initially');
assert(S.isStageUnlocked(p, t4) === false, 'tier 4 locked initially');

S.markStageCleared(p, 'goblin_camp_1');
assert(S.isStageCleared(p, 'goblin_camp_1'), 'goblin_camp_1 marked cleared');
assert(S.isStageUnlocked(p, t2) === true, 'tier 2 unlocks after tier 1 clear');
assert(S.isStageUnlocked(p, t3) === false, 'tier 3 still locked');

S.markStageCleared(p, 'forest_path');
assert(S.isStageUnlocked(p, t3) === true, 'tier 3 unlocks after tier 2 clear');
assert(S.isStageUnlocked(p, t4) === false, 'tier 4 still locked');

S.markStageCleared(p, 'cursed_ruins');
assert(S.isStageUnlocked(p, t4) === true, 'tier 4 unlocks after tier 3 clear');

// markStageCleared is idempotent (no dupes)
S.markStageCleared(p, 'goblin_camp_1');
S.markStageCleared(p, 'goblin_camp_1');
const t1Count = p.stagesCleared.filter(id => id === 'goblin_camp_1').length;
assert(t1Count === 1, 'markStageCleared is idempotent (no duplicates)');

section('enemyMul scaling in makeBattle');
const heroIds = ['ember_knight', 'dawn_cleric', 'shade_stalker'];
const battle1 = C.makeBattle(heroIds, t1);
const battle4 = C.makeBattle(heroIds, t4);
// goblin_chief appears in both tier 1 (goblin_camp_1) and tier 4 (warchief_hall) — perfect for scaling check
const chief1 = battle1.enemy.find(e => e.template.id === 'goblin_chief');
const chief4 = battle4.enemy.find(e => e.template.id === 'goblin_chief');
const baseHp = D.enemyById('goblin_chief').base.hp;
assert(chief1.maxHp === baseHp, `tier 1 chief: base HP ${baseHp}`);
assert(chief4.maxHp === Math.floor(baseHp * t4.enemyMul), `tier 4 chief HP scaled (${chief4.maxHp})`);
assert(chief4.hp === chief4.maxHp, 'scaled enemy starts at full hp');
assert(chief4.base.atk === Math.floor(D.enemyById('goblin_chief').base.atk * t4.enemyMul), 'ATK scales too');
// Also confirm tier 2 / tier 3 spawn the right enemies
const battle2 = C.makeBattle(heroIds, t2);
const battle3 = C.makeBattle(heroIds, t3);
assert(battle2.enemy.some(e => e.template.id === 'alpha_wolf'), 'tier 2 (forest_path) spawns alpha_wolf');
assert(battle3.enemy.some(e => e.template.id === 'lich_acolyte'), 'tier 3 (cursed_ruins) spawns lich_acolyte');
const wolf2 = battle2.enemy.find(e => e.template.id === 'forest_wolf');
const wolfBase = D.enemyById('forest_wolf').base.hp;
assert(wolf2.maxHp === Math.floor(wolfBase * t2.enemyMul), `tier 2 wolf HP scaled (${wolf2.maxHp})`);

section('Save migration backfills stagesCleared');
const migrated = S.migrate({ crystals: 100 });
assert(Array.isArray(migrated.stagesCleared) && migrated.stagesCleared.length === 0,
  'missing stagesCleared becomes []');

section('Stage-select screen renders');
S.clear();
G.state.player = S.loadOrInit();
G.persistNow();
G.navigate('stage-select');
const stageCards = document.querySelectorAll('.stage-card');
assert(stageCards.length === D.STAGES.length, `${D.STAGES.length} stage cards rendered`);
// First card unlocked, others locked
assert(!stageCards[0].classList.contains('locked'), 'tier 1 card not locked');
assert(stageCards[1].classList.contains('locked'), 'tier 2 card locked');
assert(stageCards[2].classList.contains('locked'), 'tier 3 card locked');
assert(document.querySelectorAll('.tier-dot.filled').length > 0, 'tier difficulty dots render');
const expectedEnemyCount = D.STAGES.reduce((s, st) => s + st.enemyIds.length, 0);
assert(document.querySelectorAll('.mini-portrait').length === expectedEnemyCount, `${expectedEnemyCount} enemy portraits across all stages`);
assert(document.querySelectorAll('.stage-reward').length === D.STAGES.length, 'reward preview on each card');

section('pickStage flow');
S.clear();
G.state.player = S.loadOrInit();
G.persistNow();
G.pickStage('goblin_camp_1');
assert(G.state.queuedStage && G.state.queuedStage.id === 'goblin_camp_1', 'queuedStage set');
assert(G.state.screen === 'team-select', 'navigated to team-select');
// Try to pick a locked stage — should not change queue
const prev = G.state.queuedStage;
G.navigate('stage-select');
G.pickStage('warchief_hall');
assert(G.state.queuedStage === prev || G.state.screen === 'stage-select',
  'locked stage refuses (queue unchanged or stayed on stage-select)');

section('Stage-select team flow uses queued stage');
S.clear();
G.state.player = S.loadOrInit();
G.persistNow();
G.pickStage('goblin_camp_1');
G.setSelectedHeroIds(G.state.player.ownedInstances.slice(0, 3).map(i => i.id));
G.confirmTeam();
assert(G.state.battle, 'battle started after team confirm');
assert(G.state.battle.stage.id === 'goblin_camp_1', 'battle uses queued stage');

section('Scaled victory rewards');
S.clear();
G.state.player = S.loadOrInit();
G.persistNow();
G.pickStage('goblin_camp_1');
G.setSelectedHeroIds(G.state.player.ownedInstances.slice(0, 3).map(i => i.id));
G.confirmTeam();
G.state.battle.enemy.forEach(e => { e.hp = 0; });
G.state.battle.result = 'victory';
const r1 = G.grantVictoryRewards();
assert(r1.crystals >= 200 && r1.crystals <= 500, `tier 1 reward in 200-500 (got ${r1.crystals})`);
assert(S.isStageCleared(G.state.player, 'goblin_camp_1'), 'victory marks stage cleared');

// Test tier 2 scaling — forest_path mul=1.5 → 300-750
G.navigate('title'); // stop ticker between battles
G.state.lastStage = D.stageById('forest_path');
G.startBattle(G.state.player.ownedInstances.slice(0, 3).map(i => i.id), D.stageById('forest_path'));
G.state.battle.enemy.forEach(e => { e.hp = 0; });
G.state.battle.result = 'victory';
const r2 = G.grantVictoryRewards();
assert(r2.crystals >= 300 && r2.crystals <= 750, `tier 2 reward scaled to 300-750 (got ${r2.crystals})`);

// Tier 3 — cursed_ruins mul=2.0 → 400-1000
G.navigate('title');
G.startBattle(G.state.player.ownedInstances.slice(0, 3).map(i => i.id), D.stageById('cursed_ruins'));
G.state.battle.enemy.forEach(e => { e.hp = 0; });
G.state.battle.result = 'victory';
const r3 = G.grantVictoryRewards();
assert(r3.crystals >= 400 && r3.crystals <= 1000, `tier 3 reward scaled to 400-1000 (got ${r3.crystals})`);


// (Tier 4 reward sample skipped — tier-4 unlock & scaling already covered above)
G.navigate('title');

section('Cleared badge appears');
G.navigate('stage-select');
assert(document.querySelectorAll('.stage-card.cleared').length >= 1, 'at least one cleared badge shown');
assert(document.querySelector('.cleared-badge'), 'cleared checkmark rendered');

section('SPD clamp (combat defensiveness)');
// Stacked -50% SPD debuffs would naively zero a unit; statMul must clamp at 0.05.
const fakeUnit = { base: { spd: 100 }, statuses: [
  { stat: 'spd', amount: -0.5 }, { stat: 'spd', amount: -0.5 },
  { stat: 'spd', amount: -0.5 }, { stat: 'spd', amount: -0.5 },
] };
const eff = C.effStat(fakeUnit, 'spd');
assert(eff > 0, `effStat clamps SPD at >0 even under stacked debuffs (got ${eff})`);

section('Errors during run');
console.log('  collected errors:', errors.length);
errors.forEach(e => console.log('    ', e?.message || e));
assert(errors.length === 0, 'no JS errors during M3.0 test run');

console.log('\n=================================');
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('All M3.0 tests passed.');
  process.exit(0);
}
