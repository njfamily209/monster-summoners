# Art swap guide

The game ships with stylized procedural SVG portraits as the default. Three ways to override.

## 1. Per-monster image (simplest)

Edit `data.js` and add `src` to the monster's `art` object. The renderer uses it as an `<img>` and ignores the procedural fallback.

```js
{
  id: 'ember_knight', name: 'Ember Knight',
  art: { kind: 'warrior', accent: '#ffe2b3', src: 'art/ember_knight.png', alt: 'Ember Knight in full armor' },
  ...
}
```

Drop the image at `art/ember_knight.png` (or any path your `index.html` can resolve). Recommended specs: square aspect ratio, 256-512 px, transparent PNG or WebP.

## 2. Whole-pack swap

When you have a complete art set, register it as a pack and activate it:

```js
GAME_ART.registerPack('pixel', {
  renderPortrait: (monster) =>
    `<img class="portrait-img" src="pixel/${monster.id}.png" alt="${monster.name}"/>`
});
GAME_ART.setPack('pixel');
```

Per-monster `art.src` still wins over the pack, so you can ship a pack and override individual heroes with hero art.

## 3. Programmatic style (advanced)

A pack's `renderPortrait` can return any HTML/SVG string. You could fetch art from a CDN, run an AI generator at runtime, etc.

```js
GAME_ART.registerPack('cdn', {
  renderPortrait: (m) =>
    `<img class="portrait-img" src="https://cdn.example.com/heroes/${m.id}@2x.webp" alt="${m.name}"/>`
});
```

## API

- `GAME_ART.renderPortrait(monster)` -> HTML string
- `GAME_ART.registerPack(id, { renderPortrait })`
- `GAME_ART.setPack(id)`
- `GAME_ART.getCurrentPack()` / `GAME_ART.listPacks()`
