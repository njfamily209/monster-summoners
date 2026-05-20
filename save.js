/* ===========================================================
   Aetherbound — save / load (versioned localStorage)
   Exposed on window.GAME_SAVE
   Owner: Backend
   =========================================================== */
(function () {
  'use strict';
  const D = window.GAME_DATA;
  if (!D) { console.error('GAME_SAVE: GAME_DATA missing'); return; }

  const SAVE_VERSION = 1;
  const KEY = 'aetherbound.save.v1';
  const STARTER_PACK_SIZE = 3;
  const STARTER_CRYSTALS = 1500;
  const STARTER_SCROLLS  = 10;

  // ----- Level system -----
  const MAX_LEVEL = 30;
  function xpToNextLevel(level) { return 100 + (level - 1) * 40; }
  function getHeroLevel(state, heroId) {
    const insts = (state.ownedInstances || []).filter(i => i.id === heroId);
    if (!insts.length) return 1;
    return insts.reduce((max, i) => Math.max(max, i.level || 1), 1);
  }
  function addHeroXp(state, heroId, xp) {
    const insts = (state.ownedInstances || []).filter(i => i.id === heroId);
    if (!insts.length) return null;
    const inst = insts.reduce((best, i) => ((i.level || 1) > (best.level || 1) ? i : best));
    if (!inst.xp) inst.xp = 0;
    inst.xp += xp;
    const oldLevel = inst.level || 1;
    while ((inst.level || 1) < MAX_LEVEL) {
      const needed = xpToNextLevel(inst.level || 1);
      if (inst.xp >= needed) {
        inst.xp -= needed;
        inst.level = (inst.level || 1) + 1;
      } else break;
    }
    const newLevel = inst.level || 1;
    return newLevel > oldLevel ? { heroId, oldLevel, newLevel } : null;
  }

  function makeInstanceId() {
    return 'i_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }
  function makeInstance(heroId) {
    const t = D.heroById(heroId);
    if (!t) { console.warn('makeInstance: unknown hero ' + heroId); return null; }
    return {
      instanceId: makeInstanceId(),
      id: heroId, level: 1, xp: 0,
      stars: t.stars, acquired: Date.now(),
    };
  }
  function pickStarters(rng) {
    const r = rng || Math.random;
    const pool = D.heroesByStars(3).map(h => h.id).slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, STARTER_PACK_SIZE);
  }
  function defaultState(opts) {
    const starterIds = (opts && opts.starterIds) || pickStarters(opts && opts.rng);
    return {
      version: SAVE_VERSION,
      crystals: STARTER_CRYSTALS,
      scrolls: STARTER_SCROLLS,
      pityCount: 0,
      totalSummons: 0,
      ownedInstances: starterIds.map(makeInstance).filter(Boolean),
      selectedHeroIds: [],
      autoBattle: false,
      rosterSort: 'rarity',
      vaultSort: 'rarity',
      vaultFilter: { element: 'all', role: 'all', owned: 'all' },
      stagesCleared: [],
      lastLoginDate: null, loginStreak: 0,
      winStreak: 0, bestStreak: 0,
      runeInventory: [],
      heroRunes: {},
      dailyQuests: null,
      createdAt: Date.now(),
    };
  }
  function migrate(data) {
    if (!data || typeof data !== 'object') return null;
    const baseline = {
      version: SAVE_VERSION, crystals: 0, scrolls: 0,
      pityCount: 0, totalSummons: 0,
      ownedInstances: [], selectedHeroIds: [],
      autoBattle: false, rosterSort: 'rarity', vaultSort: 'rarity',
      vaultFilter: { element: 'all', role: 'all', owned: 'all' },
      stagesCleared: [],
      lastLoginDate: null, loginStreak: 0,
      winStreak: 0, bestStreak: 0,
      runeInventory: [], heroRunes: {},
      dailyQuests: null,
      createdAt: Date.now(),
    };
    const merged = Object.assign({}, baseline, data);
    if (!Array.isArray(merged.ownedInstances)) merged.ownedInstances = [];
    if (!Array.isArray(merged.selectedHeroIds)) merged.selectedHeroIds = [];
    if (!Array.isArray(merged.stagesCleared)) merged.stagesCleared = [];
    if (typeof merged.crystals !== 'number' || !isFinite(merged.crystals)) merged.crystals = 0;
    if (typeof merged.scrolls !== 'number' || !isFinite(merged.scrolls)) merged.scrolls = 0;
    if (typeof merged.pityCount !== 'number') merged.pityCount = 0;
    if (typeof merged.totalSummons !== 'number') merged.totalSummons = 0;
    if (typeof merged.autoBattle !== 'boolean') merged.autoBattle = false;
    if (typeof merged.rosterSort !== 'string') merged.rosterSort = 'rarity';
    if (typeof merged.vaultSort !== 'string') merged.vaultSort = 'rarity';
    if (!merged.vaultFilter || typeof merged.vaultFilter !== 'object') {
      merged.vaultFilter = { element: 'all', role: 'all', owned: 'all' };
    }
    if (typeof merged.loginStreak !== 'number') merged.loginStreak = 0;
    if (typeof merged.winStreak !== 'number') merged.winStreak = 0;
    if (typeof merged.bestStreak !== 'number') merged.bestStreak = 0;
    if (merged.lastLoginDate !== null && typeof merged.lastLoginDate !== 'string') merged.lastLoginDate = null;
    if (!Array.isArray(merged.runeInventory)) merged.runeInventory = [];
    if (!merged.heroRunes || typeof merged.heroRunes !== 'object') merged.heroRunes = {};
    // dailyQuests: null is valid (will be seeded on first access)
    if (merged.dailyQuests !== null && typeof merged.dailyQuests !== 'object') merged.dailyQuests = null;
    // Drop references to heroes that no longer exist in data (e.g. after a
    // balance pass renames or removes a hero). Prevents downstream null
    // dereferences when ascending, equipping runes, or building a team.
    merged.ownedInstances = merged.ownedInstances.filter(i => i && D.heroById(i.id));
    merged.selectedHeroIds = merged.selectedHeroIds.filter(id => D.heroById(id));
    if (merged.heroRunes && typeof merged.heroRunes === 'object') {
      for (const heroId of Object.keys(merged.heroRunes)) {
        if (!D.heroById(heroId)) delete merged.heroRunes[heroId];
      }
    }
    merged.version = SAVE_VERSION;
    return merged;
  }
  function storage() {
    try { return (typeof localStorage !== 'undefined') ? localStorage : null; }
    catch (e) { return null; }
  }
  function load() {
    const s = storage(); if (!s) return null;
    try {
      const raw = s.getItem(KEY);
      if (!raw) return null;
      return migrate(JSON.parse(raw));
    } catch (e) { console.warn('GAME_SAVE.load failed:', e); return null; }
  }
  function save(state) {
    const s = storage(); if (!s) return false;
    try { s.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { console.warn('GAME_SAVE.save failed:', e); return false; }
  }
  function clear() {
    const s = storage(); if (!s) return;
    try { s.removeItem(KEY); } catch (e) {}
  }
  function loadOrInit(opts) {
    const existing = load();
    if (existing) return existing;
    const fresh = defaultState(opts);
    save(fresh);
    return fresh;
  }
  function grantHero(state, heroId) {
    const inst = makeInstance(heroId);
    if (!inst) return null;
    state.ownedInstances.push(inst);
    return inst;
  }
  function ownsHero(state, heroId) {
    return state.ownedInstances.some(i => i.id === heroId);
  }
  function uniqueOwnedHeroIds(state) {
    const seen = new Set();
    state.ownedInstances.forEach(i => seen.add(i.id));
    return Array.from(seen);
  }
  function findInstance(state, instanceId) {
    return state.ownedInstances.find(i => i.instanceId === instanceId) || null;
  }
  function addCrystals(state, n) {
    if (typeof n !== 'number' || !isFinite(n)) return;
    if (typeof state.crystals !== 'number' || !isFinite(state.crystals)) state.crystals = 0;
    state.crystals = Math.max(0, state.crystals + n);
  }
  function addScrolls(state, n) {
    if (typeof n !== 'number' || !isFinite(n)) return;
    if (typeof state.scrolls !== 'number' || !isFinite(state.scrolls)) state.scrolls = 0;
    state.scrolls = Math.max(0, state.scrolls + n);
  }

  // ----- Ascension -----
  const MAX_STARS = 6;
  const ASCEND_COST = 3;
  function getHeroStars(state, heroId) {
    const insts = (state.ownedInstances || []).filter(i => i.id === heroId);
    if (!insts.length) return null;
    return insts.reduce((max, i) => Math.max(max, i.stars || 1), 1);
  }
  function canAscend(state, heroId) {
    const insts = (state.ownedInstances || []).filter(i => i.id === heroId);
    if (insts.length < ASCEND_COST) return false;
    const maxStars = insts.reduce((m, i) => Math.max(m, i.stars || 1), 1);
    return maxStars < MAX_STARS;
  }
  function ascendHero(state, heroId) {
    if (!canAscend(state, heroId)) return null;
    const insts = (state.ownedInstances || []).filter(i => i.id === heroId);
    insts.sort((a, b) => ((b.stars||1) - (a.stars||1)) || ((b.level||1) - (a.level||1)));
    const main = insts[0];
    const fodder = insts.slice(-(ASCEND_COST - 1));
    fodder.forEach(function(inst) {
      const idx = state.ownedInstances.indexOf(inst);
      if (idx >= 0) state.ownedInstances.splice(idx, 1);
    });
    const oldStars = main.stars || 1;
    main.stars = oldStars + 1;
    return { heroId: heroId, oldStars: oldStars, newStars: main.stars };
  }

  // ----- Rune system -----
  const RUNE_TYPES    = D.RUNE_TYPES;
  const RUNE_SLOT_STATS = D.RUNE_SLOT_STATS;
  const RUNE_SUB_STATS  = D.RUNE_SUB_STATS;
  const RUNE_SLOTS = 6;

  function makeRuneId() {
    return 'rn_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  const RUNE_MAIN_PCT = { 1:[0.04,0.06], 2:[0.06,0.09], 3:[0.08,0.12], 4:[0.12,0.16], 5:[0.16,0.22] };
  const RUNE_SUB_PCT  = { 1:[0.02,0.03], 2:[0.03,0.04], 3:[0.04,0.06], 4:[0.06,0.09], 5:[0.09,0.13] };

  function generateRune(tier, opts) {
    const rng = (opts && opts.rng) || Math.random;
    const starTable = [
      [1,1,1,2,2],
      [1,2,2,2,3],
      [2,2,3,3,3],
      [2,3,3,3,4],
      [3,3,4,4,5],
      [3,4,4,5,5],
    ];
    const table = starTable[Math.min(6, Math.max(1, tier)) - 1];
    const stars = table[Math.floor(rng() * table.length)];
    const typeKeys = Object.keys(RUNE_TYPES);
    const type = typeKeys[Math.floor(rng() * typeKeys.length)];
    const slot = Math.floor(rng() * RUNE_SLOTS) + 1;
    const slotStats = RUNE_SLOT_STATS[slot];
    const mainStat = slotStats[Math.floor(rng() * slotStats.length)];
    const loHi = RUNE_MAIN_PCT[stars];
    const mainPct = parseFloat((loHi[0] + rng() * (loHi[1] - loHi[0])).toFixed(3));
    const numSubs = stars >= 3 ? 2 : 1;
    const subPool = RUNE_SUB_STATS.filter(s => s !== mainStat);
    const subStats = [];
    const used = new Set([mainStat]);
    for (let i = 0; i < numSubs; i++) {
      const avail = subPool.filter(s => !used.has(s));
      if (!avail.length) break;
      const s = avail[Math.floor(rng() * avail.length)];
      used.add(s);
      const sLoHi = RUNE_SUB_PCT[stars];
      subStats.push({ stat: s, pct: parseFloat((sLoHi[0] + rng() * (sLoHi[1] - sLoHi[0])).toFixed(3)) });
    }
    return { runeId: makeRuneId(), type, slot, stars, mainStat, mainPct, subStats, acquiredAt: Date.now() };
  }

  function ensureHeroRuneSlots(state, heroId) {
    if (!state.heroRunes) state.heroRunes = {};
    if (!state.heroRunes[heroId]) state.heroRunes[heroId] = new Array(RUNE_SLOTS).fill(null);
    while (state.heroRunes[heroId].length < RUNE_SLOTS) state.heroRunes[heroId].push(null);
  }

  function getEquippedRunes(state, heroId) {
    ensureHeroRuneSlots(state, heroId);
    return state.heroRunes[heroId].map(rid =>
      rid ? (state.runeInventory || []).find(r => r.runeId === rid) || null : null
    );
  }

  function equipRune(state, heroId, runeId) {
    const rune = (state.runeInventory || []).find(r => r.runeId === runeId);
    if (!rune) return null;
    // Defensive: a corrupted rune (e.g., from an old save before slot existed)
    // could have slot === undefined / NaN / out-of-range, which would index a
    // bogus property on the slot array and silently break unequip later.
    // Reject those rather than corrupt heroRunes state.
    const rawSlot = rune.slot;
    if (typeof rawSlot !== 'number' || !isFinite(rawSlot) ||
        rawSlot < 1 || rawSlot > RUNE_SLOTS) {
      return null;
    }
    // Remove from any other hero's slot first so a rune can only be equipped once.
    if (state.heroRunes) {
      for (const otherId of Object.keys(state.heroRunes)) {
        if (otherId === heroId) continue;
        state.heroRunes[otherId] = state.heroRunes[otherId].map(rid => rid === runeId ? null : rid);
      }
    }
    ensureHeroRuneSlots(state, heroId);
    const slotIdx = rawSlot - 1;
    const displaced = state.heroRunes[heroId][slotIdx];
    state.heroRunes[heroId][slotIdx] = runeId;
    return displaced;
  }

  function unequipRune(state, heroId, slotIdx) {
    ensureHeroRuneSlots(state, heroId);
    const rid = state.heroRunes[heroId][slotIdx] || null;
    state.heroRunes[heroId][slotIdx] = null;
    return rid;
  }

  function getHeroRuneBoosts(state, heroId) {
    const result = { atk: 0, def: 0, hp: 0, spd: 0, critRate: 0, critDmg: 0 };
    const equipped = getEquippedRunes(state, heroId).filter(Boolean);
    for (const r of equipped) {
      if (result[r.mainStat] !== undefined) result[r.mainStat] += r.mainPct;
      for (const sub of (r.subStats || [])) {
        if (result[sub.stat] !== undefined) result[sub.stat] += sub.pct;
      }
    }
    const typeCounts = {};
    for (const r of equipped) typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
    for (const typeId of Object.keys(typeCounts)) {
      const count = typeCounts[typeId];
      const rt = RUNE_TYPES[typeId];
      if (!rt) continue;
      if (rt.set4 && count >= 4) {
        if (result[rt.set4.stat] !== undefined) result[rt.set4.stat] += rt.set4.pct;
        if (rt.set2 && rt.set2.stat !== rt.set4.stat && result[rt.set2.stat] !== undefined)
          result[rt.set2.stat] += rt.set2.pct;
      } else if (count >= 2 && rt.set2) {
        if (result[rt.set2.stat] !== undefined) result[rt.set2.stat] += rt.set2.pct;
      }
    }
    return result;
  }

  function grantRune(state, rune) {
    if (!state.runeInventory) state.runeInventory = [];
    state.runeInventory.push(rune);
  }

  function deleteRune(state, runeId) {
    if (!state.runeInventory) return;
    state.runeInventory = state.runeInventory.filter(r => r.runeId !== runeId);
    if (state.heroRunes) {
      for (const heroId of Object.keys(state.heroRunes)) {
        state.heroRunes[heroId] = state.heroRunes[heroId].map(rid => rid === runeId ? null : rid);
      }
    }
  }

  // ----- Daily login bonus -----
  function getTodayStr() {
    const d = new Date();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mo + '-' + dy;
  }
  function checkDailyLogin(state) {
    const today = getTodayStr();
    if (state.lastLoginDate === today) return null;
    const prev = new Date();
    prev.setDate(prev.getDate() - 1);
    const pmo = String(prev.getMonth() + 1).padStart(2, '0');
    const pdy = String(prev.getDate()).padStart(2, '0');
    const yStr = prev.getFullYear() + '-' + pmo + '-' + pdy;
    if (state.lastLoginDate === yStr) {
      state.loginStreak = (state.loginStreak || 0) + 1;
    } else {
      state.loginStreak = 1;
    }
    state.lastLoginDate = today;
    const streak = state.loginStreak;
    const crystalBonus = 150 + Math.min(streak - 1, 7) * 25;
    const scrollBonus = (streak % 7 === 0) ? 3 : (streak % 3 === 0) ? 1 : 0;
    addCrystals(state, crystalBonus);
    if (scrollBonus > 0) addScrolls(state, scrollBonus);
    return { crystals: crystalBonus, scrolls: scrollBonus, streak: streak };
  }

  // ----- Win / loss streak -----
  function recordWin(state) {
    state.winStreak  = (state.winStreak  || 0) + 1;
    state.bestStreak = Math.max(state.bestStreak || 0, state.winStreak);
  }
  function recordDefeat(state) {
    state.winStreak = 0;
  }

  // ----- Stage progression -----
  function isStageCleared(state, stageId) {
    return Array.isArray(state.stagesCleared) && state.stagesCleared.includes(stageId);
  }
  function markStageCleared(state, stageId) {
    if (!Array.isArray(state.stagesCleared)) state.stagesCleared = [];
    if (!state.stagesCleared.includes(stageId)) state.stagesCleared.push(stageId);
  }
  function isStageUnlocked(state, stage) {
    if (!stage) return false;
    if (stage.tier <= 1) return true;
    const prevTierStages = D.stagesByTier(stage.tier - 1);
    if (!prevTierStages.length) return true;
    return prevTierStages.some(s => isStageCleared(state, s.id));
  }

  // ----- Daily Quest system -----
  // 8 quest definitions; 3 are picked each day via date-seeded shuffle.
  const DAILY_QUEST_DEFS = [
    { id: 'win2',    type: 'win',    target: 2,  label: 'Win 2 Battles',      reward: { crystals: 80  } },
    { id: 'win5',    type: 'win',    target: 5,  label: 'Win 5 Battles',      reward: { crystals: 200 } },
    { id: 'win10',   type: 'win',    target: 10, label: 'Win 10 Battles',     reward: { crystals: 400, scrolls: 1 } },
    { id: 'summon1', type: 'summon', target: 1,  label: 'Perform 1 Summon',   reward: { crystals: 60  } },
    { id: 'summon5', type: 'summon', target: 5,  label: 'Perform 5 Summons',  reward: { crystals: 150, scrolls: 1 } },
    { id: 'rune1',   type: 'rune',   target: 1,  label: 'Equip 1 Rune',       reward: { crystals: 50  } },
    { id: 'rune3',   type: 'rune',   target: 3,  label: 'Equip 3 Runes',      reward: { crystals: 130 } },
    { id: 'rune6',   type: 'rune',   target: 6,  label: 'Equip 6 Runes',      reward: { crystals: 250, scrolls: 1 } },
  ];
  // DAILY_QUEST_COUNT: number of quests shown per day.
  const DAILY_QUEST_COUNT = 3;

  // Deterministic shuffle of DAILY_QUEST_DEFS based on date string.
  // Uses a simple integer hash as LCG seed; guarantees same 3 quests all day.
  function pickDailyQuests(dateStr) {
    // Hash the date string to a seed integer.
    let seed = 0;
    for (let i = 0; i < dateStr.length; i++) {
      seed = (seed * 31 + dateStr.charCodeAt(i)) >>> 0;
    }
    // LCG: x = (a*x + c) mod m  (Numerical Recipes parameters)
    function lcgNext() {
      seed = ((seed * 1664525 + 1013904223) >>> 0);
      return seed;
    }
    const pool = DAILY_QUEST_DEFS.slice();
    // Fisher-Yates with LCG
    for (let i = pool.length - 1; i > 0; i--) {
      const j = lcgNext() % (i + 1);
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return pool.slice(0, DAILY_QUEST_COUNT).map(def => ({
      defId: def.id, progress: 0, claimed: false
    }));
  }

  // Ensure state.dailyQuests is fresh for today; reset if date changed.
  function ensureDailyQuests(state) {
    const today = getTodayStr();
    if (state.dailyQuests && state.dailyQuests.date === today) return state.dailyQuests;
    state.dailyQuests = { date: today, quests: pickDailyQuests(today) };
    return state.dailyQuests;
  }

  // Returns the live quests array for today (with def merged in for convenience).
  function getDailyQuests(state) {
    const dq = ensureDailyQuests(state);
    return dq.quests.map(q => {
      const def = DAILY_QUEST_DEFS.find(d => d.id === q.defId) || {};
      return Object.assign({}, def, q);
    });
  }

  // Increment progress on all quests matching `type` that are not yet complete.
  // Returns array of { defId, newProgress, completed } for any quests that changed.
  function progressQuest(state, type, amount) {
    const dq = ensureDailyQuests(state);
    const changed = [];
    for (const q of dq.quests) {
      if (q.claimed) continue;
      const def = DAILY_QUEST_DEFS.find(d => d.id === q.defId);
      if (!def || def.type !== type) continue;
      if (q.progress >= def.target) continue;
      q.progress = Math.min(def.target, q.progress + (amount || 1));
      changed.push({ defId: q.defId, newProgress: q.progress, completed: q.progress >= def.target });
    }
    return changed;
  }

  // Claim the reward for quest at index `questIdx` if it is complete and unclaimed.
  // Returns the reward object, or null if not claimable.
  function claimQuestReward(state, questIdx) {
    const dq = ensureDailyQuests(state);
    const q = dq.quests[questIdx];
    if (!q) return null;
    const def = DAILY_QUEST_DEFS.find(d => d.id === q.defId);
    if (!def) return null;
    if (q.claimed) return null;
    if (q.progress < def.target) return null;
    q.claimed = true;
    const reward = def.reward || {};
    if (reward.crystals) addCrystals(state, reward.crystals);
    if (reward.scrolls) addScrolls(state, reward.scrolls);
    return reward;
  }

  window.GAME_SAVE = {
    SAVE_VERSION, KEY, STARTER_PACK_SIZE,
    STARTER_CRYSTALS, STARTER_SCROLLS,
    MAX_LEVEL, xpToNextLevel, getHeroLevel, addHeroXp,
    makeInstanceId, makeInstance, pickStarters,
    defaultState, migrate, load, save, clear, loadOrInit,
    grantHero, ownsHero, uniqueOwnedHeroIds, findInstance,
    addCrystals, addScrolls,
    isStageCleared, markStageCleared, isStageUnlocked,
    MAX_STARS, ASCEND_COST, getHeroStars, canAscend, ascendHero,
    getTodayStr, checkDailyLogin, recordWin, recordDefeat,
    RUNE_SLOTS, generateRune, grantRune, deleteRune,
    equipRune, unequipRune, getEquippedRunes, getHeroRuneBoosts,
    DAILY_QUEST_DEFS, DAILY_QUEST_COUNT,
    pickDailyQuests, ensureDailyQuests, getDailyQuests,
    progressQuest, claimQuestReward,
  };
})();
