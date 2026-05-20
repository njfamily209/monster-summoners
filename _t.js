const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = '/sessions/quirky-intelligent-maxwell/mnt/Game Design';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const errors = [];
const logs = [];
const vc = new VirtualConsole();
vc.on('error', (e) => errors.push('ERR: ' + (e && e.stack ? e.stack : String(e))));
vc.on('warn',  (m) => logs.push('WARN: ' + m));
vc.on('log',   (m) => logs.push('LOG: ' + m));
vc.on('info',  (m) => logs.push('INFO: ' + m));
vc.on('jsdomError', (e) => {
  let line = 'JSDOM: ' + (e && e.message ? e.message : String(e));
  if (e && e.detail) line += '\n  detail: ' + (e.detail.stack || String(e.detail));
  errors.push(line);
});

const dom = new JSDOM(html, {
  url: 'file://' + ROOT + '/index.html',
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
});

dom.window.addEventListener('error', (e) => {
  errors.push('window.error: ' + e.message + ' at ' + e.filename + ':' + e.lineno);
});

setTimeout(() => {
  const win = dom.window;
  console.log('--- ERRORS ---');
  console.log(errors.length ? errors.join('\n') : '(none)');
  console.log('\n--- LOGS ---');
  console.log(logs.join('\n') || '(none)');
  console.log('\n--- key globals ---');
  for (const g of ['GAME_DATA','GAME_ART','GAME_SPRITES','GAME_SAVE','GAME_SUMMON','GAME_AUDIO','GAME_COMBAT','GAME_UI','__GAME__']) {
    console.log(`  window.${g}: ${typeof win[g]}`);
  }
  if (typeof win.__GAME__ === 'object') {
    console.log('\n--- __GAME__ state ---');
    console.log('  screen: ' + win.__GAME__.state.screen);
    console.log('  player.gold/crystals/scrolls: ' + win.__GAME__.state.player.gold + '/' + win.__GAME__.state.player.crystals + '/' + win.__GAME__.state.player.scrolls);
    console.log('  hero count: ' + (win.__GAME__.state.player.heroes ? win.__GAME__.state.player.heroes.length : '?'));
  }
  console.log('\n--- #app exists/empty? ---');
  const app = win.document.getElementById('app');
  console.log('  app present: ' + !!app);
  console.log('  app innerHTML length: ' + (app ? app.innerHTML.length : 0));
  console.log('  app first 200 chars: ' + (app ? app.innerHTML.substring(0, 200) : '(none)'));

  // Look for buttons/clickable elements on the title screen
  const buttons = win.document.querySelectorAll('button');
  console.log('\n--- buttons rendered: ' + buttons.length);
  buttons.forEach((b, i) => { if (i < 12) console.log(`  [${i}] "${b.textContent.trim().substring(0, 50)}" class="${b.className}"`); });

  process.exit(0);
}, 3500);
