# LPC sprite drop-in folder

This is where animated character sprites live. The renderer in `sprites.js`
expects **Liberated Pixel Cup (LPC) format** PNGs:

- **Frame size:** 64x64
- **Sheet grid:** 13 columns x 21 rows (so 832x1344 pixels)
- **Rows we use** (0-indexed from top):
  - Row 2 — facing south (idle pose, col 0)
  - Row 10 — walk south (8-frame loop, cols 1..8)
  - Row 14 — slash south (6-frame attack, cols 0..5)
  - Row 20 — hurt (6-frame, cols 0..5)

If your sheet is a different size, you can override the layout per-sprite by
extending `LAYOUT` in `sprites.js`. Most LPC sheets follow the standard above.

## Where to grab compatible free sprites

All of these are CC-BY or CC0 and safe for commercial use (with attribution
for CC-BY — see `CREDITS.md` in the project root once we ship).

- **OpenGameArt LPC pack** (base + extensions):
  https://opengameart.org/content/lpc-collection
  Search: "Universal LPC sprite sheet character generator"
- **Universal LPC Spritesheet Character Generator** — pick parts, export 64x64
  PNG sheet directly: https://sanderfrenken.github.io/Universal-LPC-Spritesheet-Character-Generator/
- **LPC creature pack** (goblins, wolves, undead, etc.):
  https://opengameart.org/content/lpc-monsters
- **LPC women / men / clothing variants**:
  https://opengameart.org/art-search-advanced?keys=LPC

## How to add a sprite to a character

1. Drop the PNG in this folder as `<character_id>.png`. Hero IDs:
   `ember_knight`, `dawn_cleric`, `shade_stalker`, `frost_warden`,
   `tempest_blade`, `verdant_oracle`, `dusk_assassin`, `hearth_guard`,
   `stormcaller`, `abyss_warlock`, `sunward_paladin`, `gale_archer`,
   `tide_summoner`, `ash_berserker`, `silverleaf_druid`, `voidblade_wraith`.
   Enemy IDs: `goblin_brawler`, `goblin_shaman`, `goblin_chief`,
   `forest_wolf`, `alpha_wolf`, `skeleton_marauder`, `lich_acolyte`.

2. Open `sprites.js` and uncomment (or add) the matching line in `SPRITE_MAP`:
   ```js
   const SPRITE_MAP = {
     'ember_knight': 'assets/sprites/ember_knight.png',
     // ...
   };
   ```

3. Reload the game. The sprite will:
   - **Idle:** breathe in a subtle bob.
   - **Attack:** play windup + slash frames when the unit acts.
   - **Hurt:** play the hurt-row frames when damaged.
   - **Die:** fade + rotate when killed.

Characters with no entry in `SPRITE_MAP` continue to use the procedural SVG
portraits — nothing breaks during the rollout.

## Attribution

Every sprite from OpenGameArt has a license + author note on its page. Keep a
running list of attributions in the project root `CREDITS.md` before going
public. LPC base set is CC-BY-SA 3.0 + GPL 3.0 + OGA-BY 3.0.
