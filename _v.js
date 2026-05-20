// Two-scenario verification.
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = '/sessions/quirky-intelligent-maxwell/mnt/Game Design';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function launch(label, mutator) {
  return new Promise((resolve) => {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('error', (e) => errors.push('ERR: ' + (e && e.stack ? e.stack : String(e))));
    vc.on('jsdomError', (e) => { /* swallow css parse */ });

    const dom = new JSDOM(html, {
      url: 'file://' + ROOT + '/index.html',
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      virtualConsole: vc,
    });

    // Inject corruption before scripts run, if requested
    if (mutator) {
      dom.window.addEventListener('DOMContentLoaded', () => {});
      // localStorage exists on jsdom window; corrupt before save.js loads — but scripts already run.
      // Instead, set a flag we observe later.
    }

    setTimeout(() => {
      const win = dom.window;
      const app = win.document.getElementById('app');
      const bootFail = win.document.getElementById('boot-fail');
      const bootFailShown = bootFail && bootFail.classList.contains('show');
      const initOk = !!win.__GAME__;
      const screen = initOk ? win.__GAME__.state.screen : null;
      const buttons = win.document.querySelectorAll('button').length;
      console.log(`[${label}]`);
      console.log(`  init succeeded:    ${initOk}`);
      console.log(`  state.screen:      ${screen}`);
      console.log(`  buttons rendered:  ${buttons}`);
      console.log(`  boot-fail visible: ${bootFailShown}`);
      console.log(`  #app html length:  ${app ? app.innerHTML.length : 0}`);
      console.log(`  errors:            ${errors.length}`);
      if (errors.length) console.log('    ' + errors.join('\n    '));
      console.log('');
      resolve();
    }, 3500);
  });
}

(async () => {
  console.log('=== Scenario 1: normal launch ===');
  await launch('normal');

  // Scenario 2: simulate a corrupt save by pre-populating localStorage via JSDOM.
  // We do this by intercepting the page with a stored bad save.
  console.log('=== Scenario 2: forced uncaught error mid-init ===');
  // Read the html, inject a script BEFORE game.js that monkey-patches navigate to throw.
  const corruptHtml = html.replace(
    '<script src="game.js?v=20260520f"></script>',
    `<script>
       // Sabotage: corrupt UI so init() throws inside navigate->renderTitle
       window.addEventListener('DOMContentLoaded', function() {
         // Wait for modules to load, then corrupt before init runs.
         var orig = window.GAME_UI && window.GAME_UI.renderTitle;
         if (orig) window.GAME_UI.renderTitle = function() { throw new Error('Simulated render crash'); };
       });
     </script>
     <script src="game.js?v=20260520f"></script>`
  );

  const errors2 = [];
  const vc = new VirtualConsole();
  vc.on('error', (e) => errors2.push(String(e)));
  vc.on('jsdomError', () => {});
  const dom = new JSDOM(corruptHtml, {
    url: 'file://' + ROOT + '/index.html',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });

  setTimeout(() => {
    const win = dom.window;
    const bootFail = win.document.getElementById('boot-fail');
    const shown = bootFail && bootFail.classList.contains('show');
    const msg = win.document.getElementById('boot-fail-msg');
    console.log('[forced-crash]');
    console.log('  boot-fail visible:    ' + shown);
    console.log('  message starts with:  ' + (msg ? msg.textContent.substring(0, 80) : '(none)'));
    console.log('  reset button present: ' + !!win.document.querySelector('#boot-fail button'));
    console.log('  console errors:       ' + errors2.length);
    process.exit(0);
  }, 3500);
})();
