// Auto-push watcher for Game Design.
// Watches the project folder; when files change, waits for a quiet period,
// then runs: git add . && git commit && git push.
//
// Start with: auto-push.bat  (or: node auto-push.js)
// Stop with:  Ctrl+C

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DEBOUNCE_MS = 15000;            // wait 15s of quiet before pushing
const COOLDOWN_MS = 3000;             // min gap between consecutive pushes

// Anything matching this regex is ignored (matches .gitignore intent)
const IGNORE = /(^|[\\\/])(\.git|node_modules|downloadedart|\.claude|tests[\\\/]coverage)([\\\/]|$)/;

// Files we generate ourselves — don't trigger on them
const SELF = new Set(['auto-push.log']);

let timer = null;
let lastPush = 0;
let pushing = false;

function ts() {
  return new Date().toLocaleTimeString();
}

function log(msg) {
  const line = `[${ts()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(path.join(ROOT, 'auto-push.log'), line + '\n'); } catch (_) {}
}

function run(cmd) {
  try {
    return { ok: true, out: execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim() };
  } catch (e) {
    const err = (e.stderr && e.stderr.toString()) || e.message;
    return { ok: false, out: err.trim() };
  }
}

function pushNow() {
  if (pushing) return;
  if (Date.now() - lastPush < COOLDOWN_MS) {
    timer = setTimeout(pushNow, COOLDOWN_MS);
    return;
  }
  pushing = true;
  timer = null;

  try {
    const status = run('git status --porcelain');
    if (!status.ok) { log('git status failed: ' + status.out); return; }
    if (!status.out) { log('No changes to push.'); return; }

    const files = status.out.split('\n').filter(Boolean);
    log(`Changes detected (${files.length} file${files.length === 1 ? '' : 's'}). Committing...`);

    const add = run('git add .');
    if (!add.ok) { log('git add failed: ' + add.out); return; }

    const isoTs = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const commit = run(`git commit -m "Auto-update ${isoTs}"`);
    if (!commit.ok) {
      if (/nothing to commit/i.test(commit.out)) {
        log('Nothing to commit after add (probably ignored files).');
      } else {
        log('git commit failed: ' + commit.out);
      }
      return;
    }

    log('Pushing to GitHub...');
    const push = run('git push');
    if (!push.ok) { log('git push failed: ' + push.out); return; }

    lastPush = Date.now();
    log('Pushed successfully. (Pages will redeploy in ~30s)');
  } finally {
    pushing = false;
  }
}

function schedule(reason) {
  if (timer) clearTimeout(timer);
  log(`Change: ${reason} - will push in ${DEBOUNCE_MS / 1000}s if no more changes.`);
  timer = setTimeout(pushNow, DEBOUNCE_MS);
}

// Sanity checks
if (!fs.existsSync(path.join(ROOT, '.git'))) {
  console.error('ERROR: No .git folder found. Run setup-github.bat first.');
  process.exit(1);
}

log('Auto-push watcher started.');
log('Project: ' + ROOT);
log(`Debounce: ${DEBOUNCE_MS}ms. Press Ctrl+C to stop.`);

try {
  fs.watch(ROOT, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    const norm = filename.replace(/\\/g, '/');
    if (IGNORE.test(norm)) return;
    const base = path.basename(norm);
    if (SELF.has(base)) return;
    schedule(norm);
  });
} catch (e) {
  console.error('fs.watch failed:', e.message);
  console.error('On Windows this usually means the folder is on a network drive. Try a local drive.');
  process.exit(1);
}

// Graceful shutdown
process.on('SIGINT', () => {
  log('Stopping watcher. Bye.');
  process.exit(0);
});
