// Simulate browser-like loading of art.js
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('/sessions/quirky-intelligent-maxwell/mnt/Game Design/art.js', 'utf8');
const ctx = {
  window: {},
  document: {
    createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} }),
    createElementNS: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} }),
  },
  console: console,
};
ctx.self = ctx;
ctx.global = ctx;
try {
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'art.js' });
  console.log('art.js loaded OK. GAME_ART keys:', Object.keys(ctx.window.GAME_ART || {}).join(', '));
} catch (e) {
  console.log('art.js THREW:');
  console.log('  message:', e.message);
  console.log('  stack:', e.stack.split('\n').slice(0,5).join('\n'));
}
