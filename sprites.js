/* ===========================================================
   Aetherbound — LPC sprite-sheet renderer (drop-in)
   Owner: Frontend
   ----------------------------------------------------------
   Renders character portraits from "Liberated Pixel Cup" style
   sprite sheets (64x64 frames in a grid) with CSS-driven
   idle / attack / hurt animation. Falls back to the procedural
   SVG pack when no sprite is mapped for a given character id.

   To enable a sprite for any hero or enemy:
     1. Drop a PNG into  assets/sprites/<id>.png
     2. Add a line below in SPRITE_MAP, e.g.
          'ember_knight': 'assets/sprites/ember_knight.png',

   The renderer auto-handles idle bob, an attack lunge cue
   (driven by the `.windup` and `.lunge` classes on the parent
   `.unit`, already set by combat.js), and a hurt flash on
   damage (already set by ui.js).
   =========================================================== */
(function () {
  const A = window.GAME_ART;
  if (!A) { console.warn('sprites.js: GAME_ART not loaded; sprite pack disabled'); return; }

  // ---------- LPC universal sprite-sheet layout ----------
  // Standard LPC sheets are 13 columns × 21 rows of 64×64 frames.
  // Rows (0-indexed) we care about:
  //   2  — facing south (used as idle pose; col 0 = stand)
  //   10 — walk south (8-frame loop, cols 1..8) — used as idle "bob"
  //   14 — slash south (6-frame attack, cols 0..5) — used for attack
  //   20 — hurt (6-frame, cols 0..5) — used for damage taken
  // We expose these so CSS keyframes can step through them.
  const LAYOUT = {
    sheetCols: 13,
    sheetRows: 21,
    frameSize: 64,
    rows: { idle: 2, walk: 10, attack: 14, hurt: 20 },
  };

  // ---------- Sprite registry ----------
  // Empty by default — drop PNGs into assets/sprites/ and uncomment.
  // Hero ids: ember_knight, dawn_cleric, shade_stalker, frost_warden,
  //           tempest_blade, verdant_oracle, dusk_assassin, hearth_guard,
  //           stormcaller, abyss_warlock, sunward_paladin, gale_archer,
  //           tide_summoner, ash_berserker, silverleaf_druid, voidblade_wraith
  // Enemy ids: goblin_brawler, goblin_shaman, goblin_chief,
  //            forest_wolf, alpha_wolf, skeleton_marauder, lich_acolyte
  const SPRITE_MAP = {
    // 'ember_knight':    'assets/sprites/ember_knight.png',
    // 'dawn_cleric':     'assets/sprites/dawn_cleric.png',
    // 'goblin_brawler':  'assets/sprites/goblin_brawler.png',
    // ... etc.
  };

  // ---------- Public helpers ----------
  function getSpriteUrl(id) { return SPRITE_MAP[id] || null; }
  function hasSprite(id)    { return !!SPRITE_MAP[id]; }
  function registerSprite(id, url) {
    SPRITE_MAP[id] = url;
    // Bust the portrait cache so the next renderPortrait call uses the new sprite.
    if (A && typeof A.clearPortraitCache === 'function') A.clearPortraitCache('lpc', id);
  }
  function deleteSprite(id) {
    delete SPRITE_MAP[id];
    if (A && typeof A.clearPortraitCache === 'function') A.clearPortraitCache('lpc', id);
  }

  // Build the inline-style payload for a sprite portrait.
  // The frame-size CSS var lets the same class drive any sheet size if we
  // later mix LPC variants (32x32 chibi, 96x96 bossy, etc.).
  function spritePortraitHtml(monster) {
    const url = getSpriteUrl(monster.id);
    if (!url) return null;
    const fs = LAYOUT.frameSize;
    const sw = LAYOUT.sheetCols * fs;
    const sh = LAYOUT.sheetRows * fs;
    const idleY = -(LAYOUT.rows.idle * fs);
    const attackY = -(LAYOUT.rows.attack * fs);
    const hurtY = -(LAYOUT.rows.hurt * fs);
    const alt = (monster.name || monster.id || '').replace(/"/g, '&quot;');
    // The class hooks combat states (.unit.windup / .unit.lunge / .unit.hurt-flash)
    // via CSS sibling selectors. background-position uses CSS variables so
    // @keyframes can flip frame columns without inline-style churn.
    return (
      '<div class="lpc-sprite" data-sprite-id="' + monster.id + '"' +
      ' role="img" aria-label="' + alt + ' portrait"' +
      ' style="' +
        '--frame-size:' + fs + 'px;' +
        '--sheet-w:' + sw + 'px;' +
        '--sheet-h:' + sh + 'px;' +
        '--idle-y:' + idleY + 'px;' +
        '--attack-y:' + attackY + 'px;' +
        '--hurt-y:' + hurtY + 'px;' +
        'background-image:url(\'' + url + '\');' +
      '"></div>'
    );
  }

  // ---------- Register as a pack with art.js ----------
  // The 'lpc' pack returns a sprite when the id has one in SPRITE_MAP,
  // otherwise it delegates to the always-present 'procedural' pack so the
  // game never renders a blank slot mid-rollout.
  const procPack = A.getPack && A.getPack('procedural');
  A.registerPack('lpc', {
    renderPortrait(monster) {
      const sprite = spritePortraitHtml(monster);
      if (sprite) return sprite;
      // Fallback: procedural SVG (current art).
      if (procPack && typeof procPack.renderPortrait === 'function') {
        return procPack.renderPortrait(monster);
      }
      // Last-ditch: empty box so layout doesn't collapse.
      return '<div class="portrait-fallback" aria-label="' +
        (monster.name || '') + '"></div>';
    },
  });

  // Activate the LPC pack as the default. When no sprite is mapped the
  // lpc pack delegates to 'procedural', so heroes without sprites still render.
  if (A && typeof A.setPack === 'function') A.setPack('lpc');

  window.GAME_SPRITES = {
    LAYOUT, SPRITE_MAP,
    getSpriteUrl,
    hasSprite,
    registerSprite,
    deleteSprite,
  };
})();
