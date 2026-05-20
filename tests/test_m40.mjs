/* ===========================================================
   Aetherbound M4.0 — Rune system test
   Covers: generateRune, equip/unequip, set bonuses,
           no-double-equip invariant, deleteRune cleanup,
           save migration backward compat.
   =========================================================== */
import { JSDOM } from 'jsdom';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const stripped = html.replace(/<script\s+src=[^>]*><\/script>/g, '');

const dom = new JSDOM(stripped, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
});
const window   = dom.window;
const document = window.document;

function injectScript(file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const el = document.createElement('script');
  el.textContent = code;
  document.head.appendChild(el);
}
['data.js','art.js','sprites.js','audio.js','combat.js','save.js','summon.js','ui.js','game.js'].forEach(injectScript);

const S = window.GAME_SAVE;
const D = window.GAME_DATA;

let failures = 0;
function section(name) { console.log('\n— ' + name + ' —'); }
function assert(cond, msg) {
  if (cond) { console.log('  PASS: ' + msg); }
  else       { console.error('  FAIL: ' + msg); failures++; }
}

// ---- Helpers ----
function freshState() {
  return S.defaultState({ starterIds: ['ember_knight','tide_caller','gale_archer'] });
}
function seededRng(vals) {
  let i = 0;
  return () => vals[i++ % vals.length];
}

// ============================================================
section('generateRune — shape');
// ============================================================
const rune1 = S.generateRune(1);
assert(typeof rune1.runeId === 'string' && rune1.runeId.startsWith('rn_'), 'runeId starts with rn_');
assert(typeof rune1.type   === 'string' && D.RUNE_TYPES[rune1.type], 'type is a valid RUNE_TYPE');
assert(rune1.slot >= 1 && rune1.slot <= 6, 'slot in [1,6]');
assert(rune1.stars >= 1 && rune1.stars <= 5, 'stars in [1,5]');
assert(typeof rune1.mainStat === 'string', 'mainStat is a string');
assert(typeof rune1.mainPct  === 'number' && rune1.mainPct > 0, 'mainPct > 0');
assert(Array.isArray(rune1.subStats), 'subStats is an array');
assert(typeof rune1.acquiredAt === 'number', 'acquiredAt is a number');

section('generateRune — tier scaling');
// Tier 1 should mostly yield low-star runes; tier 5 higher-star
let t1Stars = 0, t5Stars = 0, N = 200;
for (let i = 0; i < N; i++) { t1Stars += S.generateRune(1).stars; }
for (let i = 0; i < N; i++) { t5Stars += S.generateRune(5).stars; }
assert(t1Stars / N < t5Stars / N, 'avg stars tier-5 > tier-1 (' + (t1Stars/N).toFixed(2) + ' vs ' + (t5Stars/N).toFixed(2) + ')');

section('generateRune — mainStat in allowed slot stats');
for (let slot = 1; slot <= 6; slot++) {
  const allowed = D.RUNE_SLOT_STATS[slot];
  for (let t = 0; t < 20; t++) {
    const r = S.generateRune(3, { rng: seededRng([0, (slot-1)/6, 0.5, 0.5]) });
    // Only assert if we happened to land on this slot (force via seeded rng)
    if (r.slot === slot) {
      assert(allowed.includes(r.mainStat),
        `slot ${slot}: mainStat '${r.mainStat}' in [${allowed.join(',')}]`);
      break;
    }
  }
}

section('generateRune — subStats don\'t duplicate mainStat');
for (let i = 0; i < 50; i++) {
  const r = S.generateRune(3);
  const statSet = new Set(r.subStats.map(s => s.stat));
  assert(!statSet.has(r.mainStat), 'subStats exclude mainStat (' + r.mainStat + ')');
}

// ============================================================
section('grantRune / getEquippedRunes');
// ============================================================
const state = freshState();
assert(state.runeInventory.length === 0, 'fresh state has empty runeInventory');

const r = S.generateRune(2);
S.grantRune(state, r);
assert(state.runeInventory.length === 1, 'grantRune adds to inventory');

const equipped = S.getEquippedRunes(state, 'ember_knight');
assert(Array.isArray(equipped) && equipped.length === 6, 'getEquippedRunes returns 6-element array');
assert(equipped.every(x => x === null), 'all slots initially null');

// ============================================================
section('equipRune / unequipRune');
// ============================================================
const r2 = S.generateRune(2);
r2.slot = 1;  // pin to slot 1 for predictable testing
r2.mainStat = 'atk';
S.grantRune(state, r2);

const displaced = S.equipRune(state, 'ember_knight', r2.runeId);
assert(displaced === null || typeof displaced === 'string', 'equipRune returns displaced runeId or null');
const eq2 = S.getEquippedRunes(state, 'ember_knight');
assert(eq2[0] && eq2[0].runeId === r2.runeId, 'rune appears in slot 0 after equip');

