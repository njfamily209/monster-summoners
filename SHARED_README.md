# Shared File Rules — Aetherbound

This document is the contract between the **Backend**, **Frontend**, and **QA** roles. It defines who owns which files, how shared files are coordinated, and where to find what.

---

## File ownership map

| File | Owner | Purpose |
|---|---|---|
| `data.js` | Backend | Heroes, enemies, skills, stages, element wheel math. Pure data + lookup helpers. |
| `combat.js` | Backend | ATB ticking, damage formula, status effects, AI priority engine, `makeBattle`. |
| `save.js` | Backend | Versioned `localStorage` round-trip, default state, migrations, stage progression helpers. |
| `summon.js` | Backend | Gacha rates, pity, single/10-pull logic, currency charge. |
| `ui.js` | Frontend | All `render*` functions (screens), modals, reveal animations, role icons, sort selector. |
| `style.css` | Frontend | Every selector, every animation. Append-only via heredoc to avoid Edit truncation. |
| `index.html` | Frontend | Page shell + script ordering. Rarely modified. |
| `art.js` | Frontend | Procedural SVG portrait kinds + pack registry. |
| `tests/test_*.mjs` | QA | All milestone test suites. QA also writes their own helpers. |
| **`game.js`** | **SHARED** | Routing, state shape, combat orchestration, persistence glue. **Coordinate before edits.** |

---

## Coordination protocol for `game.js`

`game.js` is the only file where Backend and Frontend legitimately overlap (state + routing).

When editing `game.js`:

1. **Announce in the conversation** what you're about to change (e.g. "Frontend adding `vault` route").
2. **Check recent commits / history** on `game.js` — if it was modified in the last response, wait until that role acknowledges.
3. **Make the smallest possible edit.** If your change is substantial (>20 lines), do it as a full heredoc rewrite to avoid mid-file truncation that has historically broken this file.
4. **Backend edits** belong above the `const ctx = { ... }` declaration (state, persistence, combat).
5. **Frontend edits** belong to the `navigate()` route map and `ctx` exposure.
6. **QA never edits `game.js`.** QA reads only.

If a single feature needs both Backend + Frontend changes, the Backend changes land first and Frontend layers on top in the same response.

---

## Coordination protocol for tests

Tests are owned by QA, but Backend and Frontend can read them to understand expected behavior. **Only QA writes test files.**

When Backend or Frontend changes a behavior tested by an existing suite:

1. They flag the affected test in their handoff to QA.
2. QA updates the assertion (not the source) to match new intended behavior, OR rejects the change if it broke a true invariant.

---

## File size discipline

Two source files routinely brush against the platform's tool-edit truncation threshold:

- `ui.js` (currently ~43 KB)
- `style.css` (currently ~58 KB)

**Rule:** never use the small-edit tool on `ui.js` or `style.css`. Always rewrite the whole file via bash heredoc, or append-only via heredoc for CSS. Edits to small files (`save.js`, `summon.js`, `data.js`, `combat.js`, `game.js`) are fine, but **verify with `node -c <file>` after every edit** — truncation is silent.

If you see `Unexpected end of input` in the test output, the most likely cause is that the last Edit silently truncated the file. Rewrite via heredoc, don't try to patch the tail back on.

---

## Test command

From the `tests/` directory:

```bash
for t in test_m1.mjs test_m20.mjs test_m21.mjs test_m22.mjs test_m30.mjs; do
  node "$t"
done
```

Every test file ends with `process.exit(0)` on pass, `process.exit(1)` on fail. CI / agents should treat any non-zero exit as a regression.

---

## Save schema versioning

`save.js` exports `SAVE_VERSION` (currently `1`). Whenever Backend introduces a new persisted field:

1. Add to `defaultState()`.
2. Add to `migrate()` baseline.
3. Backfill safety check (`if (!Array.isArray(...))`, `typeof !== 'number'`, etc.).
4. **Do not bump `SAVE_VERSION` unless a field is renamed or has incompatible semantics.** Pure additions are forward-compatible.

If `SAVE_VERSION` is bumped, the migration chain must transform every prior version into the latest.

---

## Currency for dev testing

`save.js::STARTER_CRYSTALS = 9_999_999` and `STARTER_SCROLLS = 99`. **This is a dev override.** Before launch, drop both to:

- `STARTER_CRYSTALS = 1500`
- `STARTER_SCROLLS = 1`

The reward economy (200–500c per win × tier `rewardMul`, 15–33% scroll drop) is sized for those launch values.

---

## Stage progression model

- Stage tier N is unlocked when **any** tier (N-1) stage has been cleared.
- `state.stagesCleared` is the source of truth — a flat array of cleared stage IDs.
- `enemyMul` scales enemy stats; `rewardMul` scales victory crystals + scroll drop chance.
- Adding a new stage = a new entry in `data.js::STAGES` with a unique `id` and `tier`. No other code changes needed.

---

## Naming conventions

- Hero IDs: `snake_case` (`ember_knight`, `aurora_seraph`).
- Skill IDs: `camelCase` (`burningSlash`, `dawnsBlessing`).
- Stage IDs: `snake_case` (`goblin_camp_1`, `warchief_hall`).
- CSS classes: `kebab-case` (`roster-card`, `reveal-stage`).
- DOM IDs: `kebab-case` (`battle-log`, `skill-panel-mount`).

---

## Where to find things quickly

- **"How does damage work?"** → `combat.js::calcAttackDamage`
- **"How do I add a hero?"** → append to `data.js::HEROES`, ensure its `skills` IDs exist in `data.js::SKILLS`
- **"How do I add a stage?"** → append to `data.js::STAGES`, set `tier` / `enemyMul` / `rewardMul`
- **"How do I add a screen?"** → write `renderFoo` in `ui.js`, add `else if (screen === 'foo')` to `game.js::navigate`, add a button somewhere that calls `ctx.navigate('foo')`
- **"How are stages unlocked?"** → `save.js::isStageUnlocked` checks if any tier (N-1) stage is in `state.stagesCleared`
