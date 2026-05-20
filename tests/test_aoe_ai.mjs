/* ===========================================================
   Aetherbound — AOE AI guard regression test
   Verifies: the `specialOffCd` priority rule no longer recommends
   AOE skills when only 1 enemy is alive. Falls back to AOE if it's
   the unit's only available skill.
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

await new Promise(r => setTimeout(r, 50));
injectScript('data.js');
injectScript('art.js');
injectScript('save.js');
injectScript('combat.js');

await new Promise(r => setTimeout(r, 50));
const D = window.GAME_DATA;
const C = window.GAME_COMBAT;

const failures = [];
function assert(cond, msg) {
  if (!cond) { console.error('  FAIL:', msg); failures.push(msg); }
  else { console.log('  PASS:', msg); }
}
function section(name) { console.log('\n— ' + name + ' —'); }

section('Setup');

function heroWith(types) {
  for (const h of D.HEROES) {
    const skillTypes = (h.skills || []).map(sid => D.SKILLS[sid] && D.SKILLS[sid].type);
    if (types.every(t => skillTypes.includes(t))) return h;
  }
  return null;
}

const allyHero = heroWith(['attack', 'aoe']);
assert(allyHero, 'found a hero with both single-target and AOE skills');

const enemyDef = D.ENEMIES[0];
assert(enemyDef, 'have at least 1 enemy template');

const fakeStage1 = { enemyIds: [enemyDef.id], enemyMul: 1.0 };
const fakeStage2 = { enemyIds: [enemyDef.id, (D.ENEMIES[1] || D.ENEMIES[0]).id], enemyMul: 1.0 };

section('AOE guard: 1v1 should not pick AOE when single-target available');

const battle1v1 = C.makeBattle([allyHero.id], fakeStage1);
const ally = battle1v1.ally[0];
for (const sid of ally.skills) ally.cooldowns[sid] = 0;
const aoeSkillIds = ally.skills.filter(sid => D.SKILLS[sid].type === 'aoe');
assert(aoeSkillIds.length >= 1, 'ally has at least one AOE skill (sanity)');

const decision = C.pickAllyAction(battle1v1, ally);
assert(decision != null && decision.skillId, 'pickAllyAction returned a decision');
const pickedSkill = D.SKILLS[decision.skillId];
assert(pickedSkill && pickedSkill.type !== 'aoe',
  '1v1 should NOT pick AOE (picked: ' + decision.skillId + ' type=' + (pickedSkill && pickedSkill.type) + ')');

section('AOE fallback: only AOE off-cd');

const battleFb = C.makeBattle([allyHero.id], fakeStage1);
const allyFb = battleFb.ally[0];
for (const sid of allyFb.skills) {
  allyFb.cooldowns[sid] = D.SKILLS[sid].type === 'aoe' ? 0 : 99;
}
const decisionFb = C.pickAllyAction(battleFb, allyFb);
assert(decisionFb != null && decisionFb.skillId, 'fallback decision returned');
assert(D.SKILLS[decisionFb.skillId].type === 'aoe',
  'when AOE is the only available skill, it is still picked (no soft-lock)');

section('AOE valid with multiple enemies');

const battle1v2 = C.makeBattle([allyHero.id], fakeStage2);
const allyM = battle1v2.ally[0];
for (const sid of allyM.skills) allyM.cooldowns[sid] = 0;
const decisionM = C.pickAllyAction(battle1v2, allyM);
assert(decisionM != null && decisionM.skillId, '1v2 returned a decision');
const t = D.SKILLS[decisionM.skillId].type;
assert(['attack', 'multihit', 'aoe'].includes(t),
  '1v2 picked a damage skill (got type=' + t + ')');

section('Errors captured');
assert(errors.length === 0, 'no JS errors during AOE AI test (' + errors.length + ' captured)');
if (errors.length) errors.forEach(e => console.error('  >>', e));

console.log('\n=== AOE AI test: ' + (failures.length === 0 ? 'PASS' : failures.length + ' FAIL') + ' ===');
process.exit(failures.length === 0 ? 0 : 1);
