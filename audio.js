/* ===========================================================
   Aetherbound — synthesized sound effects (Web Audio API)
   Exposed on window.GAME_AUDIO
   Owner: Backend
   ---------------------------------------------------------- */
(function () {
  'use strict';

  const STORAGE_KEY = 'aetherbound.audio.muted';
  let _muted = false;
  try { _muted = (typeof localStorage !== 'undefined') && localStorage.getItem(STORAGE_KEY) === '1'; }
  catch (e) { _muted = false; }

  let _ctx = null;
  let _master = null;
  function getCtx() {
    if (_ctx) return _ctx;
    const AC = (typeof window !== 'undefined') &&
               (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try {
      _ctx = new AC();
      _master = _ctx.createGain();
      _master.gain.value = 0.5;
      _master.connect(_ctx.destination);
    } catch (e) { _ctx = null; }
    return _ctx;
  }

  function armResume() {
    if (typeof document === 'undefined') return;
    if (typeof document.addEventListener !== 'function') return;
    const wake = () => {
      const ctx = getCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      document.removeEventListener('pointerdown', wake);
      document.removeEventListener('keydown', wake);
      document.removeEventListener('touchstart', wake);
    };
    try {
      document.addEventListener('pointerdown', wake, { once: true });
      document.addEventListener('keydown', wake, { once: true });
      document.addEventListener('touchstart', wake, { once: true });
    } catch (e) {}
  }
  armResume();

  const THROTTLE_MS = 30;
  let _lastPlayedAt = 0;
  let _lastName = '';

  function blip(opts) {
    const ctx = getCtx(); if (!ctx) return;
    const type = opts.type || 'sine';
    const freq = opts.freq != null ? opts.freq : 440;
    const freqEnd = opts.freqEnd != null ? opts.freqEnd : null;
    const dur = opts.dur != null ? opts.dur : 0.1;
    const vol = opts.vol != null ? opts.vol : 0.3;
    const attack = opts.attack != null ? opts.attack : 0.005;
    const release = opts.release != null ? opts.release : dur * 0.4;
    const detune = opts.detune != null ? opts.detune : 0;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 0.01), t0 + dur);
    osc.detune.value = detune;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(_master);
    osc.start(t0);
    osc.stop(t0 + dur + release + 0.02);
  }

  function noise(opts) {
    const ctx = getCtx(); if (!ctx) return;
    const dur = opts.dur != null ? opts.dur : 0.12;
    const vol = opts.vol != null ? opts.vol : 0.25;
    const filterFreq = opts.filterFreq != null ? opts.filterFreq : 1500;
    const q = opts.q != null ? opts.q : 4;
    const lowpass = !!opts.lowpass;
    const t0 = ctx.currentTime;
    const samples = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = lowpass ? 'lowpass' : 'bandpass';
    filt.frequency.value = filterFreq;
    filt.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(gain).connect(_master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  function arp(notes, opts) {
    opts = opts || {};
    const type = opts.type || 'triangle';
    const stepDur = opts.stepDur != null ? opts.stepDur : 0.09;
    const vol = opts.vol != null ? opts.vol : 0.25;
    notes.forEach((freq, i) => {
      setTimeout(() => blip({ type: type, freq: freq, dur: stepDur * 1.6, vol: vol }), i * stepDur * 1000);
    });
  }

  const SOUNDS = {
    // ---- HITS — layered like Capcom: bass thud + mid slap + high sparkle ----
    hit_normal:  function () {
      blip({ type: 'square',   freq: 220, freqEnd: 140, dur: 0.08, vol: 0.22 });
      noise({ dur: 0.05, vol: 0.12, filterFreq: 2200, q: 1 });
    },
    hit_crit:    function () {
      // bass thud
      blip({ type: 'sine',     freq: 100, freqEnd: 50,  dur: 0.18, vol: 0.36 });
      // mid slap
      blip({ type: 'sawtooth', freq: 700, freqEnd: 220, dur: 0.14, vol: 0.28 });
      // high sparkle / metal click
      setTimeout(function () {
        noise({ dur: 0.12, vol: 0.22, filterFreq: 5200, q: 1.5 });
        blip({ type: 'triangle', freq: 1800, freqEnd: 2400, dur: 0.06, vol: 0.18 });
      }, 14);
    },
    hit_strong:  function () {
      // bass thud
      blip({ type: 'sine',     freq: 90,  freqEnd: 45,  dur: 0.22, vol: 0.34 });
      // mid slap
      blip({ type: 'sawtooth', freq: 180, freqEnd: 80,  dur: 0.20, vol: 0.30 });
      // dust noise
      noise({ dur: 0.16, vol: 0.18, filterFreq: 700, q: 1, lowpass: true });
    },
    hit_weak:    function () { blip({ type: 'triangle', freq: 600, freqEnd: 480, dur: 0.05, vol: 0.14 }); },

    // ---- SKILLS ----
    skill_cast:  function () {
      blip({ type: 'sine',     freq: 220, freqEnd: 660, dur: 0.30, vol: 0.22 });
      blip({ type: 'triangle', freq: 440, freqEnd: 880, dur: 0.30, vol: 0.16, detune: 8 });
    },
    skill_aoe:   function () {
      blip({ type: 'sawtooth', freq: 110, freqEnd: 55,  dur: 0.45, vol: 0.22 });
      noise({ dur: 0.40, vol: 0.18, filterFreq: 800, q: 0.8 });
    },
    // Kiai shout — a "HAH!" cry layered into skill casts.
    // Bandpassed noise gated by a sharp envelope, with a glide tone underneath.
    kiai:        function () {
      noise({ dur: 0.18, vol: 0.30, filterFreq: 1200, q: 4 });
      blip({ type: 'sawtooth', freq: 280, freqEnd: 180, dur: 0.18, vol: 0.18, detune: -12 });
    },

    heal:        function () {
      blip({ type: 'sine', freq: 880,  freqEnd: 1320, dur: 0.35, vol: 0.20 });
      setTimeout(function () { blip({ type: 'sine', freq: 1320, freqEnd: 1760, dur: 0.30, vol: 0.16 }); }, 80);
    },
    shield:      function () {
      blip({ type: 'triangle', freq: 200, freqEnd: 320, dur: 0.20, vol: 0.20 });
      noise({ dur: 0.10, vol: 0.10, filterFreq: 1200, q: 2 });
    },

    // ---- OUTCOMES ----
    unit_die:    function () {
      blip({ type: 'sawtooth', freq: 400, freqEnd: 60, dur: 0.45, vol: 0.30 });
      noise({ dur: 0.30, vol: 0.16, filterFreq: 400, q: 1, lowpass: true });
    },
    victory:     function () { arp([523.25, 659.25, 783.99, 1046.50], { type: 'triangle', stepDur: 0.12, vol: 0.28 }); },
    defeat:      function () { arp([440, 349.23, 261.63, 196],         { type: 'sawtooth', stepDur: 0.16, vol: 0.24 }); },

    // ---- UI ----
    summon_pop:  function () {
      blip({ type: 'sawtooth', freq: 200, freqEnd: 1500, dur: 0.08, vol: 0.26 });
      noise({ dur: 0.05, vol: 0.10, filterFreq: 3000, q: 0.6 });
    },
    button:      function () { blip({ type: 'square',   freq: 660, freqEnd: 880, dur: 0.04, vol: 0.14 }); },
    error:       function () {
      blip({ type: 'square',   freq: 180, freqEnd: 120, dur: 0.20, vol: 0.20 });
      blip({ type: 'square',   freq: 140, freqEnd: 100, dur: 0.20, vol: 0.18, detune: -8 });
    },

    // ---- CAPCOM-STYLE STAMPS ----
    // VS clash: two competing pure tones glide toward each other.
    vs_clash:    function () {
      blip({ type: 'sawtooth', freq: 200, freqEnd: 500, dur: 0.50, vol: 0.24 });
      blip({ type: 'sawtooth', freq: 800, freqEnd: 500, dur: 0.50, vol: 0.24, detune: 8 });
      noise({ dur: 0.30, vol: 0.16, filterFreq: 2000, q: 1 });
    },
    // FIGHT! announcer slam — deep bass impact + bright slap + reverb tail.
    fight_stamp: function () {
      blip({ type: 'sine',     freq: 80,  freqEnd: 40,  dur: 0.40, vol: 0.40 });
      blip({ type: 'sawtooth', freq: 300, freqEnd: 100, dur: 0.18, vol: 0.32 });
      setTimeout(function () { noise({ dur: 0.35, vol: 0.18, filterFreq: 600, q: 0.5, lowpass: true }); }, 30);
    },
    // K.O.! — heavier and lower than fight stamp, with rumble.
    ko_stamp:    function () {
      blip({ type: 'sine',     freq: 60,  freqEnd: 30,  dur: 0.65, vol: 0.42 });
      blip({ type: 'sawtooth', freq: 200, freqEnd: 60,  dur: 0.30, vol: 0.30 });
      noise({ dur: 0.55, vol: 0.22, filterFreq: 400, q: 0.6, lowpass: true });
    },
    // Generic slam used for menu transitions later.
    ui_slam:     function () {
      blip({ type: 'sine', freq: 120, freqEnd: 60, dur: 0.16, vol: 0.28 });
      noise({ dur: 0.06, vol: 0.10, filterFreq: 800, q: 1 });
    },

    // ---- ELEMENT-CODED SKILL CAST AUDIO (one per element) ----
    elem_fire:  function () {
      blip({ type: 'sawtooth', freq: 140, freqEnd: 60,  dur: 0.30, vol: 0.30 });
      noise({ dur: 0.28, vol: 0.20, filterFreq: 1800, q: 1.2 });
      setTimeout(function () { blip({ type: 'triangle', freq: 1200, freqEnd: 600, dur: 0.10, vol: 0.18 }); }, 30);
    },
    elem_water: function () {
      blip({ type: 'sine', freq: 880, freqEnd: 1760, dur: 0.22, vol: 0.22 });
      blip({ type: 'sine', freq: 660, freqEnd: 1320, dur: 0.30, vol: 0.18, detune: 6 });
      noise({ dur: 0.18, vol: 0.10, filterFreq: 4200, q: 2 });
    },
    elem_light: function () {
      blip({ type: 'triangle', freq: 1760, freqEnd: 2640, dur: 0.25, vol: 0.20 });
      blip({ type: 'sine',     freq: 2640, freqEnd: 3520, dur: 0.20, vol: 0.14 });
      noise({ dur: 0.12, vol: 0.10, filterFreq: 6000, q: 2 });
    },
    elem_dark:  function () {
      blip({ type: 'sawtooth', freq: 80, freqEnd: 40, dur: 0.45, vol: 0.30, detune: -10 });
      noise({ dur: 0.40, vol: 0.22, filterFreq: 300, q: 0.8, lowpass: true });
    },
    elem_wind:  function () {
      noise({ dur: 0.36, vol: 0.26, filterFreq: 2400, q: 0.6 });
      blip({ type: 'triangle', freq: 520, freqEnd: 1040, dur: 0.30, vol: 0.16 });
    },

    // ---- PARRY / BLOCK clang on shielded hits ----
    parry_clang: function () {
      blip({ type: 'square',   freq: 1800, freqEnd: 900,  dur: 0.10, vol: 0.30 });
      blip({ type: 'triangle', freq: 2400, freqEnd: 1600, dur: 0.14, vol: 0.22 });
      noise({ dur: 0.08, vol: 0.16, filterFreq: 5800, q: 3 });
    },

    // ---- MAGIC vs PHYSICAL hit variants (chime over the thud) ----
    hit_magic_normal: function () {
      blip({ type: 'sine', freq: 60,   freqEnd: 90,   dur: 0.18, vol: 0.28 });
      blip({ type: 'sine', freq: 1320, freqEnd: 1760, dur: 0.20, vol: 0.18 });
      blip({ type: 'triangle', freq: 880, freqEnd: 1320, dur: 0.16, vol: 0.14, detune: 6 });
    },
    hit_magic_crit: function () {
      blip({ type: 'sine', freq: 55,   freqEnd: 30,   dur: 0.30, vol: 0.36 });
      blip({ type: 'sine', freq: 1760, freqEnd: 2640, dur: 0.30, vol: 0.22 });
      blip({ type: 'triangle', freq: 2200, freqEnd: 3300, dur: 0.18, vol: 0.16, detune: 8 });
      setTimeout(function () { noise({ dur: 0.16, vol: 0.14, filterFreq: 6200, q: 2 }); }, 18);
    },
  };

  function play(name, opts) {
    if (_muted) return;
    const now = Date.now();
    if (name === _lastName && now - _lastPlayedAt < THROTTLE_MS) return;
    _lastPlayedAt = now;
    _lastName = name;
    const fn = SOUNDS[name];
    if (!fn) return;
    try {
      const ctx = getCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(function () {});
      fn();
    } catch (e) {}
  }

  function setMuted(v) {
    _muted = !!v;
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, _muted ? '1' : '0'); }
    catch (e) {}
  }
  function isMuted() { return _muted; }
  function listSounds() { return Object.keys(SOUNDS); }

  window.GAME_AUDIO = { play: play, setMuted: setMuted, isMuted: isMuted, listSounds: listSounds };
})();
