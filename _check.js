const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = '/sessions/quirky-intelligent-maxwell/mnt/Game Design';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('error', (e) => errors.push('ERR: ' + (e && e.stack ? e.stack : String(e))));
vc.on('jsdomError', (e) => {
  if (e && e.message && e.message.includes('CSS')) return;
  errors.push('JSDOM: ' + (e.message || String(e)) + (e.detail ? '\n  ' + (e.detail.stack || e.detail).toString().substring(0,300) : ''));
});
const dom = new JSDOM(html, {
  url: 'file://' + ROOT + '/index.html',
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
});
dom.window.addEventListener('error', (e) => errors.push('window.error: ' + e.message + ' at ' + e.filename + ':' + e.lineno));
setTimeout(() => {
  const win = dom.window;
  console.log('Globals: ' +
    ['GAME_DATA','GAME_ART','GAME_SPRITES','GAME_SAVE','GAME_SUMMON','GAME_AUDIO','GAME_COMBAT','GAME_UI','__GAME__']
    .map(k => k + '=' + (typeof win[k] === 'object' ? 'OK' : 'undef')).join(', '));
  const bf = win.document.getElementById('boot-fail');
  console.log('boot-fail visible: ' + (bf && bf.classList.contains('show')));
  const msg = win.document.getElementById('boot-fail-msg');
  console.log('boot-fail msg: ' + (msg ? msg.textContent.substring(0,200) : '(no msg el)'));
  console.log('errors caught: ' + errors.length);
  errors.forEach(e => console.log('  ' + e.substring(0, 200)));
  process.exit(0);
}, 5000);
