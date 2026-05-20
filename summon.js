/* ===========================================================
   Aetherbound — summon system (M2.1)
   Exposed on window.GAME_SUMMON
   =========================================================== */
(function () {
  'use strict';
  const D = window.GAME_DATA;
  const S = window.GAME_SAVE;
  if (!D || !S) { console.error('GAME_SUMMON: deps missing'); return; }

  // ----- Config -----
  const COST_SINGLE_CRYSTALS = 300;
  const COST_TEN_CRYSTALS = 2700;
  const COST_SINGLE_SCROLL  = 1;
  const PITY_THRESHOLD = 50;
  const RATE = { 5: 0.05, 4: 0.20, 3: 0.75 };
  // 10-pull bonus: if no 4★+ rolled in first 9, the 10th is guaranteed 4★ or 5★
  // with the same relative ratio (5★ chance among 4★+ = 0.05 / 0.25 = 0.20).
  const TEN_BONUS_FIVE_CHANCE = 0.20;

  function rollRarity(rng) {
    const r = rng();
    if (r < RATE[5]) return 5;
    if (r < RATE[5] + RATE[4]) return 4;
    return 3;
  }

  function pickHeroByRarity(stars, rng) {
    const pool = D.heroesByStars(stars);
    if (!pool.length) {
      // Defensive: if a tier is empty (shouldn't happen with current roster),
      // fall back down through 4 → 3 so a pull always produces something.
      if (stars > 3) return pickHeroByRarity(stars - 1, rng);
      return D.HEROES[0];
    }
    return pool[Math.floor(rng() * pool.length)];
  }

  // ----- Affordability + charge -----
  function canAffordSingleCrystals(state) { return state.crystals >= COST_SINGLE_CRYSTALS; }
  function canAffordSingleScroll(state)  { return state.scrolls  >= COST_SINGLE_SCROLL;  }
  function canAffordTen(state)           { return state.crystals >= COST_TEN_CRYSTALS;   }

  function chargeSingle(state, currency) {
    if (currency === 'scroll') {
      if (!canAffordSingleScroll(state)) return false;
      state.scrolls -= COST_SINGLE_SCROLL;
      return true;
    }
    if (!canAffordSingleCrystals(state)) return false;
    state.crystals -= COST_SINGLE_CRYSTALS;
    return true;
  }
  function chargeTen(state) {
    if (!canAffordTen(state)) return false;
    state.crystals -= COST_TEN_CRYSTALS;
    return true;
  }

  // ----- Pull execution -----
  // Returns: { hero, instance, rarity, isNew, pityActivated, guaranteedFourPlus }
  // Does NOT deduct currency — callers must chargeSingle/chargeTen first.
  function performPull(state, opts) {
    const rng = (opts && opts.rng) || Math.random;
    let rarity = rollRarity(rng);
    let pityActivated = false;

    // Pity: 50 pulls without a 5★ guarantees one. We check BEFORE the new
    // pull increments the counter — so the 50th pull itself triggers pity.
    if (state.pityCount >= PITY_THRESHOLD - 1 && rarity < 5) {
      rarity = 5;
      pityActivated = true;
    }

    const hero = pickHeroByRarity(rarity, rng);
    const isNew = !S.ownsHero(state, hero.id);
    const instance = S.grantHero(state, hero.id);

    state.totalSummons = (state.totalSummons || 0) + 1;
    if (rarity === 5) state.pityCount = 0;
    else state.pityCount = (state.pityCount || 0) + 1;

    return { hero, instance, rarity, isNew, pityActivated };
  }

  // 10-pull: rolls 10 pulls; if none of the first 9 are 4★+, the 10th is
  // upgraded to a guaranteed 4★ (5% chance to be 5★ within the bonus).
  function performTenPull(state, opts) {
    const rng = (opts && opts.rng) || Math.random;
    const results = [];
    let anyFourPlus = false;
    for (let i = 0; i < 9; i++) {
      const r = performPull(state, { rng });
      if (r.rarity >= 4) anyFourPlus = true;
      results.push(r);
    }
    if (!anyFourPlus) {
      // Hand-built bonus pull: upgrade to 4★+ and route through grant/pity.
      let rarity = rng() < TEN_BONUS_FIVE_CHANCE ? 5 : 4;
      // Pity still wins over the bonus.
      let pityActivated = false;
      if (state.pityCount >= PITY_THRESHOLD - 1 && rarity < 5) {
        rarity = 5;
        pityActivated = true;
      }
      const hero = pickHeroByRarity(rarity, rng);
      const isNew = !S.ownsHero(state, hero.id);
      const instance = S.grantHero(state, hero.id);
      state.totalSummons += 1;
      if (rarity === 5) state.pityCount = 0;
      else state.pityCount += 1;
      results.push({ hero, instance, rarity, isNew, pityActivated, guaranteedFourPlus: true });
    } else {
      results.push(performPull(state, { rng }));
    }
    return results;
  }

  window.GAME_SUMMON = {
    COST_SINGLE_CRYSTALS, COST_TEN_CRYSTALS, COST_SINGLE_SCROLL,
    PITY_THRESHOLD, RATE, TEN_BONUS_FIVE_CHANCE,
    rollRarity, pickHeroByRarity,
    canAffordSingleCrystals, canAffordSingleScroll, canAffordTen,
    chargeSingle, chargeTen,
    performPull, performTenPull,
  };
})();
