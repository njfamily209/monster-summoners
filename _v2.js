const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = '/sessions/quirky-intelligent-maxwell/mnt/Game Design';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const errors = [];
const logs = [];
const vc = new VirtualConsole();
vc.on('error', (e) => errors.push('ERR: ' + (e && e.stack ? e.stack : String(e))));
vc.on('warn', (m) => logs.push('WARN: ' + m));
vc.on('log', (m) => logs.push('LOG: ' + m));
vc.on('jsdomError', (e) => {
  let line = 'JSDOM: ' + (e && e.message ? e.message : String(e));
  if (e && e.detail) line += '\n  detail: ' + (e.detail.stack || String(e.detail)).substring(0,400);
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
  console.log('--- ERRORS (' + errors.length + ') ---');
  errors.forEach(e => console.log(e));
  console.log('\n--- key globals ---');
  for (const g of ['GAME_DATA','GAME_ART','GAME_UI','__GAME__']) {
    console.log(`  window.${g}: ${typeof win[g]}`);
  }
  const app = win.document.getElementById('app');
  console.log('\n--- #app innerHTML length: ' + (app ? app.innerHTML.length : 0));
  const bf = win.document.getElementById('boot-fail');
  console.log('--- boot-fail present: ' + !!bf + ', class: "' + (bf ? bf.className : '') + '"');
  process.exit(0);
}, 5000);
