# Aetherbound

A single-player fantasy summoning RPG, built as a web game. Collect heroes, master the element wheel, and rise through the Aether.

## Vision

Single-player gacha-style monster RPG inspired by Summoners War, RAID: Shadow Legends, AFK Arena, and Epic Seven, minus the PvP pressure. Plays in any browser, mobile-first, with persistent saves and an evergreen progression loop.

## Tech

Plain HTML / CSS / vanilla JavaScript. No build step, no server. State persists in localStorage. Art is stylized procedural SVG so the game stays under a few hundred KB total.

## Files

- index.html  shell, global SVG defs (glow filters)
- style.css  visual design system
- data.js  heroes, enemies, skills, stages, element wheel math
- art.js  parametric SVG portraits
- combat.js  ATB tick, damage math, status effects, AI selection
- ui.js  screen rendering, FX, popups
- game.js  state, screen routing, skill execution glue
- tests/  headless verification scripts

## Milestones

1. M1 (current)  combat engine, 6 starter heroes, 3 enemies, one polished battle, team-pick UI
2. M2  summon gacha screen, rarity reveal, 15+ heroes, collection vault, pity system
3. M3  world map, multiple dungeons, XP & evolution, energy/stamina
4. M4  runes (6-slot equipment), auto-battle, sub-stat rolls
5. M5  monetization layer (premium currency, IAP/ad stubs), daily quests, achievements
6. M6  awakening, time-limited events, story chapters

## Combat (M1)

- ATB-based turn order  each unit's bar fills proportional to SPD; first to 100% acts
- Element wheel  Fire-Wind-Water rock/paper/scissors; Light <-> Dark mutual advantage
- Skills  single-target, AOE, multi-hit, heal, buff/shield, debuff; each has its own cooldown
- Statuses  buffs/debuffs (atk/def/spd), stun, shield; tick at end of affected unit's turn
- Damage formula  ATK * skillMul * (1000 / (1000 + DEF * 4)) * elementMod * critRoll * variance

## Run locally

Open index.html in any modern browser. No server required.

## Goal

A monetizable, retention-heavy single-player RPG. Ad slots (rewarded video for free summons), IAP currency packs, and cosmetic unlocks are designed in from the start.
