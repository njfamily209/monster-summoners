/* ===========================================================
   Aetherbound M5.0 — Daily Quest system test
   Covers: pickDailyQuests determinism, ensureDailyQuests
           date refresh, progressQuest type filtering,
           claimQuestReward grants + double-claim guard,
           quest completion detection, getDailyQuests shape.
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

// Collect JS errors during script injection.
const jsErrors = [];
dom.window.addEventListener('error', e => jsErrors.push(e.message));
['data.js','art.js','sprites.js','audio.js','combat.js','save.js','summon.js','ui.js','game.js'].forEach(injectScript);

const S = window.GAME_SAVE;

let failures = 0;
function section(name) { console.log('\n— ' + name + ' —'); }
function assert(cond, msg) {
  if (cond) { console.log('  PASS: ' + msg); }
  else       { console.error('  FAIL: ' + msg); failures++; }
}

function freshState() {
  return S.defaultState({ starterIds: ['ember_knight','tide_caller','gale_archer'] });
}

// ============================================================
section('JS errors during load');
// ============================================================
assert(jsErrors.length === 0, 'no JS errors during M5.0 test run');
if (jsErrors.length) jsErrors.forEach(e => console.error('   ', e));

// ============================================================
section('API surface');
// ============================================================
assert(typeof S.pickDailyQuests    === 'function', 'pickDailyQuests exported');
assert(typeof S.ensureDailyQuests  === 'function', 'ensureDailyQuests exported');
assert(typeof S.getDailyQuests     === 'function', 'getDailyQuests exported');
assert(typeof S.progressQuest      === 'function', 'progressQuest exported');
assert(typeof S.claimQuestReward   === 'function', 'claimQuestReward exported');
assert(Array.isArray(S.DAILY_QUEST_DEFS), 'DAILY_QUEST_DEFS is array');
assert(S.DAILY_QUEST_DEFS.length >= 3, 'at least 3 quest definitions');
assert(typeof S.DAILY_QUEST_COUNT === 'number' && S.DAILY_QUEST_COUNT >= 1, 'DAILY_QUEST_COUNT is a number >= 1');

// ============================================================
section('pickDailyQuests — determinism');
// ============================================================
const date1 = '2026-05-19';
const pick1a = S.pickDailyQuests(date1);
const pick1b = S.pickDailyQuests(date1);
assert(pick1a.length === S.DAILY_QUEST_COUNT, 'picks DAILY_QUEST_COUNT quests');
assert(JSON.stringify(pick1a) === JSON.stringify(pick1b), 'same date → identical quest list');

// Different date should (very likely) produce a different set.
const date2 = '2026-05-20';
const pick2 = S.pickDailyQuests(date2);
assert(pick2.length === S.DAILY_QUEST_COUNT, 'different date also picks correct count');
// Not guaranteed to differ but highly likely with 8-choose-3 pool:
const sameAsDate1 = JSON.stringify(pick1a) === JSON.stringify(pick2);
if (sameAsDate1) console.warn('  WARN: consecutive dates produced identical quests (unlikely but possible)');

// ============================================================
section('pickDailyQuests — no duplicate quest ids');
// ============================================================
const pickedIds = pick1a.map(q => q.defId);
const uniqueIds = new Set(pickedIds);
assert(uniqueIds.size === pickedIds.length, 'no duplicate defIds in picked quests');

// ============================================================
section('pickDailyQuests — shape of each entry');
// ============================================================
for (const q of pick1a) {
  const def = S.DAILY_QUEST_DEFS.find(d => d.id === q.defId);
  assert(!!def, 'defId ' + q.defId + ' maps to a known definition');
  assert(q.progress === 0, 'initial progress is 0 for ' + q.defId);
  assert(q.claimed  === false, 'initial claimed is false for ' + q.defId);
}

// ============================================================
section('ensureDailyQuests — fresh state seeds quests');
// ============================================================
const st = freshState();
assert(st.dailyQuests === null, 'freshState has null dailyQuests');
const dq = S.ensureDailyQuests(st);
assert(dq && typeof dq.date === 'string', 'ensureDailyQuests sets date string');
assert(Array.isArray(dq.quests) && dq.quests.length === S.DAILY_QUEST_COUNT, 'ensureDailyQuests seeds correct count');
assert(st.dailyQuests === dq, 'ensureDailyQuests mutates state in place');

// ============================================================
section('ensureDailyQuests — same day returns cached object');
// ============================================================
const dq2 = S.ensureDailyQuests(st);
assert(dq2 === dq, 'second call same day returns same object');

// ============================================================
section('ensureDailyQuests — new day resets quests');
// ============================================================
const st2 = freshState();
st2.dailyQuests = { date: '2000-01-01', quests: [{ defId: 'win2', progress: 2, claimed: true }] };
const dqNew = S.ensureDailyQuests(st2);
assert(dqNew.date !== '2000-01-01', 'stale date is replaced with today');
assert(dqNew.quests.every(q => q.progress === 0 && q.claimed === false), 'reset quests start fresh');

// ============================================================
section('getDailyQuests — merges def into each quest');
// ============================================================
const st3 = freshState();
const quests = S.getDailyQuests(st3);
assert(quests.length === S.DAILY_QUEST_COUNT, 'getDailyQuests returns correct count');
for (const q of quests) {
  assert(typeof q.label  === 'string' && q.label.length > 0, 'quest has label: ' + q.defId);
  assert(typeof q.target === 'number' && q.target >= 1,      'quest has target >= 1: ' + q.defId);
  assert(typeof q.type   === 'string' && q.type.length > 0,  'quest has type: ' + q.defId);
  assert(q.reward && typeof q.reward === 'object',            'quest has reward: ' + q.defId);
}

// ============================================================
section('progressQuest — increments matching type only');
// ============================================================
const st4 = freshState();
// Force a known quest set with all three types.
st4.dailyQuests = {
  date: S.getTodayStr(),
  quests: [
    { defId: 'win2',    progress: 0, claimed: false },
    { defId: 'summon1', progress: 0, claimed: false },
    { defId: 'rune1',   progress: 0, claimed: false },
  ],
};
S.progressQuest(st4, 'win', 1);
assert(st4.dailyQuests.quests[0].progress === 1, 'win quest incremented');
assert(st4.dailyQuests.quests[1].progress === 0, 'summon quest unchanged after win progress');
assert(st4.dailyQuests.quests[2].progress === 0, 'rune quest unchanged after win progress');

S.progressQuest(st4, 'summon', 3);
assert(st4.dailyQuests.quests[1].progress === 1, 'summon quest capped at target=1');
assert(st4.dailyQuests.quests[0].progress === 1, 'win quest unchanged after summon progress');

S.progressQuest(st4, 'rune', 1);
assert(st4.dailyQuests.quests[2].progress === 1, 'rune quest incremented');

// ============================================================
section('progressQuest — does not exceed target');
// ============================================================
const st5 = freshState();
st5.dailyQuests = { date: S.getTodayStr(), quests: [{ defId: 'win2', progress: 0, claimed: false }] };
S.progressQuest(st5, 'win', 100);
assert(st5.dailyQuests.quests[0].progress === 2, 'progress capped at target (win2 = 2)');

// ============================================================
section('progressQuest — skips already-claimed quests');
// ============================================================
const st6 = freshState();
st6.dailyQuests = { date: S.getTodayStr(), quests: [{ defId: 'win2', progress: 2, claimed: true }] };
S.progressQuest(st6, 'win', 1);
assert(st6.dailyQuests.quests[0].progress === 2, 'claimed quest progress not modified');

// ============================================================
section('claimQuestReward — grants crystals/scrolls');
// ============================================================
const st7 = freshState();
st7.dailyQuests = { date: S.getTodayStr(), quests: [{ defId: 'win2', progress: 2, claimed: false }] };
const crystalsBefore = st7.crystals;
const reward = S.claimQuestReward(st7, 0);
assert(reward !== null, 'claimQuestReward returns reward object');
const def = S.DAILY_QUEST_DEFS.find(d => d.id === 'win2');
assert(reward.crystals === def.reward.crystals, 'reward crystals match definition');
assert(st7.crystals === crystalsBefore + def.reward.crystals, 'crystals added to state');
assert(st7.dailyQuests.quests[0].claimed === true, 'quest marked claimed');

// ============================================================
section('claimQuestReward — double-claim prevention');
// ============================================================
const crystalsAfterClaim = st7.crystals;
const reward2 = S.claimQuestReward(st7, 0);
assert(reward2 === null, 'second claim returns null');
assert(st7.crystals === crystalsAfterClaim, 'crystals unchanged on double claim');

// ============================================================
section('claimQuestReward — not claimable if incomplete');
// ============================================================
const st8 = freshState();
st8.dailyQuests = { date: S.getTodayStr(), quests: [{ defId: 'win5', progress: 3, claimed: false }] };
const badReward = S.claimQuestReward(st8, 0);
assert(badReward === null, 'claim on incomplete quest returns null');
assert(!st8.dailyQuests.quests[0].claimed, 'quest remains unclaimed');

// ============================================================
section('claimQuestReward — invalid index returns null');
// ============================================================
const st9 = freshState();
st9.dailyQuests = { date: S.getTodayStr(), quests: [{ defId: 'win2', progress: 2, claimed: false }] };
assert(S.claimQuestReward(st9, 99) === null, 'out-of-range index returns null');

// ============================================================
section('progressQuest — returns changed array');
// ============================================================
const st10 = freshState();
st10.dailyQuests = { date: S.getTodayStr(), quests: [
  { defId: 'win2',  progress: 0, claimed: false },
  { defId: 'win10', progress: 0, claimed: false },
]};
const changed = S.progressQuest(st10, 'win', 2);
assert(Array.isArray(changed), 'progressQuest returns array');
assert(changed.length === 2, 'both win quests reported changed');
const win2change = changed.find(c => c.defId === 'win2');
assert(win2change && win2change.completed === true,  'win2 reported completed');
const win10change = changed.find(c => c.defId === 'win10');
assert(win10change && win10change.completed === false, 'win10 reported not yet completed');

// ============================================================
console.log('\n=================================');
if (failures === 0) {
  console.log('Total failures: 0');
  console.log('All M5.0 tests passed.');
} else {
  console.error('Total failures: ' + failures);
  process.exit(1);
}
