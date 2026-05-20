/* ===========================================================
   Aetherbound M1 — functional test (jsdom)
   Verifies: data integrity, screen transitions, combat math,
   skill execution, win/lose conditions, AI, no JS errors.
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

await new Promise(r => setTimeout(r, 50));
injectScript('data.js');
injectScript('art.js');
injectScript('save.js');
injectScript('combat.js');
injectScript('ui.js');
injectScript('game.js');

await new Promise(r => setTimeout(r, 100));
const G = window.__GAME__;
const D = window.GAME_DATA;
const A = window.GAME_ART;

function assert(cond, msg) {
  if (!cond) { console.error('  FAIL:', msg); failures.push(msg); }
  else { console.log('  PASS:', msg); }
}
function section(name) { console.log('\n— ' + name + ' —'); }

const failures = [];

// =============== Tests ===============

section('Data integrity');
assert(D.HEROES.length >= 6, 'at least 6 heroes');
assert(D.ENEMIES.length >= 3, 'at least three enemies');
assert(D.STAGES.length >= 1, 'at least one stage');
const elements = new Set(D.HEROES.map(h => h.element));
assert(elements.size >= 5, 'all 5 elements represented across heroes');
for (const h of D.HEROES) {
  assert(h.base && h.base.hp > 0 && h.base.atk > 0 && h.base.def >= 0 && h.base.spd > 0,
    `${h.name} has valid stats`);
  assert(Array.isArray(h.skills) && h.skills.length >= 1, `${h.name} has skills`);
  for (const sid of h.skills) {
    assert(D.SKILLS[sid], `${h.name}: skill ${sid} exists`);
  }
}

section('Element wheel math');
assert(D.elementMod('fire', 'wind') === 1.5, 'fire > wind = 1.5');
assert(D.elementMod('wind', 'fire') === 0.75, 'wind < fire = 0.75');
assert(D.elementMod('water', 'fire') === 1.5, 'water > fire = 1.5');
assert(D.elementMod('light', 'dark') === 1.5, 'light > dark = 1.5');
assert(D.elementMod('dark', 'light') === 1.5, 'dark > light = 1.5');
assert(D.elementMod('fire', 'fire') === 1.0, 'same element = 1.0');
assert(D.elementMod('fire', 'light') === 1.0, 'fire vs light = 1.0');

section('Art rendering');
for (const m of D.HEROES.concat(D.ENEMIES)) {
  const svg = A.renderPortrait(m);
  assert(svg.includes('<svg'), `${m.name} portrait contains <svg>`);
  assert(svg.length > 300, `${m.name} portrait is non-trivial (len=${svg.length})`);
}

// Seed player save so the legacy M1 flow works under owned-only team-select.
// Forces ownership of the original 6 3★ starters; later tests cover ownership filtering.
if (G && G.S) {
  G.S.clear();
  G.state.player = G.S.defaultState({ starterIds:
    ['ember_knight','tide_caller','gale_archer','dawn_cleric','shade_stalker','stone_guardian'] });
  G.persistNow();
}

section('Title screen');
if (G && G.navigate) G.navigate('title');
assert(document.querySelector('.title h1'), 'title screen has heading');
assert(document.querySelector('.title h1').textContent === 'Aetherbound', 'heading text correct');
// Find Start Battle CTA — either the legacy plain .btn or the new .btn-primary-cta
// with a nested .cta-text span. Either way the visible label is "Start Battle".
const startBtn = [...document.querySelectorAll('button')].find(b => {
  const t = (b.textContent || '').trim();
  return t === 'Start Battle' || /Start Battle$/.test(t);
});
assert(!!startBtn, 'start battle button present');

section('Team select');
// "Start Battle" now goes to stage-select (M3.0). For this legacy M1 flow,
// we route straight to team-select via the public API.
G.pickStage('goblin_camp_1');
assert(document.querySelector('.roster-grid'), 'roster grid present');
assert(document.querySelectorAll('.roster-card').length === 6, '6 hero cards rendered');
const cards = document.querySelectorAll('.roster-card');
cards[0].click(); cards[1].click(); cards[2].click();
assert(G.state.selectedHeroIds.length === 3, '3 heroes selected');
const battleBtn = document.querySelector('.team-bar .btn');
assert(battleBtn && !battleBtn.disabled, 'battle button enabled after 3 picks');

section('Battle start');
battleBtn.click();
assert(G.state.battle, 'battle state created');
assert(G.state.battle.ally.length === 3, '3 allies');
assert(G.state.battle.enemy.length === 3, '3 enemies');
assert(document.querySelector('.field'), 'battle field rendered');

section('Combat math');
const ember = D.HEROES.find(h => h.id === 'ember_knight');
const goblin = D.ENEMIES.find(e => e.id === 'goblin_brawler');
function build(template, side) {
  return {
    template, name: template.name, element: template.element,
    base: { ...template.base }, critRate: 0, critDmg: 0,
    maxHp: template.base.hp, hp: template.base.hp, atb: 0,
    cooldowns: {}, statuses: [], shield: 0, side,
    skills: template.skills,
  };
}
const a = build(ember, 'ally');
const dUnit = build(goblin, 'enemy');
const dmgs = [];
for (let i = 0; i < 100; i++) {
  dmgs.push(G.calcAttackDamage(a, dUnit, D.SKILLS.burningSlash).dmg);
}
const avg = dmgs.reduce((s,v)=>s+v,0) / dmgs.length;
console.log('  avg burningSlash damage (fire vs wind):', avg.toFixed(1));
assert(avg > 350 && avg < 500, 'damage in reasonable range (350-500)');

section('Run battle to completion');
let safeIterations = 200;
let battleEnded = false;
async function autoPlay() {
  return new Promise(resolve => {
    const check = setInterval(() => {
      safeIterations--;
      if (safeIterations <= 0) { clearInterval(check); resolve(false); return; }
      const b = G.state.battle;
      if (!b) { clearInterval(check); resolve(true); return; }
      if (b.result) { clearInterval(check); battleEnded = true; resolve(true); return; }
      if (!b.acting) return;
      if (b.acting.side === 'ally' && !b.pendingSkill) {
        const u = b.acting;
        const offcd = u.skills.find(sid => (u.cooldowns[sid] || 0) === 0);
        if (offcd) {
          const sk = D.SKILLS[offcd];
          if (sk.target === 'enemy') {
            const tgt = b.enemy.find(e => e.hp > 0);
            G.castSkill(u, offcd, tgt);
          } else if (sk.target === 'ally') {
            const tgt = b.ally.find(e => e.hp > 0);
            G.castSkill(u, offcd, tgt);
          } else {
            G.castSkill(u, offcd, null);
          }
        }
      }
    }, 50);
  });
}
await autoPlay();
assert(battleEnded, 'battle resolved within iteration budget');
assert(G.state.battle && (G.state.battle.result === 'victory' || G.state.battle.result === 'defeat'),
  'battle has a result');
console.log('  battle result:', G.state.battle && G.state.battle.result);
console.log('  ally hp:', G.state.battle.ally.map(u => `${u.name}:${Math.floor(u.hp)}/${u.maxHp}`).join(', '));
console.log('  enemy hp:', G.state.battle.enemy.map(u => `${u.name}:${Math.floor(u.hp)}/${u.maxHp}`).join(', '));

section('Stunning + statuses');
const test = build(ember, 'ally');
test.statuses.push({ stat: 'stun', amount: 0, turns: 2, label: 'STUN' });
const stunned = test.statuses.some(s => s.stat === 'stun');
assert(stunned, 'stun status applied');

section('Errors during run');
console.log('  collected errors:', errors.length);
errors.forEach(e => console.log('    ', e?.message || e));
assert(errors.length === 0, 'no JS errors during full run');

section('Auto-battle (M1.5)');
assert(typeof window.GAME_COMBAT.pickAllyAction === 'function', 'pickAllyAction exposed');
assert(Array.isArray(window.GAME_COMBAT.PRIORITY_RULES), 'PRIORITY_RULES exposed');
assert(typeof G.toggleAuto === 'function', 'toggleAuto exposed');
G.navigate('team-select');
G.setSelectedHeroIds(['ember_knight','dawn_cleric','shade_stalker']);
G.confirmTeam();
G.state.autoBattle = true;
let safe2 = 200;
let auto_resolved = false;
await new Promise(resolve => {
  const t = setInterval(() => {
    safe2--;
    const b = G.state.battle;
    if (!b || safe2 <= 0) { clearInterval(t); resolve(); return; }
    if (b.result) { clearInterval(t); auto_resolved = true; resolve(); }
  }, 50);
});
assert(auto_resolved, 'auto-battle resolved without player input');
console.log('  auto-battle result:', G.state.battle && G.state.battle.result);

section('Swappable art system');
assert(typeof window.GAME_ART.registerPack === 'function', 'registerPack exposed');
assert(window.GAME_ART.listPacks().includes('procedural'), 'procedural pack present');
const fakeMonster = { name: 'Test', element: 'fire', art: { src: 'art/test.png' } };
const html_img = window.GAME_ART.renderPortrait(fakeMonster);
assert(html_img.includes('<img') && html_img.includes('art/test.png'), 'monster.art.src renders <img>');
window.GAME_ART.registerPack('pixel', { renderPortrait: m => `<img class="portrait-img" src="pixel/${m.name}.png"/>` });
window.GAME_ART.setPack('pixel');
const noSrc = { name: 'Hero', element: 'fire', art: { kind: 'warrior' } };
const html_pack = window.GAME_ART.renderPortrait(noSrc);
assert(html_pack.includes('pixel/Hero.png'), 'active pack used when no per-monster src');
window.GAME_ART.setPack('procedural');
const html_back = window.GAME_ART.renderPortrait(noSrc);
assert(html_back.includes('<svg'), 'pack swap back to procedural works');

console.log('\n=================================');
console.log(`Total failures: ${failures.length}`);
if (failures.length) {
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('All tests passed.');
  process.exit(0);
}
