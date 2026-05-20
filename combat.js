/* ===========================================================
   Aetherbound — combat engine
   Exposed on window.GAME_COMBAT
   Owner: Backend
   =========================================================== */
(function () {
  'use strict';
  const D = window.GAME_DATA;
  if (!D) { console.error('GAME_DATA missing'); return; }

  const ATB_TICK_MS = 100;
  const ATB_RATE = 0.10;
  const DEF_SCALE = 4;
  const ANIM_DELAY = 700;
  const ENEMY_THINK_MS = 450;
  const LOG_MAX = 80;

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function statMul(unit, stat) {
    let mul = 1;
    for (const s of unit.statuses) if (s.stat === stat) mul *= (1 + s.amount);
    // Clamp at 5% so cumulative debuffs can never zero a unit out entirely.
    return Math.max(0.05, mul);
  }
  function effStat(unit, stat) { return unit.base[stat] * statMul(unit, stat); }
  function isStunned(unit) { return unit.statuses.some(s => s.stat === 'stun'); }
  function isAlive(unit) { return unit.hp > 0; }

  function calcAttackDamage(att, target, skill) {
    const baseATK = effStat(att, 'atk');
    const baseDEF = effStat(target, 'def');
    const mul = skill.mul || 1;
    let dmg = baseATK * mul * 1000 / (1000 + baseDEF * DEF_SCALE);
    const eMod = D.elementMod(att.element, target.element);
    dmg *= eMod;
    let crit = false;
    const critRate = att.critRate + (skill.critBonus || 0);
    if (Math.random() < critRate) {
      dmg *= (1 + att.critDmg);
      crit = true;
    }
    dmg *= rand(0.95, 1.05);
    dmg = Math.max(1, Math.floor(dmg));
    return { dmg, crit, eMod };
  }

  function applyDamage(target, amount) {
    let remaining = amount;
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, remaining);
      target.shield -= absorbed;
      remaining -= absorbed;
    }
    target.hp = Math.max(0, target.hp - remaining);
    return amount;
  }
  function applyHeal(target, amount) {
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    return target.hp - before;
  }

  // level: 1-based; stats scale up gently per level beyond 1.
  // runeBoosts (optional): { atk, def, hp, spd, critRate, critDmg } — additive % boosts from runes.
  function buildUnit(template, side, position, level, runeBoosts) {
    level = Math.max(1, level || 1);
    const lv = level - 1; // extra levels beyond 1
    const base = template.base;
    let scaledHp  = Math.round(base.hp  * (1 + lv * 0.030));
    let scaledAtk = Math.round(base.atk * (1 + lv * 0.025));
    let scaledDef = Math.round(base.def * (1 + lv * 0.025));
    let scaledSpd = base.spd;
    let critRate = base.critRate;
    let critDmg  = base.critDmg;
    // Apply rune boosts after level scaling (runes buff the scaled stat).
    if (runeBoosts) {
      if (runeBoosts.hp)       scaledHp  = Math.round(scaledHp  * (1 + runeBoosts.hp));
      if (runeBoosts.atk)      scaledAtk = Math.round(scaledAtk * (1 + runeBoosts.atk));
      if (runeBoosts.def)      scaledDef = Math.round(scaledDef * (1 + runeBoosts.def));
      if (runeBoosts.spd)      scaledSpd = Math.round(scaledSpd * (1 + runeBoosts.spd));
      if (runeBoosts.critRate) critRate  = Math.min(0.95, critRate  + runeBoosts.critRate);
      if (runeBoosts.critDmg)  critDmg   = critDmg  + runeBoosts.critDmg;
    }
    return {
      id: `${side}-${position}`,
      template, name: template.name, element: template.element, stars: template.stars,
      role: template.role, art: template.art,
      level,
      base: { hp: scaledHp, atk: scaledAtk, def: scaledDef, spd: scaledSpd },
      critRate, critDmg,
      maxHp: scaledHp, hp: scaledHp,
      atb: 0,
      cooldowns: Object.fromEntries((template.skills || []).map(s => [s, 0])),
      statuses: [], shield: 0,
      side, position, skills: template.skills,
    };
  }

  // opts.levelMap:   { [heroId]: level } — allies are built at the given level.
  // opts.runeBoosts: { [heroId]: { atk, def, hp, spd, critRate, critDmg } } — rune bonuses.
  function makeBattle(heroIds, stage, opts) {
    const levelMap   = (opts && opts.levelMap)   || {};
    const runeBoosts = (opts && opts.runeBoosts) || {};
    const heroes = heroIds.map((id, i) => buildUnit(
      D.HEROES.find(h => h.id === id), 'ally', i, levelMap[id] || 1, runeBoosts[id] || null
    ));
    // Apply stage enemyMul — lets us reuse enemy templates at higher tiers.
    const mul = (stage && stage.enemyMul) || 1.0;
    const enemies = stage.enemyIds.map((id, i) => {
      const u = buildUnit(D.ENEMIES.find(e => e.id === id), 'enemy', i);
      if (mul !== 1.0) {
        u.base.hp = Math.floor(u.base.hp * mul);
        u.base.atk = Math.floor(u.base.atk * mul);
        u.base.def = Math.floor(u.base.def * mul);
        u.maxHp = u.base.hp;
        u.hp = u.maxHp;
      }
      return u;
    });
    heroes.forEach(u => u.atb = Math.random() * 25);
    enemies.forEach(u => u.atb = Math.random() * 25);
    return {
      stage, ally: heroes, enemy: enemies, log: [], turnCount: 0,
      paused: false, acting: null, pendingSkill: null, result: null,
      lastActingAlly: heroes[0] || null,
    };
  }
  function allUnits(b) { return b.ally.concat(b.enemy); }
  function aliveEnemiesOf(b, unit) { return (unit.side === 'ally' ? b.enemy : b.ally).filter(isAlive); }
  function aliveAlliesOf(b, unit) { return (unit.side === 'ally' ? b.ally : b.enemy).filter(isAlive); }

  function tickEndOfTurn(unit) {
    for (const sid in unit.cooldowns) if (unit.cooldowns[sid] > 0) unit.cooldowns[sid] -= 1;
    unit.statuses = unit.statuses
      .map(s => Object.assign({}, s, { turns: s.turns - 1 }))
      .filter(s => s.turns > 0);
    if (!unit.statuses.some(s => s.kind === 'shield')) unit.shield = 0;
  }

  function applyStatus(unit, status, log) {
    unit.statuses.push({
      kind: status.kind || 'buff',
      stat: status.stat,
      amount: status.amount || 0,
      turns: (status.turns || 1) + 1,
      label: status.label || '',
    });
    if (status.label && log) log(`→ ${unit.name} gains <strong>${status.label}</strong> for ${status.turns || 1} turn(s).`);
  }

  function checkResult(b) {
    const anyAlly = b.ally.some(isAlive);
    const anyEnemy = b.enemy.some(isAlive);
    if (!anyAlly) b.result = 'defeat';
    else if (!anyEnemy) b.result = 'victory';
    return b.result;
  }

  function pickAiAction(b, unit) {
    const available = unit.skills.filter(sid => unit.cooldowns[sid] <= 0);
    if (!available.length) return null;
    const ranked = available.slice().sort((a, b2) => (D.SKILLS[b2].cd || 0) - (D.SKILLS[a].cd || 0));
    const skillId = Math.random() < 0.65 ? ranked[0] : available[Math.floor(Math.random() * available.length)];
    const skill = D.SKILLS[skillId];
    let target = null;
    if (skill.type === 'attack' || skill.type === 'multihit') {
      const enemies = aliveEnemiesOf(b, unit).slice().sort((a, b2) => (a.hp/a.maxHp) - (b2.hp/b2.maxHp));
      target = enemies[0];
    } else if (skill.type === 'heal' || skill.type === 'buff') {
      const allies = aliveAlliesOf(b, unit).slice().sort((a, b2) => (a.hp/a.maxHp) - (b2.hp/b2.maxHp));
      target = allies[0];
    }
    return { skillId, target };
  }

  const PRIORITY_RULES = [
    function healWhenLow(ctx) {
      if (ctx.skill.type !== 'heal') return null;
      const lowest = ctx.allies.slice().sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      if (!lowest) return null;
      const pct = lowest.hp / lowest.maxHp;
      if (pct >= 0.55) return null;
      return { target: lowest, score: 200 + (1 - pct) * 80 };
    },
    function buffEarly(ctx) {
      if (ctx.skill.type !== 'buff') return null;
      const tgt = ctx.skill.target === 'self' ? ctx.unit : ctx.allies[0];
      const score = Math.max(40, 110 - ctx.turnCount * 4);
      return { target: tgt, score };
    },
    function specialOffCd(ctx) {
      if (ctx.skill.type !== 'attack' && ctx.skill.type !== 'multihit' && ctx.skill.type !== 'aoe') return null;
      const cd = ctx.skill.cd || 0;
      if (cd <= 0) return null;
      let target = null;
      let score = 120 + cd * 12;
      if (ctx.skill.type === 'aoe') {
        // 1v1 guard: don't burn a multi-target cooldown on a single foe.
        // Fallback path still picks AOE if it's the only skill off cd.
        if (ctx.enemies.length <= 1) return null;
        score += ctx.enemies.length * 10;
      } else {
        target = pickAttackTarget(ctx.unit, ctx.enemies, ctx.skill);
        if (target) score += elementBonus(ctx.unit, target) * 15 + (1 - target.hp / target.maxHp) * 20;
      }
      return { target, score };
    },
    function executeLowHp(ctx) {
      if (ctx.skill.type !== 'attack' && ctx.skill.type !== 'multihit') return null;
      const finishable = ctx.enemies
        .filter(e => e.hp / e.maxHp < 0.30)
        .sort((a, b) => a.hp - b.hp)[0];
      if (!finishable) return null;
      return { target: finishable, score: 110 };
    },
    function defaultAttack(ctx) {
      if (ctx.skill.type === 'aoe') {
        // Same 1v1 guard as specialOffCd.
        if (ctx.enemies.length <= 1) return null;
        return { target: null, score: 70 + ctx.enemies.length * 5 };
      }
      if (ctx.skill.type === 'attack' || ctx.skill.type === 'multihit') {
        const target = pickAttackTarget(ctx.unit, ctx.enemies, ctx.skill);
        if (!target) return null;
        return { target, score: 60 + elementBonus(ctx.unit, target) * 10 };
      }
      return null;
    },
  ];

  function elementBonus(att, def) {
    const m = D.elementMod(att.element, def.element);
    if (m > 1) return 2;
    if (m < 1) return -1;
    return 0;
  }
  function pickAttackTarget(unit, enemies, skill) {
    if (!enemies.length) return null;
    const scored = enemies.map(e => {
      let s = 50;
      s += elementBonus(unit, e) * 25;
      s -= (e.hp / e.maxHp) * 40;
      s += (e.base.atk / 100) * 4;
      return { e, s };
    }).sort((a, b) => b.s - a.s);
    return scored[0].e;
  }

  function pickAllyAction(b, unit, opts) {
    const enemies = aliveEnemiesOf(b, unit);
    const allies = aliveAlliesOf(b, unit);
    const available = unit.skills.filter(sid => unit.cooldowns[sid] <= 0);
    if (!available.length) return null;
    const rules = (opts && opts.rules) || PRIORITY_RULES;
    let best = null;
    for (const sid of available) {
      const skill = D.SKILLS[sid];
      const ctx = { unit, skill, enemies, allies, turnCount: b.turnCount };
      for (const rule of rules) {
        const r = rule(ctx);
        if (r && (!best || r.score > best.score)) {
          best = { skillId: sid, target: r.target, score: r.score };
        }
      }
    }
    if (best) return { skillId: best.skillId, target: best.target };
    const sid = available[0];
    const sk = D.SKILLS[sid];
    let target = null;
    if (sk.target === 'enemy') target = enemies[0];
    else if (sk.target === 'ally') target = allies[0];
    return { skillId: sid, target };
  }

  window.GAME_COMBAT = {
    ATB_TICK_MS, ATB_RATE, DEF_SCALE, ANIM_DELAY, ENEMY_THINK_MS, LOG_MAX,
    statMul, effStat, isStunned, isAlive,
    calcAttackDamage, applyDamage, applyHeal,
    buildUnit, makeBattle, allUnits, aliveEnemiesOf, aliveAlliesOf,
    tickEndOfTurn, applyStatus, checkResult, pickAiAction,
    pickAllyAction, pickAttackTarget, PRIORITY_RULES,
  };
})();