// Unequip it
const unequipped = S.unequipRune(state, 'ember_knight', 0);
assert(unequipped === r2.runeId, 'unequipRune returns the runeId');
const eq3 = S.getEquippedRunes(state, 'ember_knight');
assert(eq3[0] === null, 'slot 0 is null after unequip');

// ============================================================
section('no-double-equip invariant');
// ============================================================
const state2 = freshState();
const shared = S.generateRune(3);
shared.slot = 2;
S.grantRune(state2, shared);

// Equip on ember_knight
S.equipRune(state2, 'ember_knight', shared.runeId);
assert(S.getEquippedRunes(state2, 'ember_knight')[1] &&
       S.getEquippedRunes(state2, 'ember_knight')[1].runeId === shared.runeId,
  'rune on ember_knight slot 2');

// Now equip the same rune on tide_caller — must be removed from ember_knight
S.equipRune(state2, 'tide_caller', shared.runeId);
const eqEmber = S.getEquippedRunes(state2, 'ember_knight');
const eqTide  = S.getEquippedRunes(state2, 'tide_caller');
assert(eqEmber[1] === null, 'rune removed from ember_knight after move to tide_caller');
assert(eqTide[1] && eqTide[1].runeId === shared.runeId, 'rune now on tide_caller slot 2');

// ============================================================
section('getHeroRuneBoosts — stat accumulation');
// ============================================================
const state3 = freshState();
const rAtk = S.generateRune(3);
rAtk.type = 'fury'; rAtk.slot = 1; rAtk.mainStat = 'atk'; rAtk.mainPct = 0.10;
rAtk.subStats = [{ stat: 'def', pct: 0.05 }];
S.grantRune(state3, rAtk);
S.equipRune(state3, 'ember_knight', rAtk.runeId);

const boosts = S.getHeroRuneBoosts(state3, 'ember_knight');
assert(Math.abs(boosts.atk - 0.10) < 0.001, 'atk boost = 0.10');
assert(Math.abs(boosts.def - 0.05) < 0.001, 'def boost = 0.05 (from subStat)');
assert(boosts.hp === 0, 'hp boost = 0 (no hp rune)');

// ============================================================
section('getHeroRuneBoosts — 2-piece set bonus');
// ============================================================
const state4 = freshState();
// Two Fury runes → 8% ATK set2 bonus
[1, 3].forEach(function(slot) {
  const rr = S.generateRune(2);
  rr.type = 'fury'; rr.slot = slot; rr.mainStat = slot === 1 ? 'atk' : 'def';
  rr.mainPct = 0.05; rr.subStats = [];
  S.grantRune(state4, rr);
  S.equipRune(state4, 'ember_knight', rr.runeId);
});
const b4 = S.getHeroRuneBoosts(state4, 'ember_knight');
// 2-piece Fury set2 = 8% ATK; two mainStats = 0.05+0.05
// slot-1 mainStat='atk' (+0.05), slot-3 mainStat='def' (+0.05 to def, not atk)
// 2-piece Fury set2 adds fury.set2.pct to atk
const expectedAtk = 0.05 + D.RUNE_TYPES.fury.set2.pct;  // slot-1 main + set bonus
const expectedDef = 0.05;                                  // slot-3 main only
assert(Math.abs(b4.atk - expectedAtk) < 0.001,
  '2-pc Fury atk = ' + b4.atk.toFixed(4) + ' expected ' + expectedAtk.toFixed(4));
assert(Math.abs(b4.def - expectedDef) < 0.001,
  '2-pc Fury def = ' + b4.def.toFixed(4) + ' expected ' + expectedDef.toFixed(4));

// ============================================================
section('deleteRune — cleans inventory and hero slots');
// ============================================================
const state5 = freshState();
const del = S.generateRune(1);
del.slot = 4;
S.grantRune(state5, del);
S.equipRune(state5, 'ember_knight', del.runeId);
assert(S.getEquippedRunes(state5, 'ember_knight')[3] !== null, 'rune equipped before delete');

S.deleteRune(state5, del.runeId);
assert(state5.runeInventory.length === 0, 'runeInventory empty after delete');
assert(S.getEquippedRunes(state5, 'ember_knight')[3] === null, 'slot cleared after deleteRune');

// ============================================================
section('save migrate — adds missing rune fields');
// ============================================================
const legacySave = {
  version: 1, crystals: 500, scrolls: 3,
  ownedInstances: [], selectedHeroIds: [],
  stagesCleared: [],
};
const migrated = S.migrate(legacySave);
assert(Array.isArray(migrated.runeInventory), 'migrate adds runeInventory []');
assert(migrated.heroRunes && typeof migrated.heroRunes === 'object', 'migrate adds heroRunes {}');

// ============================================================
section('Errors during run');
// ============================================================
const errs = dom.window._jsdomErrors || [];
assert(errs.length === 0, 'no JS errors during M4.0 test run');

console.log('\nTotal failures: ' + failures);
if (failures) process.exit(1);
