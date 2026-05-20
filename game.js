/* ===========================================================
   Aetherbound — main glue (routes, state, skill execution)
   SHARED FILE — coordinated edits by Backend + Frontend.
   Backend: state shape, persistence, combat orchestration, rewards.
   Frontend: route → render map; no logic changes here.
   =========================================================== */
(function () {
  'use strict';
  const D = window.GAME_DATA;
  const A = window.GAME_ART;
  const C = window.GAME_COMBAT;
  const U = window.GAME_UI;
  const S = window.GAME_SAVE;
  if (!D || !A || !C || !U || !S) { console.error('Game modules missing'); return; }

  // XP granted per hero per battle win, indexed by stage tier (index 0 unused).
  const XP_BY_TIER = [0, 40, 70, 110, 165, 230, 310];

  const app = document.getElementById('app');

  const state = {
    screen: 'title',
    battle: null,
    lastStage: null,
    queuedStage: null, // set by stage-select before going to team-select
    player: S.loadOrInit(),
  };

  Object.defineProperty(state, 'selectedHeroIds', {
    get() { return state.player.selectedHeroIds; },
    set(v) { state.player.selectedHeroIds = v; persist(); },
  });
  Object.defineProperty(state, 'autoBattle', {
    get() { return state.player.autoBattle; },
    set(v) { state.player.autoBattle = v; persist(); },
  });

  let saveTimer = null;
  function persist() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => { S.save(state.player); saveTimer = null; }, 60);
  }
  function persistNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    S.save(state.player);
  }

  let tickerInterval = null;
  function startTicker() {
    stopTicker();
    tickerInterval = setInterval(tickAtb, C.ATB_TICK_MS);
  }
  function stopTicker() {
    if (tickerInterval) { clearInterval(tickerInterval); tickerInterval = null; }
  }

  // ----- Routing (Frontend hook point) -----
  function navigate(screen) {
    state.screen = screen;
    if (screen !== 'battle') {
      stopTicker();
      state.battle = null;
    }
    if (screen === 'title') U.renderTitle(app, ctx);
    else if (screen === 'stage-select') U.renderStageSelect(app, ctx);
    else if (screen === 'team-select') U.renderTeamSelect(app, ctx);
    else if (screen === 'battle') U.renderBattle(app, ctx);
    else if (screen === 'summon') U.renderSummon(app, ctx);
    else if (screen === 'vault') U.renderVault(app, ctx);
    else if (screen === 'shop') U.renderShop(app, ctx);
    else if (screen === 'runes') U.renderRunes(app, ctx);
    else if (screen === 'quests') U.renderQuests(app, ctx);
  }

  function pickStage(stageId) {
    const stage = D.stageById(stageId);
    if (!stage) return;
    if (!S.isStageUnlocked(state.player, stage)) {
      U.toast('Clear the previous stage to unlock this one.');
      return;
    }
    state.queuedStage = stage;
    navigate('team-select');
  }

  function confirmTeam() {
    if (state.selectedHeroIds.length !== 3) return;
    const ownedFilter = state.selectedHeroIds.filter(id => S.ownsHero(state.player, id));
    if (ownedFilter.length !== 3) {
      U.toast('Some selected heroes are no longer owned.');
      state.player.selectedHeroIds = [];
      persist();
      navigate('team-select');
      return;
    }
    const stage = state.queuedStage || D.STAGES[0];
    startBattle(state.selectedHeroIds, stage);
  }

  function resetSave() {
    S.clear();
    state.player = S.loadOrInit();
    state.queuedStage = null;
    state.lastStage = null;
    persistNow();
    navigate('title');
  }

  function startBattle(heroIds, stage) {
    // Build a level map so the combat engine scales hero stats by level.
    const levelMap = {};
    heroIds.forEach(id => { levelMap[id] = S.getHeroLevel(state.player, id); });
    // Compute rune boosts for each hero so combat.js can apply them.
    const runeBoosts = {};
    heroIds.forEach(id => { runeBoosts[id] = S.getHeroRuneBoosts(state.player, id); });
    state.battle = C.makeBattle(heroIds, stage, { levelMap, runeBoosts });
    state.lastStage = stage;
    logEntry('Battle begins: <strong>' + stage.name + '</strong>');
    navigate('battle');
    startTicker();
  }

  function rebattle() {
    const stage = state.lastStage || D.STAGES[0];
    const ids = state.selectedHeroIds.slice();
    if (ids.length !== 3 || !ids.every(id => S.ownsHero(state.player, id))) {
      navigate('team-select');
      return;
    }
    startBattle(ids, stage);
  }

  // Victory rewards scale with the stage's rewardMul. Also marks the stage
  // cleared so the next-tier stages unlock.
  function grantVictoryRewards() {
    const b = state.battle;
    if (!b || b.rewards || b.result !== 'victory') return null;
    const mul = (b.stage && b.stage.rewardMul) || 1.0;
    const baseCrystals = 200 + Math.floor(Math.random() * 301);
    const crystals = Math.floor(baseCrystals * mul);
    // Scroll drop chance scales modestly with reward tier (15% to 33%).
    const scrollChance = Math.min(0.5, 0.15 * mul);
    const scroll = Math.random() < scrollChance ? 1 : 0;
    S.addCrystals(state.player, crystals);
    if (scroll) S.addScrolls(state.player, scroll);
    // Track first-clear before marking so we can celebrate it in the UI.
    const isFirstClear = b.stage && b.stage.id && !S.isStageCleared(state.player, b.stage.id);
    if (b.stage && b.stage.id) S.markStageCleared(state.player, b.stage.id);

    // Grant XP to every hero that participated (alive or not).
    const tier = (b.stage && b.stage.tier) || 1;
    const heroXp = XP_BY_TIER[tier] || 40;
    const levelUps = b.ally
      .map(u => u.template && u.template.id)
      .filter(Boolean)
      .map(hid => S.addHeroXp(state.player, hid, heroXp))
      .filter(Boolean);

    // Rune drop — chance scales with stage tier (20% → 55%).
    const runeDropChance = Math.min(0.55, 0.20 + (tier - 1) * 0.07);
    let droppedRune = null;
    if (Math.random() < runeDropChance) {
      droppedRune = S.generateRune(tier);
      S.grantRune(state.player, droppedRune);
    }

    // Record win streak and daily quest progress before persisting.
    S.recordWin(state.player);
    const questChanges = S.progressQuest(state.player, 'win', 1);
    // Collect labels for any quests that just completed so the victory screen can celebrate them.
    const completedQuests = (questChanges || [])
      .filter(function(c) { return c.completed; })
      .map(function(c) {
        const def = S.DAILY_QUEST_DEFS.find(function(d) { return d.id === c.defId; });
        return def ? def.label : c.defId;
      });
    persistNow();
    b.rewards = { crystals, scrolls: scroll, xp: heroXp, levelUps, winStreak: state.player.winStreak, firstClear: !!isFirstClear, rune: droppedRune, completedQuests };
    return b.rewards;
  }

  function logEntry(html) {
    if (!state.battle) return;
    state.battle.log.push(html);
    if (state.battle.log.length > C.LOG_MAX) state.battle.log.shift();
    U.renderLog(ctx);
  }

  function tickAtb() {
    const b = state.battle;
    if (!b || b.paused || b.result) return;
    for (const u of C.allUnits(b)) {
      if (!C.isAlive(u)) continue;
      const spd = C.effStat(u, 'spd');
      u.atb += spd * C.ATB_RATE;
    }
    let candidate = null;
    for (const u of C.allUnits(b)) {
      if (!C.isAlive(u)) continue;
      if (u.atb >= 100 && (!candidate || u.atb > candidate.atb)) candidate = u;
    }
    if (candidate) {
      b.paused = true;
      beginTurn(candidate);
    }
    U.renderAtb(ctx);
  }

  function beginTurn(unit) {
    const b = state.battle;
    b.acting = unit;
    b.turnCount += 1;
    if (unit.side === 'ally') b.lastActingAlly = unit;
    if (C.isStunned(unit)) {
      logEntry('<strong>' + unit.name + '</strong> is stunned and loses their turn.');
      C.tickEndOfTurn(unit);
      finishTurn();
      return;
    }
    U.renderBattle(app, ctx);
    if (unit.side === 'ally' && !state.autoBattle) {
      // YOUR TURN beat — quick stamp so the player notices control passed.
      if (U.capcomStamp) U.capcomStamp(unit.name.toUpperCase() + " — YOUR TURN", 'your-turn', 550);
      U.renderSkillPanel(ctx);
    } else {
      // Auto-battle runs at half the normal think time for a snappier pace.
      const thinkMs = state.autoBattle ? Math.floor(C.ENEMY_THINK_MS / 2) : C.ENEMY_THINK_MS;
      setTimeout(() => unit.side === 'ally' ? autoAct(unit) : aiAct(unit), thinkMs);
    }
  }

  function finishTurn() {
    const b = state.battle;
    if (!b) return;
    if (b.acting) b.acting.atb = 0;
    b.acting = null;
    b.pendingSkill = null;
    C.checkResult(b);
    if (b.result) {
      stopTicker();
      if (b.result === 'victory') grantVictoryRewards();
      else { S.recordDefeat(state.player); persistNow(); }
      U.renderBattle(app, ctx);
      U.showResult(app, ctx);
      return;
    }
    U.renderBattle(app, ctx);
    // Auto-battle uses a shorter animation delay so it feels fast and satisfying.
    const animMs = state.autoBattle ? Math.floor(C.ANIM_DELAY / 2) : C.ANIM_DELAY;
    setTimeout(() => { b.paused = false; }, animMs);
  }

  function aiAct(unit) {
    if (!state.battle || !C.isAlive(unit)) return finishTurn();
    const choice = C.pickAiAction(state.battle, unit);
    if (!choice) return finishTurn();
    castSkill(unit, choice.skillId, choice.target);
  }

  function autoAct(unit) {
    if (!state.battle || !C.isAlive(unit)) return finishTurn();
    const choice = C.pickAllyAction(state.battle, unit);
    if (!choice) return finishTurn();
    castSkill(unit, choice.skillId, choice.target);
  }

  function toggleAuto() {
    state.autoBattle = !state.autoBattle;
    const b = state.battle;
    // Cancel any pending skill-targeting when switching to auto-battle so that
    // autoAct fires immediately instead of waiting for a manual target click.
    if (state.autoBattle && b && b.pendingSkill) b.pendingSkill = null;
    U.renderBattle(app, ctx);
    if (state.autoBattle && b && !b.result && b.acting && b.acting.side === 'ally') {
      setTimeout(() => autoAct(b.acting), 200);
    }
  }

  function castSkill(caster, skillId, target) {
    const b = state.battle;
    const skill = D.SKILLS[skillId];
    if (!skill) return;
    if (caster.cooldowns[skillId] > 0) return;
    logEntry('<strong>' + caster.name + '</strong> uses <strong>' + skill.name + '</strong>.');
    U.animateUnit(caster, 'lunge');
    // Capcom-style cast feedback: element-coded screen tint + audio variant.
    if (caster.element && U.capcomElemTint) U.capcomElemTint(caster.element);
    // Hyper-Combo-Finish framing for ultimate skills (high mul or explicit ult: true).
    const _isSuper = skill.ult === true || (skill.mul || 0) >= 2.5;
    if (_isSuper && U.capcomSuperZoom) U.capcomSuperZoom(caster);

    if (skill.type === 'attack' || skill.type === 'multihit') {
      const tgt = target || C.aliveEnemiesOf(b, caster)[0];
      if (tgt) {
        const hits = skill.hits || 1;
        for (let i = 0; i < hits; i++) {
          if (!C.isAlive(tgt)) break;
          const r = C.calcAttackDamage(caster, tgt, skill);
          C.applyDamage(tgt, r.dmg);
          U.showPopup(tgt, r.crit ? (U.fmt(r.dmg) + '!') : ('-' + U.fmt(r.dmg)), r.crit ? 'crit' : 'dmg');
          if (r.eMod > 1.0) U.showPopup(tgt, 'Strong!', 'strong', 20);
          else if (r.eMod < 1.0) U.showPopup(tgt, 'Weak', 'weak', 20);
          U.animateUnit(tgt, 'flash');
          if (U.elementBurst) U.elementBurst(tgt, caster.element);
          if (hits >= 2 && U.capcomComboTick) U.capcomComboTick();
          logEntry('&rarr; ' + tgt.name + ' took <strong>' + U.fmt(r.dmg) + '</strong>' +
            (r.crit ? ' (CRIT)' : '') + (r.eMod > 1 ? ' [strong]' : r.eMod < 1 ? ' [weak]' : '') + '.');
        }
        if (skill.onHit && C.isAlive(tgt)) {
          const chance = skill.onHit.chance != null ? skill.onHit.chance : 1.0;
          if (Math.random() < chance) C.applyStatus(tgt, Object.assign({}, skill.onHit), logEntry);
        }
      }
    } else if (skill.type === 'aoe') {
      const targets = C.aliveEnemiesOf(b, caster);
      for (const tgt of targets) {
        const r = C.calcAttackDamage(caster, tgt, skill);
        C.applyDamage(tgt, r.dmg);
        U.showPopup(tgt, r.crit ? (U.fmt(r.dmg) + '!') : ('-' + U.fmt(r.dmg)), r.crit ? 'crit' : 'dmg');
        if (r.eMod > 1.0) U.showPopup(tgt, 'Strong!', 'strong', 20);
        else if (r.eMod < 1.0) U.showPopup(tgt, 'Weak', 'weak', 20);
        U.animateUnit(tgt, 'flash');
        if (U.elementBurst) U.elementBurst(tgt, caster.element);
        logEntry('&rarr; ' + tgt.name + ' took <strong>' + U.fmt(r.dmg) + '</strong>' + (r.crit ? ' (CRIT)' : '') + '.');
        if (skill.onHit && C.isAlive(tgt)) {
          const chance = skill.onHit.chance != null ? skill.onHit.chance : 1.0;
          if (Math.random() < chance) C.applyStatus(tgt, Object.assign({}, skill.onHit), logEntry);
        }
      }
    } else if (skill.type === 'heal') {
      const targets = skill.target === 'allies' ? C.aliveAlliesOf(b, caster) : [target || caster];
      for (const tgt of targets) {
        const amount = Math.floor(tgt.maxHp * (skill.healPct || 0.3));
        const healed = C.applyHeal(tgt, amount);
        U.showPopup(tgt, '+' + U.fmt(healed), 'heal');
        logEntry('&rarr; ' + tgt.name + ' healed for <strong>' + U.fmt(healed) + '</strong>.');
      }
    } else if (skill.type === 'buff') {
      const targets = skill.target === 'allies' ? C.aliveAlliesOf(b, caster)
                     : skill.target === 'self' ? [caster]
                     : [target || caster];
      for (const tgt of targets) {
        if (skill.onCast) {
          if (skill.onCast.kind === 'shield') {
            const amt = Math.floor(tgt.maxHp * (skill.onCast.pct || 0.2));
            tgt.shield = Math.max(tgt.shield, amt);
            tgt.statuses.push({ kind: 'shield', stat: 'shield', amount: 0, turns: (skill.onCast.turns || 2) + 1, label: skill.onCast.label || 'SHIELD' });
            U.showPopup(tgt, 'Shield ' + U.fmt(amt), 'heal');
            logEntry('&rarr; ' + tgt.name + ' gains a shield of <strong>' + U.fmt(amt) + '</strong>.');
          } else {
            C.applyStatus(tgt, Object.assign({}, skill.onCast), logEntry);
          }
        }
      }
    }

    if (skill.onSelf) C.applyStatus(caster, Object.assign({}, skill.onSelf), logEntry);
    caster.cooldowns[skillId] = skill.cd || 0;
    C.tickEndOfTurn(caster);
    setTimeout(() => finishTurn(), C.ANIM_DELAY);
  }

  function onSkillPick(caster, skillId) {
    const b = state.battle;
    if (!b || !b.acting || b.acting.id !== caster.id) return;
    const sk = D.SKILLS[skillId];
    if (caster.cooldowns[skillId] > 0) return;
    if (sk.target === 'enemy' || sk.target === 'ally') {
      b.pendingSkill = skillId;
      U.renderBattle(app, ctx);
      return;
    }
    castSkill(caster, skillId, null);
  }

  function selectTarget(target) {
    const b = state.battle;
    if (!b || !b.pendingSkill || !b.acting) return;
    const skillId = b.pendingSkill;
    b.pendingSkill = null;
    castSkill(b.acting, skillId, target);
  }

  const ctx = {
    state, navigate, confirmTeam, onSkillPick, selectTarget, toggleAuto, resetSave,
    rebattle, persistNow, persist, pickStage,
  };

  function showBootFail(err) {
    try {
      const el = document.getElementById('boot-fail');
      const pre = document.getElementById('boot-fail-msg');
      const msg = (err && err.stack) ? err.stack : String(err);
      if (pre) pre.textContent = msg.substring(0, 1200);
      if (el) el.classList.add('show');
    } catch (e) {}
    console.error('Aetherbound init failed:', err);
  }

  function init() {
    try {
      navigate('title');
      // Check for daily login bonus; show modal after a brief render delay.
      const bonus = S.checkDailyLogin(state.player);
      if (bonus) {
        persistNow();
        setTimeout(function() {
          try { if (U.showDailyBonus) U.showDailyBonus(bonus, ctx); }
          catch (e) { console.warn('daily bonus modal failed (non-fatal):', e); }
        }, 650);
      }
    } catch (err) {
      showBootFail(err);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__GAME__ = {
    state, navigate, startBattle, castSkill, aiAct, autoAct, toggleAuto,
    D, A, C, U, S,
    calcAttackDamage: C.calcAttackDamage,
    setSelectedHeroIds: function(ids) { state.player.selectedHeroIds = ids.slice(); persist(); },
    confirmTeam, resetSave, rebattle, persist, persistNow, pickStage,
    grantVictoryRewards,
    grantHero: function(id) { var inst = S.grantHero(state.player, id); persistNow(); return inst; },
    grantAllHeroes: function() {
      D.HEROES.forEach(function(h) { if (!S.ownsHero(state.player, h.id)) S.grantHero(state.player, h.id); });
      persistNow();
    },
  };
})();
astSkill, aiAct, autoAct, toggleAuto,
    D, A, C, U, S,
    calcAttackDamage: C.calcAttackDamage,
    setSelectedHeroIds: function(ids) { state.player.selectedHeroIds = ids.slice(); persist(); },
    confirmTeam, resetSave, rebattle, persist, persistNow, pickStage,
    grantVictoryRewards,
    grantHero: function(id) { var inst = S.grantHero(state.player, id); persistNow(); return inst; },
    grantAllHeroes: function() {
      D.HEROES.forEach(function(h) { if (!S.ownsHero(state.player, h.id)) S.grantHero(state.player, h.id); });
      persistNow();
    },
  };
})();
