// Headless launch test for Aetherbound.
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = '/sessions/quirky-intelligent-maxwell/mnt/Game Design';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const errors = [];
const logs = [];
const vc = new VirtualConsole();
vc.on('error', (e) => errors.push('ERR: ' + (e && e.stack ? e.stack : e)));
vc.on('warn',  (m) => logs.push('WARN: ' + m));
vc.on('log',   (m) => logs.push('LOG: ' + m));
vc.on('jsdomError', (e) => errors.push('JSDOM: ' + (e && e.message ? e.message : e) + (e && e.detail ? '\n  detail: ' + (e.detail.stack || e.detail) : '')));

const dom = new JSDOM(html, {
  url: 'file://' + ROOT + '/index.html',
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
});

// Patch unhandled errors on window
dom.window.addEventListener('error', (e) => {
  errors.push('window.error: ' + e.message + ' at ' + e.filename + ':' + e.lineno + ':' + e.colno);
});

// Wait for scripts to load
setTimeout(() => {
  const appHtml = dom.window.document.getElementById('app')?.innerHTML || '<empty>';
  console.log('--- ERRORS ---');
  console.log(errors.length ? errors.join('\n') : '(none)');
  console.log('\n--- LOGS (last 20) ---');
  console.log(logs.slice(-20).join('\n') || '(none)');
  console.log('\n--- #app contents (first 500 chars) ---');
  console.log(appHtml.substring(0, 500));
  console.log('\n--- globals present ---');
  const globals = ['DATA', 'ART', 'SPRITES', 'SAVE', 'SUMMON', 'AUDIO', 'COMBAT', 'UI', 'GAME', 'Game', 'game'];
  for (const g of globals) {
    console.log(`  ${g}: ${typeof dom.window[g]}`);
  }
  process.exit(0);
}, 2500);
