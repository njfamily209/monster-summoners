/* ===========================================================
   Aetherbound — UI rendering (screens, battle, FX)
   Exposed on window.GAME_UI
   Owner: Frontend
   =========================================================== */
(function () {
  'use strict';
  const D = window.GAME_DATA;
  const A = window.GAME_ART;
  const C = window.GAME_COMBAT;
  if (!D || !A || !C) { console.error('UI deps missing'); return; }

  function fmt(n) {
    if (n == null || !isFinite(n)) return '0';
    if (n < 1000) return Math.floor(n).toString();
    if (n < 1e6) return (n / 1000).toFixed(n < 1e4 ? 1 : 0) + 'K';
    return (n / 1e6).toFixed(1) + 'M';
  }
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    if (children) (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      if (typeof c === 'string') el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    });
    return el;
  }
  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
  }

  function roleClass(roleOrUnit) {
    const role = (typeof roleOrUnit === 'string' ? roleOrUnit : (roleOrUnit && roleOrUnit.role)) || '';
    const r = role.toLowerCase();
    if (r === 'tank') return 'tank';
    if (r === 'healer' || r === 'sage') return 'healer';
    return 'dps';
  }
  const ROLE_ICON_SVG = {
    tank:
      '<svg class="role-icon-svg" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 2 L21 5 V11 C21 16.5 17 20.5 12 22 C7 20.5 3 16.5 3 11 V5 Z" fill="currentColor" stroke="rgba(0,0,0,0.5)" stroke-width="1" stroke-linejoin="round"/>' +
      '<path d="M3.5 10 H20.5" stroke="rgba(255,255,255,0.55)" stroke-width="1.4"/>' +
      '<path d="M12 4 L19 6 V11 C19 15 16 18 12 19.5 C8 18 5 15 5 11 V6 Z" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="0.8"/>' +
      '</svg>',
    healer:
      '<svg class="role-icon-svg" viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="10" fill="white" stroke="rgba(0,0,0,0.4)" stroke-width="1"/>' +
      '<path d="M10 4 H14 V10 H20 V14 H14 V20 H10 V14 H4 V10 H10 Z" fill="#e63946" stroke="rgba(0,0,0,0.3)" stroke-width="0.6" stroke-linejoin="round"/>' +
      '</svg>',
    dps:
      '<svg class="role-icon-svg" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M11 2 L13 2 L13 16 L11 16 Z" fill="#d6dae8" stroke="rgba(0,0,0,0.55)" stroke-width="0.7"/>' +
      '<path d="M11 2 L13 2 L12 4 Z" fill="#ffffff"/>' +
      '<path d="M7 16 H17 V18 H7 Z" fill="#caa75e" stroke="rgba(0,0,0,0.5)" stroke-width="0.7"/>' +
      '<path d="M11 18 H13 V21 H11 Z" fill="#5a3a1a" stroke="rgba(0,0,0,0.5)" stroke-width="0.5"/>' +
      '<circle cx="12" cy="22" r="1.2" fill="#caa75e" stroke="rgba(0,0,0,0.5)" stroke-width="0.4"/>' +
      '</svg>',
  };
  function roleIconEl(unit) {
    const cls = roleClass(unit);
    const span = h('span', { class: 'role-icon role-' + cls, title: (unit && unit.role) || cls });
    span.innerHTML = ROLE_ICON_SVG[cls];
    return span;
  }

  const SORT_OPTIONS = [
    { key: 'rarity', label: 'Rarity ★',  cmp: (a, b) => (b.stars - a.stars) || a.name.localeCompare(b.name) },
    { key: 'hp',     label: 'Max HP',    cmp: (a, b) => b.base.hp - a.base.hp },
    { key: 'atk',    label: 'ATK',       cmp: (a, b) => b.base.atk - a.base.atk },
    { key: 'def',    label: 'DEF',       cmp: (a, b) => b.base.def - a.base.def },
    { key: 'spd',    label: 'SPD',       cmp: (a, b) => b.base.spd - a.base.spd },
    { key: 'name',   label: 'Name (A→Z)',cmp: (a, b) => a.name.localeCompare(b.name) },
    { key: 'element',label: 'Element',   cmp: (a, b) => a.element.localeCompare(b.element) || (b.stars - a.stars) },
    { key: 'role',   label: 'Role',      cmp: (a, b) => a.role.localeCompare(b.role) || (b.stars - a.stars) },
  ];
  function sortHeroes(heroes, sortKey) {
    const opt = SORT_OPTIONS.find(o => o.key === sortKey) || SORT_OPTIONS[0];
    return heroes.slice().sort(opt.cmp);
  }
  function renderSortSelector(currentSort, onChange) {
    const wrap = h('div', { class: 'sort-selector' });
    wrap.appendChild(h('span', { class: 'sort-label' }, 'Sort:'));
    const sel = h('select', { class: 'sort-select', onchange: e => onChange(e.target.value) });
    SORT_OPTIONS.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.key; o.textContent = opt.label;
      if (opt.key === currentSort) o.selected = true;
      sel.appendChild(o);
    });
    wrap.appendChild(sel);
    return wrap;
  }

  function renderCurrencyBar(ctx) {
    const p = ctx.state && ctx.state.player;
    if (!p) return null;
    const bar = h('div', { class: 'currency-bar' });
    bar.appendChild(h('span', { class: 'cur cur-crystal', title: 'Crystals' }, [
      h('span', { class: 'cur-icon', 'aria-hidden': 'true' }, '◆'),
      h('span', { class: 'cur-val' }, fmt(p.crystals)),
    ]));
    bar.appendChild(h('span', { class: 'cur cur-scroll', title: 'Summon Scrolls' }, [
      h('span', { class: 'cur-icon', 'aria-hidden': 'true' }, '✦'),
      h('span', { class: 'cur-val' }, fmt(p.scrolls)),
    ]));
    const owned = (p.ownedInstances || []).length;
    bar.appendChild(h('span', { class: 'cur cur-roster', title: 'Heroes owned' }, [
      h('span', { class: 'cur-icon', 'aria-hidden': 'true' }, '⚑'),
      h('span', { class: 'cur-val' }, String(owned)),
    ]));
    return bar;
  }

  function backButton(ctx, label, screen) {
    return h('button', { class: 'btn-nav btn-back',
      onclick: () => ctx.navigate(screen || 'title') }, '← ' + (label || 'Back'));
  }

  function renderTitle(app, ctx) {
    app.innerHTML = '';
    // Top HUD bar — settings cluster on the left, currencies on the right.
    const topBar = h('div', { class: 'title-topbar' });
    const settingsCluster = h('div', { class: 'title-settings-cluster' });
    const AU_title = window.GAME_AUDIO;
    if (AU_title && typeof AU_title.setMuted === 'function') {
      const muteBtn = h('button', {
        class: 'icon-btn mute-toggle' + (AU_title.isMuted() ? ' muted' : ''),
        title: AU_title.isMuted() ? 'Unmute sounds' : 'Mute sounds',
        'aria-label': AU_title.isMuted() ? 'Unmute' : 'Mute',
        onclick: function() {
          AU_title.setMuted(!AU_title.isMuted());
          if (!AU_title.isMuted()) AU_title.play('button');
          renderTitle(app, ctx);
        },
      }, AU_title.isMuted() ? '🔇 Muted' : '🔊 Sound');
      settingsCluster.appendChild(muteBtn);
    }
    const resetBtn = h('button', {
      class: 'icon-btn reset-icon',
      title: 'Reset save',
      'aria-label': 'Reset save',
      onclick: () => {
        showConfirm(
          'Reset Save?',
          'This will erase all heroes, currency, and progress. Cannot be undone.',
          'Reset Everything',
          function () { ctx.resetSave && ctx.resetSave(); toast('Save reset.'); }
        );
      }
    }, '↻');
    settingsCluster.appendChild(resetBtn);
    topBar.appendChild(settingsCluster);
    const cb = renderCurrencyBar(ctx);
    if (cb) topBar.appendChild(cb);
    app.appendChild(topBar);

    const wrap = h('div', { class: 'title title-v2' });

    // Hero crest — glowing emblem above the title.
    const art = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    art.setAttribute('viewBox', '0 0 200 200');
    art.setAttribute('class', 'hero-art');
    art.innerHTML = '<defs><radialGradient id="title-glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#ffd86a" stop-opacity="0.5"/><stop offset="100%" stop-color="#ffd86a" stop-opacity="0"/></radialGradient></defs><circle cx="100" cy="100" r="90" fill="url(#title-glow)"/><g transform="translate(50,60)"><path d="M50 0 L62 18 L80 30 L62 42 L50 60 L38 42 L20 30 L38 18 Z" fill="#f5c46c"/><path d="M50 12 L58 22 L70 30 L58 38 L50 48 L42 38 L30 30 L42 22 Z" fill="#fff2c2"/></g><g transform="translate(100,170)"><path d="M-30 0 L0 -18 L30 0 L0 6 Z" fill="#5aa9ff" opacity="0.6"/></g>';
    wrap.appendChild(art);

    wrap.appendChild(h('h1', { class: 'title-heading' }, 'Aetherbound'));
    wrap.appendChild(h('div', { class: 'tagline' }, 'A single-player fantasy summoning RPG'));

    // Progress strip — only renders when player has data
    const p = ctx.state && ctx.state.player;
    if (p) {
      const D_local = window.GAME_DATA;
      const ownedCount  = new Set((p.ownedInstances || []).map(i => i.id)).size;
      const totalHeroes = D_local ? D_local.HEROES.length : '?';
      const clearedN    = (p.stagesCleared || []).length;
      const totalStages = D_local ? D_local.STAGES.length : '?';
      const bestStreak  = p.bestStreak  || 0;
      const loginStreak = p.loginStreak || 0;
      const strip = h('div', { class: 'title-stats-strip' });
      function statChip(label, val) {
        const chip = h('div', { class: 'title-stat-chip' });
        chip.appendChild(h('span', { class: 'title-stat-val' }, String(val)));
        chip.appendChild(h('span', { class: 'title-stat-key' }, label));
        return chip;
      }
      strip.appendChild(statChip('Stages', clearedN + ' / ' + totalStages));
      strip.appendChild(statChip('Heroes', ownedCount + ' / ' + totalHeroes));
      if (bestStreak  >= 2) strip.appendChild(statChip('Best Streak', bestStreak + ' 🔥'));
      if (loginStreak >= 2) strip.appendChild(statChip('Login Streak', loginStreak + 'd'));
      wrap.appendChild(strip);
    }

    // PRIMARY CTA — large, glowing, the obvious next step.
    const primaryRow = h('div', { class: 'title-primary-row' });
    primaryRow.appendChild(h('button', {
      class: 'btn btn-primary-cta',
      onclick: () => {
        if (AU_title) AU_title.play('button');
        ctx.navigate('stage-select');
      }
    }, [
      h('span', { class: 'cta-icon', 'aria-hidden': 'true' }, '⚔'),
      h('span', { class: 'cta-text' }, 'Start Battle'),
    ]));
    wrap.appendChild(primaryRow);

    // SECONDARY ACTIONS — grid of compact tiles for non-primary destinations.
    const grid = h('div', { class: 'title-action-grid' });
    function gridBtn(emoji, label, screen, extraClass, badge) {
      const btn = h('button', {
        class: 'btn-secondary btn-grid' + (extraClass ? ' ' + extraClass : ''),
        onclick: () => {
          if (AU_title) AU_title.play('button');
          ctx.navigate(screen);
        }
      }, [
        h('span', { class: 'grid-emoji', 'aria-hidden': 'true' }, emoji),
        h('span', { class: 'grid-label' }, label),
      ]);
      if (badge) {
        const dot = h('span', { class: 'grid-notif-dot', 'aria-label': badge, title: badge });
        btn.appendChild(dot);
      }
      return btn;
    }

    // Check for claimable quests to show a notification badge.
    let questNotifBadge = null;
    const _S_title = window.GAME_SAVE;
    if (p && _S_title && _S_title.getDailyQuests) {
      try {
        const qs = _S_title.getDailyQuests(p);
        const claimable = qs.filter(q => !q.claimed && q.progress >= q.target).length;
        if (claimable > 0) questNotifBadge = claimable + ' quest' + (claimable > 1 ? 's' : '') + ' ready!';
      } catch (e) {}
    }

    grid.appendChild(gridBtn('✨', 'Summon',  'summon'));
    grid.appendChild(gridBtn('⚑', 'Vault',   'vault'));
    grid.appendChild(gridBtn('🛒', 'Shop',    'shop'));
    grid.appendChild(gridBtn('💎', 'Runes',   'runes', 'btn-runes'));
    grid.appendChild(gridBtn('📋', 'Quests',  'quests', 'btn-quests', questNotifBadge));
    wrap.appendChild(grid);

    app.appendChild(wrap);
  }

  function renderStageSelect(app, ctx) {
    app.innerHTML = '';
    const cb = renderCurrencyBar(ctx);
    if (cb) app.appendChild(cb);
    const header = h('div', { class: 'screen-header' });
    const titleWrap = h('div', null);
    titleWrap.appendChild(h('h2', null, 'Select Stage'));
    const clearedN = (ctx.state.player.stagesCleared || []).length;
    titleWrap.appendChild(h('div', { class: 'subtitle' },
      `${clearedN} / ${D.STAGES.length} stages cleared · Harder stages drop better rewards`));
    header.appendChild(titleWrap);
    header.appendChild(backButton(ctx));
    app.appendChild(header);

    const grid = h('div', { class: 'stage-grid' });
    // Mark the first unlocked-but-uncleared stage as recommended so players know where to go next.
    const recommendedStageId = (D.STAGES.find(s =>
      window.GAME_SAVE.isStageUnlocked(ctx.state.player, s) &&
      !window.GAME_SAVE.isStageCleared(ctx.state.player, s.id)
    ) || {}).id || null;
    D.STAGES.forEach(stage => {
      const unlocked = window.GAME_SAVE.isStageUnlocked(ctx.state.player, stage);
      const cleared = window.GAME_SAVE.isStageCleared(ctx.state.player, stage.id);
      const isRecommended = stage.id === recommendedStageId;
      const cardCls = ['stage-card', 'tier-' + stage.tier];
      if (!unlocked) cardCls.push('locked');
      if (cleared) cardCls.push('cleared');
      if (isRecommended) cardCls.push('recommended');
      const card = h('div', { class: cardCls.join(' '), role: 'button', tabindex: '0',
        'aria-disabled': unlocked ? 'false' : 'true',
        onclick: () => unlocked && ctx.pickStage(stage.id),
        onkeydown: e => { if ((e.key === 'Enter' || e.key === ' ') && unlocked) { e.preventDefault(); ctx.pickStage(stage.id); } },
      });
      if (cleared) card.appendChild(h('div', { class: 'cleared-badge', title: 'Cleared' }, '✓'));
      if (!unlocked) card.appendChild(h('div', { class: 'locked-badge' }, '🔒'));
      if (isRecommended) card.appendChild(h('div', { class: 'next-stage-badge' }, '▶ Suggested'));
      const tierRow = h('div', { class: 'tier-row' });
      const maxTierDots = Math.max(6, stage.tier);
      for (let i = 1; i <= maxTierDots; i++) {
        tierRow.appendChild(h('span', { class: 'tier-dot' + (i <= stage.tier ? ' filled' : '') }));
      }
      card.appendChild(tierRow);
      card.appendChild(h('div', { class: 'stage-name' }, stage.name));
      card.appendChild(h('div', { class: 'stage-desc' }, stage.desc));
      const enemyRow = h('div', { class: 'stage-enemy-row' });
      stage.enemyIds.forEach(eid => {
        const e = D.enemyById(eid); if (!e) return;
        const wrap = h('div', { class: 'mini-portrait-wrap' });
        wrap.appendChild(h('div', { class: 'mini-portrait', html: A.renderPortrait(e), title: e.name }));
        const elInfo = D.ELEMENTS[e.element];
        wrap.appendChild(h('div', {
          class: 'mini-el-dot el-' + e.element,
          title: (elInfo ? elInfo.name : e.element),
        }));
        enemyRow.appendChild(wrap);
      });
      card.appendChild(enemyRow);
      const reward = h('div', { class: 'stage-reward' });
      const baseLow = Math.floor(200 * stage.rewardMul);
      const baseHigh = Math.floor(500 * stage.rewardMul);
      reward.innerHTML = `<span class="cur cur-crystal small"><span class="cur-icon">◆</span><span class="cur-val">${baseLow}–${baseHigh}</span></span>`;
      const scrollPct = Math.min(50, Math.round(15 * stage.rewardMul));
      reward.innerHTML += ` <span class="cur cur-scroll small"><span class="cur-icon">✦</span><span class="cur-val">${scrollPct}%</span></span>`;
      card.appendChild(reward);
      grid.appendChild(card);
    });
    app.appendChild(grid);
  }

  function buildRosterCard(hero, opts) {
    opts = opts || {};
    const dupeCount = opts.dupeCount || 0;
    const owned = opts.owned !== false;
    const selected = opts.selected || false;
    const onClick = opts.onClick;
    const card = h('div', {
      class: `roster-card rarity-${hero.stars}` + (owned ? '' : ' unowned') + (selected ? ' selected' : ''),
      role: 'button', tabindex: '0',
      'aria-pressed': selected ? 'true' : 'false',
      'aria-label': `${hero.name}, ${hero.stars} stars, ${hero.role}, ${D.ELEMENTS[hero.element].name}` + (owned ? '' : ', not owned'),
      onclick: onClick,
      onkeydown: e => { if ((e.key === 'Enter' || e.key === ' ') && onClick) { e.preventDefault(); onClick(e); } },
    });
    card.appendChild(h('div', { class: 'selected-badge' }, '✓'));
    if (dupeCount > 1) card.appendChild(h('div', { class: 'dupe-badge', title: `${dupeCount} owned` }, `×${dupeCount}`));
    if (!owned) card.appendChild(h('div', { class: 'locked-badge', title: 'Not owned' }, '🔒'));
    card.appendChild(h('div', { class: 'portrait', html: A.renderPortrait(hero) }));
    const nameRow = h('div', { class: 'name-row' });
    nameRow.appendChild(roleIconEl(hero));
    nameRow.appendChild(h('div', { class: 'name' }, hero.name));
    card.appendChild(nameRow);
    const metaTop = h('div', { class: 'meta-top' });
    metaTop.appendChild(h('span', { class: `el-badge el-${hero.element}` }, D.ELEMENTS[hero.element].name));
    metaTop.appendChild(h('span', { class: 'stars' }, A.renderStars(hero.stars)));
    card.appendChild(metaTop);
    card.appendChild(h('div', { class: 'role-text role-' + roleClass(hero) }, hero.role));
    const stats = h('div', { class: 'stat-row' });
    const hpCell = h('span', { class: 'stat' });
    hpCell.appendChild(h('span', { class: 'stat-key' }, 'HP'));
    hpCell.appendChild(h('span', { class: 'stat-val' }, fmt(hero.base.hp)));
    stats.appendChild(hpCell);
    // Show the most tactically relevant secondary stat based on role.
    // Tanks → DEF (their defining survivability stat)
    // Rangers & Assassins → SPD (their defining first-strike advantage)
    // Healers → SPD (turn order determines when heals land)
    // Warriors, Mages, Champions → ATK (raw damage output)
    const roleStr = (hero.role || '').toLowerCase();
    let secKey, secLabel, secVal;
    if (roleStr === 'tank') {
      secKey = 'def'; secLabel = 'DEF'; secVal = String(hero.base.def);
    } else if (roleStr === 'ranger' || roleStr === 'assassin') {
      secKey = 'spd'; secLabel = 'SPD'; secVal = String(hero.base.spd);
    } else if (roleStr === 'healer' || roleStr === 'sage') {
      secKey = 'spd'; secLabel = 'SPD'; secVal = String(hero.base.spd);
    } else {
      secKey = 'atk'; secLabel = 'ATK'; secVal = String(hero.base.atk);
    }
    const secCell = h('span', { class: 'stat stat-' + secKey });
    secCell.appendChild(h('span', { class: 'stat-key' }, secLabel));
    secCell.appendChild(h('span', { class: 'stat-val' }, secVal));
    stats.appendChild(secCell);
    if (opts.level != null) {
      const lvlCell = h('span', { class: 'stat stat-level' });
      lvlCell.appendChild(h('span', { class: 'stat-key' }, 'Lv'));
      lvlCell.appendChild(h('span', { class: 'stat-val' }, String(opts.level)));
      stats.appendChild(lvlCell);
    }
    card.appendChild(stats);
    return card;
  }

  function renderTeamSelect(app, ctx) {
    app.innerHTML = '';
    const cb = renderCurrencyBar(ctx);
    if (cb) app.appendChild(cb);
    const header = h('div', { class: 'screen-header' });
    const titleWrap = h('div', null);
    titleWrap.appendChild(h('h2', null, 'Choose Your Team'));
    const stage = ctx.state.queuedStage;
    const subtitle = stage
      ? `Pick 3 heroes for: ${stage.name} · Matchups: Fire > Wind > Water > Fire · Light ↔ Dark`
      : 'Pick 3 heroes. Matchups: Fire > Wind > Water > Fire · Light ↔ Dark';
    titleWrap.appendChild(h('div', { class: 'subtitle' }, subtitle));
    // If a stage is queued, show a concise enemy element row and strong-pick hint.
    if (stage) {
      const uniqueEls = [...new Set(stage.enemyIds.map(eid => {
        const e = D.enemyById(eid); return e ? e.element : null;
      }).filter(Boolean))];
      if (uniqueEls.length) {
        const elHint = h('div', { class: 'stage-el-hint' });
        elHint.appendChild(h('span', { class: 'stage-el-hint-label' }, 'Enemies: '));
        uniqueEls.forEach(function(el) {
          const elInfo = D.ELEMENTS[el];
          elHint.appendChild(h('span', { class: 'el-badge el-' + el, style: 'margin-right:4px' },
            elInfo ? elInfo.name : el));
        });
        titleWrap.appendChild(elHint);

        // Compute which attacker elements are strong (1.5×) vs the enemy elements present.
        // Advantage rules (from data.js elementMod): fire>wind, wind>water, water>fire, light<>dark.
        const STRONG_VS = { wind: 'fire', water: 'wind', fire: 'water', dark: 'light', light: 'dark' };
        const strongPicks = [...new Set(uniqueEls.map(def => STRONG_VS[def]).filter(Boolean))];
        if (strongPicks.length) {
          const adv = h('div', { class: 'stage-el-adv' });
          adv.appendChild(h('span', { class: 'stage-el-hint-label' }, '⚡ Strong picks: '));
          strongPicks.forEach(function(el) {
            const elInfo = D.ELEMENTS[el];
            adv.appendChild(h('span', { class: 'el-badge el-' + el, style: 'margin-right:4px' },
              elInfo ? elInfo.name : el));
          });
          titleWrap.appendChild(adv);
        }
      }
    }
    header.appendChild(titleWrap);
    header.appendChild(backButton(ctx, 'Back', stage ? 'stage-select' : 'title'));
    app.appendChild(header);

    const p = ctx.state.player;
    const sortRow = h('div', { class: 'controls-row' });
    sortRow.appendChild(renderSortSelector(p.rosterSort || 'rarity', (k) => {
      p.rosterSort = k; ctx.persistNow && ctx.persistNow();
      renderTeamSelect(app, ctx);
    }));
    app.appendChild(sortRow);

    const dupeCount = {};
    (p.ownedInstances || []).forEach(i => { dupeCount[i.id] = (dupeCount[i.id] || 0) + 1; });
    const ownedHeroes = Object.keys(dupeCount).map(id => D.heroById(id)).filter(Boolean);
    const sorted = sortHeroes(ownedHeroes, p.rosterSort || 'rarity');

    if (sorted.length === 0) {
      const empty = h('div', { class: 'empty-roster' });
      empty.appendChild(h('div', { class: 'empty-title' }, 'No heroes owned'));
      empty.appendChild(h('div', { class: 'empty-sub' }, 'Use Summon to recruit heroes, or reset your save to get a starter pack.'));
      app.appendChild(empty);
      return;
    }

    const grid = h('div', { class: 'roster-grid' });
    sorted.forEach(hero => {
      const card = buildRosterCard(hero, {
        dupeCount: dupeCount[hero.id] || 0,
        owned: true,
        level: window.GAME_SAVE.getHeroLevel(ctx.state.player, hero.id),
        selected: ctx.state.selectedHeroIds.includes(hero.id),
        onClick: () => toggleHero(ctx, hero.id),
      });
      grid.appendChild(card);
    });
    app.appendChild(grid);

    const bar = h('div', { class: 'team-bar' });
    const slots = h('div', { class: 'team-slots' });
    for (let i = 0; i < 3; i++) {
      const id = ctx.state.selectedHeroIds[i];
      const hero = id ? D.heroById(id) : null;
      const slot = h('div', { class: 'team-slot' + (hero ? ' filled' : '') });
      if (hero) {
        // Portrait thumbnail
        slot.appendChild(h('div', { class: 'portrait', html: A.renderPortrait(hero) }));
        // Hero name label
        slot.appendChild(h('div', { class: 'team-slot-name' }, hero.name));
        // Quick-remove "×" button
        const removeBtn = h('button', {
          class: 'team-slot-remove',
          title: 'Remove ' + hero.name,
          'aria-label': 'Remove ' + hero.name + ' from team',
          onclick: (e) => {
            e.stopPropagation();
            const arr = ctx.state.selectedHeroIds.filter(x => x !== id);
            ctx.state.selectedHeroIds = arr;
            renderTeamSelect(document.getElementById('app'), ctx);
          },
        }, '✕');
        slot.appendChild(removeBtn);
      } else {
        slot.appendChild(h('span', { style: 'font-size:10px;color:var(--muted)' }, `Slot ${i+1}`));
      }
      slots.appendChild(slot);
    }
    bar.appendChild(slots);
    const btn = h('button', { class: 'btn', onclick: () => ctx.confirmTeam() }, 'Battle');
    btn.disabled = ctx.state.selectedHeroIds.length !== 3;
    bar.appendChild(btn);
    app.appendChild(bar);
  }

  function toggleHero(ctx, id) {
    const arr = ctx.state.selectedHeroIds.slice();
    const idx = arr.indexOf(id);
    if (idx >= 0) arr.splice(idx, 1);
    else if (arr.length < 3) arr.push(id);
    else { toast('Team is full. Tap a selected hero to remove.'); return; }
    ctx.state.selectedHeroIds = arr;
    renderTeamSelect(document.getElementById('app'), ctx);
  }

  function renderVault(app, ctx) {
    app.innerHTML = '';
    const cb = renderCurrencyBar(ctx);
    if (cb) app.appendChild(cb);
    const p = ctx.state.player;
    if (!p.vaultFilter) p.vaultFilter = { element: 'all', role: 'all', owned: 'all' };
    const filter = p.vaultFilter;
    const ownedSet = new Set();
    const dupeCount = {};
    (p.ownedInstances || []).forEach(i => { ownedSet.add(i.id); dupeCount[i.id] = (dupeCount[i.id] || 0) + 1; });
    const totalHeroes = D.HEROES.length;
    const ownedCount = ownedSet.size;
    const completionPct = Math.round((ownedCount / totalHeroes) * 100);

    const header = h('div', { class: 'screen-header' });
    const tw = h('div', null);
    tw.appendChild(h('h2', null, 'Collection Vault'));
    tw.appendChild(h('div', { class: 'subtitle' },
      `${ownedCount} / ${totalHeroes} unique heroes · ${completionPct}% complete`));
    header.appendChild(tw);
    header.appendChild(backButton(ctx));
    app.appendChild(header);

    const bar = h('div', { class: 'completion-bar' });
    const fill = h('div', { class: 'completion-fill' });
    fill.style.width = completionPct + '%';
    bar.appendChild(fill);
    app.appendChild(bar);

    const controls = h('div', { class: 'vault-controls' });
    function pillRow(label, kind, opts) {
      const row = h('div', { class: 'pill-row' });
      row.appendChild(h('span', { class: 'pill-label' }, label));
      opts.forEach(o => {
        const active = filter[kind] === o.value;
        const pill = h('button', {
          class: 'filter-pill' + (active ? ' active' : ''),
          'aria-pressed': active ? 'true' : 'false',
          onclick: () => { filter[kind] = o.value; ctx.persistNow && ctx.persistNow(); renderVault(app, ctx); },
        }, o.label);
        row.appendChild(pill);
      });
      return row;
    }
    controls.appendChild(pillRow('Element', 'element', [
      { value: 'all', label: 'All' }, { value: 'fire', label: 'Fire' }, { value: 'water', label: 'Water' },
      { value: 'wind', label: 'Wind' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' },
    ]));
    controls.appendChild(pillRow('Role', 'role', [
      { value: 'all', label: 'All' }, { value: 'tank', label: 'Tank' },
      { value: 'healer', label: 'Healer' }, { value: 'dps', label: 'Attacker' },
    ]));
    controls.appendChild(pillRow('Owned', 'owned', [
      { value: 'all', label: 'All' }, { value: 'owned', label: 'Owned' }, { value: 'missing', label: 'Missing' },
    ]));
    const sortRow = h('div', { class: 'controls-row' });
    sortRow.appendChild(renderSortSelector(p.vaultSort || 'rarity', (k) => {
      p.vaultSort = k; ctx.persistNow && ctx.persistNow();
      renderVault(app, ctx);
    }));
    controls.appendChild(sortRow);
    app.appendChild(controls);

    const filtered = D.HEROES.filter(hh => {
      if (filter.element !== 'all' && hh.element !== filter.element) return false;
      if (filter.role !== 'all' && roleClass(hh) !== filter.role) return false;
      if (filter.owned === 'owned' && !ownedSet.has(hh.id)) return false;
      if (filter.owned === 'missing' && ownedSet.has(hh.id)) return false;
      return true;
    });
    const sorted = sortHeroes(filtered, p.vaultSort || 'rarity');

    if (sorted.length === 0) {
      const empty = h('div', { class: 'empty-roster' });
      empty.appendChild(h('div', { class: 'empty-title' }, 'No heroes match'));
      empty.appendChild(h('div', { class: 'empty-sub' }, 'Try a different filter combination.'));
      app.appendChild(empty);
      return;
    }

    const grid = h('div', { class: 'roster-grid' });
    sorted.forEach(hero => {
      const owned = ownedSet.has(hero.id);
      const card = buildRosterCard(hero, {
        dupeCount: dupeCount[hero.id] || 0,
        owned, selected: false,
        level: owned ? window.GAME_SAVE.getHeroLevel(ctx.state.player, hero.id) : null,
        onClick: () => showHeroDetail(hero, owned, dupeCount[hero.id] || 0, ctx),
      });
      grid.appendChild(card);
    });
    app.appendChild(grid);
  }

  function showHeroDetail(hero, owned, dupeCount, ctx) {
    const overlay = h('div', { class: 'modal-bg' });
    const modal = h('div', { class: 'modal hero-detail-modal' });
    const head = h('div', { class: 'hd-head' });
    head.appendChild(h('div', { class: 'hd-portrait', html: A.renderPortrait(hero) }));
    const hdInfo = h('div', { class: 'hd-info' });
    const nameLine = h('div', { class: 'hd-name-line' });
    nameLine.appendChild(roleIconEl(hero));
    nameLine.appendChild(h('span', { class: 'hd-name' }, hero.name));
    hdInfo.appendChild(nameLine);
    const metaLine = h('div', { class: 'hd-meta' });
    metaLine.appendChild(h('span', { class: `el-badge el-${hero.element}` }, D.ELEMENTS[hero.element].name));
    // Show actual star count from save (respects ascension), not the frozen template value.
    const _S = window.GAME_SAVE;
    const displayStars = (owned && ctx && _S) ? (_S.getHeroStars(ctx.state.player, hero.id) || hero.stars) : hero.stars;
    metaLine.appendChild(h('span', { class: 'stars' }, A.renderStars(displayStars)));
    metaLine.appendChild(h('span', { class: 'role-text role-' + roleClass(hero) }, hero.role));
    hdInfo.appendChild(metaLine);
    if (owned) hdInfo.appendChild(h('div', { class: 'hd-owned-tag' }, `Owned ×${dupeCount}`));
    else hdInfo.appendChild(h('div', { class: 'hd-locked-tag' }, 'Not owned — summon to unlock'));
    head.appendChild(hdInfo);
    modal.appendChild(head);
    // Compute displayed stats — show level-scaled + rune-boosted values when owned.
    const _S_detail = window.GAME_SAVE;
    const _heroLevel = (owned && ctx && _S_detail) ? _S_detail.getHeroLevel(ctx.state.player, hero.id) : 1;
    const _runeBoosts = (owned && ctx && _S_detail) ? _S_detail.getHeroRuneBoosts(ctx.state.player, hero.id) : {};
    const lv = Math.max(0, _heroLevel - 1);
    const _scaledHp  = Math.round(hero.base.hp  * (1 + lv * 0.030) * (1 + (_runeBoosts.hp  || 0)));
    const _scaledAtk = Math.round(hero.base.atk * (1 + lv * 0.025) * (1 + (_runeBoosts.atk || 0)));
    const _scaledDef = Math.round(hero.base.def * (1 + lv * 0.025) * (1 + (_runeBoosts.def || 0)));
    const _scaledSpd = Math.round(hero.base.spd * (1 + (_runeBoosts.spd || 0)));
    const _critRate  = Math.min(0.95, hero.base.critRate  + (_runeBoosts.critRate  || 0));
    const _critDmg   = hero.base.critDmg + (_runeBoosts.critDmg || 0);
    const _isScaled  = owned && (_heroLevel > 1 || Object.values(_runeBoosts).some(v => v > 0));
    const statGrid = h('div', { class: 'hd-stat-grid' });
    if (_isScaled) {
      statGrid.appendChild(h('div', { class: 'hd-stat-note', style: 'grid-column:1/-1;font-size:10px;color:var(--muted);margin-bottom:2px;' },
        'Stats at Lv.' + _heroLevel + (Object.values(_runeBoosts).some(v => v > 0) ? ' + Runes' : '')));
    }
    [
      ['Max HP', fmt(_scaledHp), _isScaled && _scaledHp !== hero.base.hp],
      ['ATK', String(_scaledAtk), _isScaled && _scaledAtk !== hero.base.atk],
      ['DEF', String(_scaledDef), _isScaled && _scaledDef !== hero.base.def],
      ['SPD', String(_scaledSpd), _isScaled && _scaledSpd !== hero.base.spd],
      ['Crit Rate', Math.round(_critRate * 100) + '%', false],
      ['Crit DMG', '+' + Math.round(_critDmg * 100) + '%', false],
    ].forEach(([k, v, boosted]) => {
      const cell = h('div', { class: 'hd-stat-cell' + (boosted ? ' boosted' : '') });
      cell.appendChild(h('div', { class: 'hd-stat-key' }, k));
      cell.appendChild(h('div', { class: 'hd-stat-val' }, v));
      statGrid.appendChild(cell);
    });
    modal.appendChild(statGrid);
    // Level, XP bar, and ascension button
    if (owned) {
      const S = window.GAME_SAVE;
      const heroLevel = S.getHeroLevel(ctx.state.player, hero.id);
      const insts = (ctx.state.player.ownedInstances || []).filter(i => i.id === hero.id);
      const bestInst = insts.reduce((b, i) => ((i.level || 1) >= (b.level || 1) ? i : b), insts[0] || { level: 1, xp: 0 });
      const currentXp = bestInst.xp || 0;
      const xpSection = h('div', { class: 'hd-xp-section' });
      if (heroLevel >= S.MAX_LEVEL) {
        xpSection.appendChild(h('div', { class: 'hd-xp-label' }, 'Level ' + heroLevel + ' · MAX'));
      } else {
        const needed = S.xpToNextLevel(heroLevel);
        const pct = Math.min(100, Math.floor((currentXp / needed) * 100));
        xpSection.appendChild(h('div', { class: 'hd-xp-label' }, 'Level ' + heroLevel + ' · ' + currentXp + ' / ' + needed + ' XP'));
        const track = h('div', { class: 'hd-xp-track' });
        const xpFill = h('div', { class: 'hd-xp-fill' });
        xpFill.style.width = pct + '%';
        track.appendChild(xpFill);
        xpSection.appendChild(track);
      }
      modal.appendChild(xpSection);
      if (S.canAscend(ctx.state.player, hero.id)) {
        const targetStars = displayStars + 1;
        const ascBtn = h('button', { class: 'btn-ascend', onclick: () => {
          const result = S.ascendHero(ctx.state.player, hero.id);
          if (result) {
            ctx.persistNow && ctx.persistNow();
            overlay.remove();
            ctx.navigate('vault');
            toast(hero.name + ' ascended to ' + result.newStars + '★!');
          }
        }}, '✦ Ascend to ' + targetStars + '★ — costs ' + S.ASCEND_COST + ' copies');
        modal.appendChild(ascBtn);
        modal.appendChild(h('div', { class: 'ascend-hint' }, 'Consumes all 3 owned copies (2 as fodder). The strongest copy grows 1★.'));
      }
    }
    modal.appendChild(h('div', { class: 'hd-skills-title' }, 'Skills'));
    const skills = h('div', { class: 'hd-skills' });
    hero.skills.forEach(sid => {
      const sk = D.SKILLS[sid];
      const skBox = h('div', { class: 'hd-skill' });
      const sn = h('div', { class: 'hd-skill-name' });
      sn.appendChild(h('span', null, sk.name));
      if (sk.cd) sn.appendChild(h('span', { class: 'hd-skill-cd' }, 'CD ' + sk.cd));
      skBox.appendChild(sn);
      skBox.appendChild(h('div', { class: 'hd-skill-desc' }, sk.desc));
      skills.appendChild(skBox);
    });
    modal.appendChild(skills);
    const actions = h('div', { class: 'modal-actions' });
    actions.appendChild(h('button', { class: 'btn-nav', onclick: () => overlay.remove() }, 'Close'));
    modal.appendChild(actions);
    overlay.appendChild(modal);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }


  // ============================================================
  //  Capcom-style battle FX — VS overlay, slam stamps, flash
  //  These are visual-only side effects; combat state is unaffected.
  // ============================================================
  function capcomFlash(kind) {
    if (!document || !document.body) return;
    const el = document.createElement('div');
    el.className = 'capcom-flash' + (kind ? ' ' + kind : '');
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
  }
  function capcomStamp(text, kind, duration) {
    if (!document || !document.body) return;
    const el = document.createElement('div');
    el.className = 'capcom-stamp' + (kind ? ' ' + kind : '');
    el.textContent = text;
    document.body.appendChild(el);
    const lifeMs = (duration || 1400) + 60;
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, lifeMs);
    return el;
  }
  // VS clash overlay shown on battle start. Two team labels slide in from
  // each side, big VS stamp slams in the middle, then the whole overlay
  // fades. Total ~1500ms. Callback fires when overlay is gone.
  function capcomVS(allyNames, enemyNames, cb) {
    try {
      if (!document || !document.body) { cb && cb(); return; }
      const wrap = document.createElement('div');
      wrap.className = 'capcom-vs';
      wrap.style.pointerEvents = 'auto';  // catch click-to-skip
      const left = document.createElement('div');
      left.className = 'capcom-vs-half left';
      left.innerHTML =
        '<div>' +
          '<div class="vs-side-label">Enemies</div>' +
          '<div class="vs-side-names">' + (enemyNames || '').replace(/</g, '&lt;') + '</div>' +
        '</div>';
      const right = document.createElement('div');
      right.className = 'capcom-vs-half right';
      right.innerHTML =
        '<div>' +
          '<div class="vs-side-label">Your Party</div>' +
          '<div class="vs-side-names">' + (allyNames || '').replace(/</g, '&lt;') + '</div>' +
        '</div>';
      const stamp = document.createElement('div');
      stamp.className = 'capcom-vs-stamp';
      stamp.textContent = 'VS';
      wrap.appendChild(left);
      wrap.appendChild(right);
      wrap.appendChild(stamp);
      document.body.appendChild(wrap);
      const AU = window.GAME_AUDIO; if (AU) AU.play('vs_clash');
      let cleaned = false;
      const cleanup = function () {
        if (cleaned) return;
        cleaned = true;
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        if (cb) try { cb(); } catch (e) {}
      };
      // Click anywhere to skip
      wrap.addEventListener('click', cleanup);
      // Auto fade-exit + cleanup
      setTimeout(function () { try { wrap.classList.add('exit'); } catch (e) {} }, 1200);
      setTimeout(cleanup, 1500);
      // Hard failsafe — never let this overlay linger more than 3 seconds
      setTimeout(cleanup, 3000);
    } catch (e) {
      // Never let the overlay block the player.
      if (cb) try { cb(); } catch (e2) {}
    }
  }

  // MvC-style chain combo counter — shows × HITS! growing per multi-hit strike.
  let _comboEl = null, _comboTimer = null;
  function capcomCombo(n) {
    try {
      if (!document || !document.body) return;
      if (!_comboEl) {
        _comboEl = document.createElement('div');
        _comboEl.className = 'capcom-combo';
        _comboEl.innerHTML = '<span class="num"></span><span class="label">HITS!</span>';
        document.body.appendChild(_comboEl);
      }
      _comboEl.querySelector('.num').textContent = '× ' + n;
      _comboEl.classList.remove('pop'); void _comboEl.offsetWidth;
      _comboEl.classList.add('pop');
      clearTimeout(_comboTimer);
      _comboTimer = setTimeout(function () {
        if (_comboEl && _comboEl.parentNode) _comboEl.parentNode.removeChild(_comboEl);
        _comboEl = null;
      }, 1200);
    } catch (e) {}
  }
  let _comboCount = 0, _comboResetTimer = null;
  function capcomComboTick() {
    clearTimeout(_comboResetTimer);
    _comboCount += 1;
    capcomCombo(_comboCount);
    _comboResetTimer = setTimeout(function () { _comboCount = 0; }, 1500);
  }

  // Element-coded screen tint when a skill casts — fires alongside skill_cast.
  function capcomElemTint(element) {
    try {
      if (!document || !document.body || !element) return;
      const valid = { fire: 1, water: 1, light: 1, dark: 1, wind: 1 };
      if (!valid[element]) return;
      const el = document.createElement('div');
      el.className = 'capcom-elem-tint ' + element;
      document.body.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 460);
      const AU = window.GAME_AUDIO;
      if (AU && AU.play) AU.play('elem_' + element);
    } catch (e) {}
  }

  // Hyper-Combo-Finish framing for ult skills — vignette + scale-zoom the field.
  function capcomSuperZoom(caster, cb) {
    try {
      const field = document.getElementById('battle-field');
      const vig = document.createElement('div');
      vig.className = 'capcom-vignette';
      if (document.body) document.body.appendChild(vig);
      if (field) field.classList.add('super-zoom');
      setTimeout(function () {
        if (field) field.classList.remove('super-zoom');
        if (vig.parentNode) vig.parentNode.removeChild(vig);
        if (cb) try { cb(); } catch (e) {}
      }, 600);
    } catch (e) { if (cb) try { cb(); } catch (e2) {} }
  }


  function renderBattle(app, ctx) {
    const b = ctx.state.battle;
    if (!b) return;
    app.innerHTML = '';
    const cb = renderCurrencyBar(ctx);
    if (cb) app.appendChild(cb);
    const header = h('div', { class: 'battle-header' });
    header.appendChild(h('div', { class: 'stage-name' }, b.stage.name));
    const turnLbl = h('div', { class: 'turn-label' });
    if (b.acting) turnLbl.innerHTML = `Now acting: <strong>${b.acting.name}</strong>`;
    else turnLbl.textContent = 'ATB filling…';
    header.appendChild(turnLbl);
    const autoBtn = h('button', { class: 'auto-toggle' + (ctx.state.autoBattle ? ' on' : ''), onclick: () => ctx.toggleAuto() }, ctx.state.autoBattle ? 'AUTO: ON' : 'AUTO: OFF');
    autoBtn.setAttribute('aria-pressed', ctx.state.autoBattle ? 'true' : 'false');
    header.appendChild(autoBtn);
    const AU_battle = window.GAME_AUDIO;
    if (AU_battle && typeof AU_battle.setMuted === 'function') {
      const muteBtn = h('button', {
        class: 'mute-toggle' + (AU_battle.isMuted() ? ' muted' : ''),
        title: AU_battle.isMuted() ? 'Unmute' : 'Mute',
        onclick: function() { AU_battle.setMuted(!AU_battle.isMuted()); renderBattle(app, ctx); },
      }, AU_battle.isMuted() ? '🔇' : '🔊');
      header.appendChild(muteBtn);
    }
    // DEBUG snapshot button is opt-in: keeps the battle header uncluttered for
    // real players, but devs can flip it on with ?debug=1 in the URL or by
    // setting localStorage.aetherbound_debug = '1'.
    var __debugOn = false;
    try {
      __debugOn = (typeof location !== 'undefined' && /[?&]debug=1\b/.test(location.search))
        || (typeof localStorage !== 'undefined' && localStorage.getItem('aetherbound_debug') === '1');
    } catch (e) { /* sandboxed contexts */ }
    if (__debugOn) {
      const dbgBtn = h('button', {
        class: 'mute-toggle debug-snapshot',
        title: 'Copy battle layout snapshot to clipboard',
        onclick: function () {
          const report = captureBattleSnapshot();
          const fallback = function () {
            if (window.prompt) window.prompt('Copy snapshot, paste to Claude:', report);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(report).then(function () {
              toast('Snapshot copied. Paste in chat.');
            }).catch(fallback);
          } else { fallback(); }
        }
      }, 'DEBUG');
      header.appendChild(dbgBtn);
    }
    app.appendChild(header);

    // JRPG layout: enemies LEFT, heroes RIGHT.
    // Each side is wrapped in a .team-column so the CSS grid
    // (1fr  56px  1fr) receives exactly three children.
    const field = h('div', { class: 'field field-jrpg', id: 'battle-field' });
    // Runtime guarantee — set structural styles with !important via JS so they
    // ALWAYS win regardless of cascade conflicts in style.css. Belt-and-suspenders
    // for the grid-disable + team-column-fullwidth rules.
    try {
      field.style.setProperty('display', 'block', 'important');
      field.style.setProperty('grid-template-columns', 'none', 'important');
      field.style.setProperty('gap', '0', 'important');
      field.style.setProperty('padding', '0', 'important');
      field.style.setProperty('position', 'relative', 'important');
    } catch (e) {}
    field.appendChild(renderColumn(b.enemy, 'enemies', ctx));
    // Force team-column structural styles too
    const _enemiesCol = field.querySelector('.team-column.enemies');
    if (_enemiesCol) try {
      _enemiesCol.style.setProperty('display', 'block', 'important');
      _enemiesCol.style.setProperty('position', 'absolute', 'important');
      _enemiesCol.style.setProperty('top', '0', 'important');
      _enemiesCol.style.setProperty('left', '0', 'important');
      _enemiesCol.style.setProperty('right', '0', 'important');
      _enemiesCol.style.setProperty('bottom', '0', 'important');
      _enemiesCol.style.setProperty('width', '100%', 'important');
      _enemiesCol.style.setProperty('pointer-events', 'none', 'important');
    } catch (e) {}
    const divider = h('div', { class: 'field-divider', 'aria-hidden': 'true' });
    divider.innerHTML = '<span class="vs-label">VS</span>';
    field.appendChild(divider);
    field.appendChild(renderColumn(b.ally, 'allies', ctx));
    const _alliesCol = field.querySelector('.team-column.allies');
    if (_alliesCol) try {
      _alliesCol.style.setProperty('display', 'block', 'important');
      _alliesCol.style.setProperty('position', 'absolute', 'important');
      _alliesCol.style.setProperty('top', '0', 'important');
      _alliesCol.style.setProperty('left', '0', 'important');
      _alliesCol.style.setProperty('right', '0', 'important');
      _alliesCol.style.setProperty('bottom', '0', 'important');
      _alliesCol.style.setProperty('width', '100%', 'important');
      _alliesCol.style.setProperty('pointer-events', 'none', 'important');
    } catch (e) {}

    // Force per-unit positions from user-defined coordinates. This is the
    // most reliable layer — JS-applied inline !important wins all CSS cascade.
    const _UNIT_POSITIONS = [
      { sel: '.team-column.enemies > .unit:nth-child(1)', left: '7.1%',  bottom: '47.5%', scale: 0.92, z: 1 },
      { sel: '.team-column.enemies > .unit:nth-child(2)', left: '18.7%', bottom: '26.6%', scale: 0.98, z: 2 },
      { sel: '.team-column.enemies > .unit:nth-child(3)', left: '6.7%',  bottom: '9.2%',  scale: 1.0,  z: 3 },
      { sel: '.team-column.allies  > .unit:nth-child(1)', left: '75.2%', bottom: '52.5%', scale: 0.92, z: 1 },
      { sel: '.team-column.allies  > .unit:nth-child(2)', left: '68.4%', bottom: '29.3%', scale: 0.98, z: 2 },
      { sel: '.team-column.allies  > .unit:nth-child(3)', left: '78.8%', bottom: '9.5%',  scale: 1.0,  z: 3 },
    ];
    _UNIT_POSITIONS.forEach(function (p) {
      const u = field.querySelector(p.sel);
      if (!u) return;
      try {
        u.style.setProperty('position', 'absolute', 'important');
        u.style.setProperty('left', p.left, 'important');
        u.style.setProperty('right', 'auto', 'important');
        u.style.setProperty('bottom', p.bottom, 'important');
        u.style.setProperty('top', 'auto', 'important');
        u.style.setProperty('width', '14%', 'important');
        u.style.setProperty('max-width', '180px', 'important');
        u.style.setProperty('min-width', '110px', 'important');
        u.style.setProperty('transform', 'scale(' + p.scale + ')', 'important');
        u.style.setProperty('transform-origin', 'bottom center', 'important');
        u.style.setProperty('z-index', String(p.z), 'important');
        u.style.setProperty('pointer-events', 'auto', 'important');
      } catch (e) {}
    });
    app.appendChild(field);

    // JRPG-style bottom HUD strip — hero portrait cards with name + HP/MP-style
    // bars. Lives below the field, above the skill panel.
    app.appendChild(renderHeroHud(b, ctx));

    const sp = h('div', { id: 'skill-panel-mount' });
    app.appendChild(sp);
    const log = h('div', { class: 'battle-log', id: 'battle-log' });
    app.appendChild(log);

    const bar = h('div', { class: 'battle-bottom-bar' });
    bar.appendChild(h('button', { class: 'btn-nav btn-danger', onclick: () => {
      showConfirm(
        'Forfeit Battle?',
        'You will lose this battle and gain no rewards.',
        'Forfeit',
        function () { ctx.navigate('title'); }
      );
    } }, 'Forfeit'));
    app.appendChild(bar);

    renderLog(ctx);
    if (!b.result) renderSkillPanel(ctx);
    // Capcom-style battle entrance: VS clash overlay then "FIGHT!" stamp.
    // Only fire the first time we enter a fresh battle (no result yet, no flag).
    if (!b._capcomShown && !b.result) {
      b._capcomShown = true;
      try {
        const allyNames = (b.ally || []).map(function(u){ return u.name; }).join(' / ');
        const enemyNames = (b.enemy || []).map(function(u){ return u.name; }).join(' / ');
        capcomVS(allyNames, enemyNames, function () {
          capcomStamp('FIGHT!', 'fight', 900);
          const AU2 = window.GAME_AUDIO; if (AU2) AU2.play('fight_stamp');
        });
      } catch (e) {}
    }
  }

  function renderColumn(units, kind, ctx) {
    const col = h('div', { class: 'team-column ' + kind });
    units.forEach(u => col.appendChild(renderUnit(u, ctx)));
    return col;
  }

  // JRPG bottom HUD — three hero portrait cards with name, HP bar, and an ATB
  // gauge styled as a secondary "energy" bar. Sits below the battle field.
  function renderHeroHud(b, ctx) {
    const hud = h('div', { class: 'hero-hud', id: 'hero-hud' });
    (b.ally || []).forEach(u => {
      const card = h('div', {
        class: 'hud-card' + (b.acting && b.acting.id === u.id ? ' acting' : '') +
               (!C.isAlive(u) ? ' dead' : ''),
        id: 'hud-' + u.id,
      });
      const portraitWrap = h('div', { class: 'hud-portrait', html: A.renderPortrait(u) });
      card.appendChild(portraitWrap);
      const info = h('div', { class: 'hud-info' });

      // Name row: name + level badge
      const nameRow = h('div', { class: 'hud-name-row' });
      nameRow.appendChild(h('span', { class: 'hud-name' }, u.name));
      if (u.level && u.level > 1) {
        nameRow.appendChild(h('span', { class: 'hud-level-badge' }, 'Lv.' + u.level));
      }
      info.appendChild(nameRow);

      // HP bar
      const hpFill = Math.max(0, Math.min(100, (u.hp / Math.max(1, u.maxHp)) * 100));
      const hpBar = h('div', { class: 'hud-bar hud-hp', id: 'hud-hp-bar-' + u.id });
      const hpRow = h('div', { class: 'hud-bar-row' });
      hpRow.appendChild(h('span', { class: 'hud-bar-label' }, 'HP'));
      const hpFillNode = h('div', { class: 'hud-bar-fill', id: 'hud-hp-fill-' + u.id });
      hpFillNode.style.width = hpFill + '%';
      if (hpFill < 30) hpFillNode.classList.add('low');
      hpBar.appendChild(hpFillNode);
      const hpVal = h('span', { class: 'hud-bar-val', id: 'hud-hp-val-' + u.id },
        String(Math.max(0, Math.floor(u.hp))));
      hpRow.appendChild(hpBar);
      hpRow.appendChild(hpVal);
      info.appendChild(hpRow);

      // ATB bar
      const atbPct = Math.max(0, Math.min(100, u.atb || 0));
      const atbBar = h('div', { class: 'hud-bar hud-atb' });
      const atbRow = h('div', { class: 'hud-bar-row' });
      atbRow.appendChild(h('span', { class: 'hud-bar-label' }, 'ATB'));
      const atbFillNode = h('div', { class: 'hud-bar-fill', id: 'hud-atb-fill-' + u.id });
      atbFillNode.style.width = atbPct + '%';
      atbBar.appendChild(atbFillNode);
      const atbValNode = h('span', { class: 'hud-bar-val', id: 'hud-atb-val-' + u.id },
        Math.floor(atbPct) + '%');
      atbRow.appendChild(atbBar);
      atbRow.appendChild(atbValNode);
      info.appendChild(atbRow);

      // Status strip — show up to 4 active status icons (buffs green, debuffs red)
      const activeStatuses = (u.statuses || []).filter(s => s.label);
      if (activeStatuses.length > 0) {
        const statusStrip = h('div', { class: 'hud-status-strip' });
        activeStatuses.slice(0, 4).forEach(s => {
          const isBuff = (s.amount && s.amount > 0) || s.kind === 'buff' || s.kind === 'shield';
          statusStrip.appendChild(h('span', {
            class: 'hud-status-icon ' + (isBuff ? 'buff' : 'debuff'),
            title: s.label + ' (' + s.turns + 't)',
          }, s.label));
        });
        info.appendChild(statusStrip);
      }

      card.appendChild(info);
      hud.appendChild(card);
    });
    return hud;
  }

  function renderUnit(unit, ctx) {
    const b = ctx.state.battle;
    const active = b.acting && b.acting.id === unit.id;
    const targetable = b.pendingSkill && canTarget(unit, b.pendingSkill, b);
    const shellCls = ['unit'];
    if (active) shellCls.push('acting');
    if (!C.isAlive(unit)) shellCls.push('dead');
    if (targetable) shellCls.push('targetable');
    if (unit.atb >= 100) shellCls.push('atb-ready');
    const shell = h('div', {
      class: shellCls.join(' '),
      id: 'unit-' + unit.id,
      'data-side': unit.side || 'ally',
      'data-pos': String(unit.position || 0),
    });
    // Set element aura CSS var for glow color
    const elColors = { fire: '#ff6b35', wind: '#7de87d', water: '#35a8ff', light: '#fff5a0', dark: '#c080ff' };
    if (unit.element && elColors[unit.element]) {
      shell.style.setProperty('--el-aura', elColors[unit.element]);
    }
    if (targetable) shell.addEventListener('click', () => ctx.selectTarget(unit));

    const body = h('div', { class: 'unit-body' });

    // ---- Name bar (slim header above the avatar) ----
    const nameBar = h('div', { class: 'unit-name-bar' });
    nameBar.appendChild(h('span', { class: 'name' }, unit.name));
    const _elInfo = D.ELEMENTS[unit.element];
    nameBar.appendChild(h('span', { class: 'el-badge el-' + unit.element }, _elInfo ? _elInfo.name : unit.element));
    if (unit.side === 'ally' && unit.level > 1) {
      nameBar.appendChild(h('span', { class: 'unit-level-badge', title: 'Hero level' }, 'Lv.' + unit.level));
    }
    body.appendChild(nameBar);

    // ---- Avatar (portrait dominates; all overlays live inside) ----
    const avatar = h('div', { class: 'unit-avatar' });

    // Portrait artwork
    const portrait = h('div', { class: 'portrait', html: A.renderPortrait(unit) });
    avatar.appendChild(portrait);

    // Role badge — top-left corner of avatar
    const roleOverlay = h('div', { class: 'role-overlay role-' + roleClass(unit), title: unit.role || '' });
    roleOverlay.innerHTML = ROLE_ICON_SVG[roleClass(unit)];
    avatar.appendChild(roleOverlay);

    // HP overlay — bottom strip of avatar
    const hpOverlay = h('div', { class: 'hp-overlay' });
    const hpBar = h('div', { class: 'hp-bar' });
    const hpFill = h('div', { class: 'fill' });
    const pct = unit.hp / unit.maxHp;
    hpFill.style.width = (pct * 100) + '%';
    if (pct < 0.3) hpFill.style.background = 'linear-gradient(90deg, #ff6e7c, #ff3d50)';
    else if (pct < 0.6) hpFill.style.background = 'linear-gradient(90deg, #ffb454, #ff8a3d)';
    hpBar.appendChild(hpFill);
    hpOverlay.appendChild(hpBar);
    const hpText = h('div', { class: 'hp-text' },
      fmt(unit.hp) + ' / ' + fmt(unit.maxHp) + (unit.shield > 0 ? ' · ◈' + fmt(unit.shield) : ''));
    hpOverlay.appendChild(hpText);
    avatar.appendChild(hpOverlay);

    // Status icons — floating top-right corner of avatar
    const statusRow = h('div', { class: 'status-row floating' });
    if (unit.statuses.length) {
      unit.statuses.forEach(s => {
        const isBuff = (s.amount && s.amount > 0) || s.kind === 'buff' || s.kind === 'shield';
        const expiring = s.turns <= 1;
        statusRow.appendChild(h('span', {
          class: 'status-icon ' + (isBuff ? 'buff' : 'debuff') + (expiring ? ' last-turn' : ''),
        }, s.label + ' (' + s.turns + ')'));
      });
    }
    avatar.appendChild(statusRow);

    // FX layer sits inside avatar so popups + element bursts position over the character
    avatar.appendChild(h('div', { class: 'fx-layer', id: 'fx-' + unit.id }));

    body.appendChild(avatar);

    // ---- ATB bar — direct child of .unit-body, below the avatar ----
    const atbPct = Math.round(Math.min(100, unit.atb));
    const atbReadyCls = unit.atb >= 100 ? ' ready' : unit.atb >= 75 ? ' soon' : '';
    const atbWrap = h('div', { class: 'atb-wrap' + atbReadyCls });
    atbWrap.appendChild(h('span', { class: 'atb-label' }, 'ATB'));
    const atbBar = h('div', { class: 'atb-bar' });
    const atbFill = h('div', { class: 'fill atb-fill' });
    atbFill.style.width = atbPct + '%';
    atbBar.appendChild(atbFill);
    atbWrap.appendChild(atbBar);
    atbWrap.appendChild(h('span', { class: 'atb-pct' }, atbPct + '%'));
    body.appendChild(atbWrap);

    shell.appendChild(body);
    return shell;
  }

  function renderAtb(ctx) {
    const b = ctx.state.battle;
    if (!b) return;
    C.allUnits(b).forEach(u => {
      const node = document.getElementById('unit-' + u.id);
      if (!node) return;
      // Update shell-level state classes for CSS targeting
      const shell = node;
      if (shell) {
        shell.classList.toggle('acting', !!(b.acting && b.acting.id === u.id));
        const isDead = !C.isAlive(u);
        shell.classList.toggle('dead', isDead);
        shell.classList.toggle('atb-ready', u.atb >= 100);
        // Hide dead units once their death-drop animation is done (.dying gone).
        // Inline !important beats any CSS rule that might still set display: flex.
        if (isDead && !shell.classList.contains('dying')) {
          shell.style.setProperty('display', 'none', 'important');
        } else if (!isDead) {
          // Restore display when a unit comes back to life (revive, etc.)
          shell.style.removeProperty('display');
        }
      }
      // ATB fill width
      const atbPct = Math.round(Math.min(100, u.atb));
      const atbFill = node.querySelector('.atb-fill');
      if (atbFill) atbFill.style.width = `${atbPct}%`;
      // ATB state classes: .ready at 100%, .soon at 75-99% for early-warning glow
      const atbWrap = node.querySelector('.atb-wrap');
      if (atbWrap) {
        atbWrap.classList.toggle('ready', u.atb >= 100);
        atbWrap.classList.toggle('soon', u.atb >= 75 && u.atb < 100);
      }
      // Live percent label
      const atbPctEl = node.querySelector('.atb-pct');
      if (atbPctEl) atbPctEl.textContent = atbPct + '%';
      // HP danger pulse: toggle on hp fill when critically low
      const hpFill = node.querySelector('.hp-bar .fill');
      if (hpFill) hpFill.classList.toggle('danger', C.isAlive(u) && (u.hp / u.maxHp) < 0.3);
    });
    // Incrementally update bottom hero HUD (ATB fill + HP bar + acting/dead classes).
    // Runs on every tick so ATB percentages stay live without a full renderBattle.
    (b.ally || []).forEach(u => {
      const hudCard = document.getElementById('hud-' + u.id);
      if (!hudCard) return;
      // Dead / acting highlight
      hudCard.classList.toggle('dead',   !C.isAlive(u));
      hudCard.classList.toggle('acting', !!(b.acting && b.acting.id === u.id));
      // ATB bar fill + label
      const hudAtbFill = document.getElementById('hud-atb-fill-' + u.id);
      if (hudAtbFill) hudAtbFill.style.width = Math.round(Math.min(100, u.atb || 0)) + '%';
      const hudAtbVal = document.getElementById('hud-atb-val-' + u.id);
      if (hudAtbVal) hudAtbVal.textContent = Math.round(Math.min(100, u.atb || 0)) + '%';
      // HP bar fill + value (updated here so rapid AoE hits reflect immediately)
      const hpPct = Math.max(0, Math.min(100, (u.hp / Math.max(1, u.maxHp)) * 100));
      const hudHpFill = document.getElementById('hud-hp-fill-' + u.id);
      if (hudHpFill) {
        hudHpFill.style.width = hpPct + '%';
        hudHpFill.classList.toggle('low', hpPct < 30);
      }
      const hudHpVal = document.getElementById('hud-hp-val-' + u.id);
      if (hudHpVal) hudHpVal.textContent = String(Math.max(0, Math.floor(u.hp)));
    });
  }

  function renderLog(ctx) {
    const log = document.getElementById('battle-log');
    if (!log || !ctx.state.battle) return;
    const all = ctx.state.battle.log;
    const window12 = all.slice(-12);
    const prevCount = log._renderedCount || 0;
    // If window shifted (old entries scrolled out) or first render, rebuild without animation.
    const needRebuild = log.innerHTML === '' || (all.length - 12 > (log._logOffset || 0));
    if (needRebuild) {
      log.innerHTML = '';
      log._logOffset = Math.max(0, all.length - 12);
      log._renderedCount = window12.length;
      window12.forEach(entry => log.appendChild(h('div', { class: 'log-entry', html: entry })));
    } else {
      // Append only new entries with slide-in animation.
      const alreadyShown = log._renderedCount || 0;
      window12.slice(alreadyShown).forEach(entry => {
        const el = h('div', { class: 'log-entry log-entry-new', html: entry });
        log.appendChild(el);
        // Remove animation class after it plays so re-layout is clean.
        el.addEventListener('animationend', () => el.classList.remove('log-entry-new'), { once: true });
      });
      log._renderedCount = window12.length;
    }
    log.scrollTop = log.scrollHeight;
  }

  function renderSkillPanel(ctx) {
    const mount = document.getElementById('skill-panel-mount');
    if (!mount) return;
    mount.innerHTML = '';
    const b = ctx.state.battle;
    if (!b) return;
    const isAllyTurn = !!(b.acting && b.acting.side === 'ally' && !b.result);
    const fallback = b.lastActingAlly || (b.ally && b.ally.find(C.isAlive)) || (b.ally && b.ally[0]);
    const caster = isAllyTurn ? b.acting : fallback;
    if (!caster) return;
    const readOnly = !isAllyTurn || ctx.state.autoBattle;
    const panel = h('div', { class: 'skills-panel' + (readOnly ? ' read-only' : '') });
    if (isAllyTurn && b.pendingSkill) {
      const banner = h('div', { class: 'targeting-banner' });
      banner.innerHTML = `Select a target for <strong>${D.SKILLS[b.pendingSkill].name}</strong>`;
      const cancelBtn = h('button', { class: 'btn-nav btn-cancel', onclick: () => {
        b.pendingSkill = null;
        renderBattle(document.getElementById('app'), ctx);
      } }, 'Cancel');
      banner.appendChild(cancelBtn);
      panel.appendChild(banner);
    } else {
      const label = h('div', { class: 'acting-label' });
      let labelHtml;
      if (isAllyTurn) labelHtml = `Choose a skill for <strong>${caster.name}</strong>`;
      else if (ctx.state.autoBattle) labelHtml = `<strong>${caster.name}</strong> · auto-battle`;
      else if (b.acting && b.acting.side === 'enemy') labelHtml = `<strong>${b.acting.name}</strong> is acting…`;
      else labelHtml = `<strong>${caster.name}</strong>'s skills`;
      label.innerHTML = labelHtml;
      panel.appendChild(label);
    }
    const grid = h('div', { class: 'skills-grid' });
    caster.skills.forEach(sid => {
      const sk = D.SKILLS[sid];
      const cd = caster.cooldowns[sid] || 0;
      const onCd = cd > 0;
      const btn = h('button', { class: 'skill-btn' + (onCd ? ' on-cooldown' : '') });
      btn.disabled = readOnly || onCd;
      btn.appendChild(h('div', { class: 'skill-name' }, sk.name));
      btn.appendChild(h('div', { class: 'skill-desc' }, sk.desc));
      if (onCd) btn.appendChild(h('span', { class: 'cd-tag' }, `Cooldown ${cd}`));
      else if (sk.cd) btn.appendChild(h('span', { class: 'cd-tag', style: 'background:rgba(110,231,255,0.15);color:var(--cyan);' }, `CD ${sk.cd}`));
      btn.addEventListener('click', () => { if (!readOnly && !onCd) ctx.onSkillPick(caster, sid); });
      grid.appendChild(btn);
    });
    panel.appendChild(grid);
    mount.appendChild(panel);
  }

  function canTarget(unit, skillId, b) {
    if (!b.acting) return false;
    const sk = D.SKILLS[skillId];
    if (!sk || !C.isAlive(unit)) return false;
    if (sk.target === 'enemy') return unit.side !== b.acting.side;
    if (sk.target === 'ally') return unit.side === b.acting.side;
    return false;
  }

  function showResult(app, ctx) {
    const b = ctx.state.battle;
    const overlay = h('div', { class: 'modal-bg' });
    const modal = h('div', { class: 'modal' });
    const AU = window.GAME_AUDIO;
    if (b.result === 'victory') {
      if (AU) AU.play('victory'); capcomStamp('VICTORY!', 'victory', 1600);
      modal.appendChild(h('h2', { class: 'victory-title' }, 'Victory!'));
      if (b.rewards && b.rewards.firstClear) {
        modal.appendChild(h('div', { class: 'first-clear-badge' }, '★ Stage Cleared for the First Time!'));
      }
      modal.appendChild(h('p', null, 'Your team prevails. The Aether stirs in your favor.'));
      if (b.rewards) {
        const rwd = h('div', { class: 'reward-block' });
        rwd.appendChild(h('div', { class: 'reward-title' }, 'Rewards'));
        const rline = h('div', { class: 'reward-line' });
        rline.appendChild(h('span', { class: 'cur cur-crystal' }, [
          h('span', { class: 'cur-icon' }, '◆'),
          h('span', { class: 'cur-val' }, '+' + fmt(b.rewards.crystals)),
        ]));
        if (b.rewards.scrolls > 0) {
          rline.appendChild(h('span', { class: 'cur cur-scroll' }, [
            h('span', { class: 'cur-icon' }, '✦'),
            h('span', { class: 'cur-val' }, '+' + fmt(b.rewards.scrolls)),
          ]));
        }
        rwd.appendChild(rline);
        const p = ctx.state.player;
        if (p) {
          const totals = h('div', { class: 'reward-totals' });
          totals.appendChild(h('span', { class: 'reward-tot-label' }, 'Total'));
          totals.appendChild(h('span', { class: 'cur cur-crystal small' }, [
            h('span', { class: 'cur-icon' }, '◆'),
            h('span', { class: 'cur-val' }, fmt(p.crystals)),
          ]));
          totals.appendChild(h('span', { class: 'cur cur-scroll small' }, [
            h('span', { class: 'cur-icon' }, '✦'),
            h('span', { class: 'cur-val' }, fmt(p.scrolls)),
          ]));
          rwd.appendChild(totals);
        }
        // XP earned per hero
        if (b.rewards.xp) {
          rwd.appendChild(h('div', { class: 'reward-xp' }, '⚡ +' + b.rewards.xp + ' XP per hero'));
        }
        // Level-up notifications
        if (b.rewards.levelUps && b.rewards.levelUps.length > 0) {
          b.rewards.levelUps.forEach(lu => {
            const luHero = D.heroById(lu.heroId);
            const luName = luHero ? luHero.name : lu.heroId;
            rwd.appendChild(h('div', { class: 'reward-levelup' },
              '⬆ ' + luName + ' reached Level ' + lu.newLevel + '!'));
          });
        }
        // Win streak badge
        if (b.rewards.winStreak && b.rewards.winStreak >= 2) {
          rwd.appendChild(h('div', { class: 'reward-levelup', style: 'color:var(--warn);margin-top:6px;' },
            '🔥 ' + b.rewards.winStreak + '-Win Streak!'));
        }
        // Rune drop notification
        if (b.rewards.rune) {
          const rune = b.rewards.rune;
          const rt = D.RUNE_TYPES && D.RUNE_TYPES[rune.type];
          const icon = rt ? rt.icon : '💎';
          const color = rt ? rt.color : 'var(--gold)';
          const stars = '★'.repeat(rune.stars);
          const lbl = D.RUNE_STAT_LABEL ? D.RUNE_STAT_LABEL[rune.mainStat] : rune.mainStat;
          rwd.appendChild(h('div', { class: 'reward-rune', style: 'color:' + color + ';margin-top:6px;border-top:1px dashed rgba(255,255,255,0.08);padding-top:6px;' },
            icon + ' Rune dropped: ' + (rt ? rt.name : rune.type) + ' [Slot ' + rune.slot + '] ' + stars + ' · +' + Math.round(rune.mainPct * 100) + '% ' + lbl));
        }
        // Quest completion callout — celebrate quests that just finished
        if (b.rewards.completedQuests && b.rewards.completedQuests.length > 0) {
          const questBlock = h('div', { class: 'reward-quests-block' });
          b.rewards.completedQuests.forEach(function(label) {
            questBlock.appendChild(h('div', { class: 'reward-quest-done' }, '★ Quest Complete: ' + label));
          });
          rwd.appendChild(questBlock);
        }
        modal.appendChild(rwd);
      }
    } else {
      if (AU) AU.play('defeat'); capcomStamp('DEFEAT', 'defeat', 1600);
      modal.appendChild(h('h2', { class: 'defeat-title' }, 'Defeated'));
      modal.appendChild(h('p', null, 'Your team has fallen. Regroup and try again.'));
      const survivors = b.enemy.filter(C.isAlive);
      if (survivors.length) {
        const survBlock = h('div', { class: 'defeat-survivors' });
        survBlock.appendChild(h('div', { class: 'defeat-surv-label' }, 'Still standing:'));
        const survRow = h('div', { class: 'defeat-surv-row' });
        survivors.forEach(u => {
          const cell = h('div', { class: 'defeat-surv-cell' });
          cell.appendChild(h('div', { class: 'defeat-surv-portrait', html: A.renderPortrait(u) }));
          const pct = Math.round((u.hp / u.maxHp) * 100);
          const hpColor = pct > 60 ? 'var(--good)' : pct > 30 ? 'var(--warn)' : 'var(--bad)';
          cell.appendChild(h('div', { class: 'defeat-surv-name' }, u.name));
          cell.appendChild(h('div', { class: 'defeat-surv-hp', style: 'color:' + hpColor + ';' }, pct + '% HP'));
          survRow.appendChild(cell);
        });
        survBlock.appendChild(survRow);
        modal.appendChild(survBlock);
      }
    }
    const actions = h('div', { class: 'modal-actions' });
    actions.appendChild(h('button', { class: 'btn', onclick: () => {
      overlay.remove();
      ctx.rebattle ? ctx.rebattle() : ctx.navigate('team-select');
    } }, b.result === 'victory' ? 'Battle Again' : 'Retry'));
    actions.appendChild(h('button', { class: 'btn-secondary', onclick: () => {
      overlay.remove(); ctx.navigate('stage-select');
    } }, 'Pick Stage'));
    actions.appendChild(h('button', { class: 'btn-nav', onclick: () => {
      overlay.remove(); ctx.navigate('title');
    } }, 'Main Menu'));
    modal.appendChild(actions);
    overlay.appendChild(modal);
    app.appendChild(overlay);
  }

  // ===== COMBAT FEEL (M-Combat-Feel) =====
  // Trigger a screen shake on the whole battle field.
  function shakeField(intensity) {
    const field = document.getElementById('battle-field');
    if (!field) return;
    const cls = 'shake-' + (intensity || 'small');
    field.classList.remove('shake-small', 'shake-big', 'shake-crit');
    void field.offsetWidth;
    field.classList.add(cls);
    setTimeout(() => field.classList.remove(cls), 360);
  }
  // Brief visual hit-stop — CSS pauses animations for a beat.
  function hitStop(ms) {
    const field = document.getElementById('battle-field');
    if (!field) return;
    field.classList.add('hit-stop');
    setTimeout(() => field.classList.remove('hit-stop'), ms || 70);
  }

  // Cooldown guard: prevent multiple CRITICAL!/KO stamps from stacking when
  // a multi-hit or AOE skill crits several targets in the same action.
  let _critStampLastMs = 0;
  // Rolling popup offset so rapid hits on the same target fan out instead of stacking.
  // Each call picks a fresh horizontal jitter within the unit card width.
  let _popupXSeed = 0;
  function showPopup(unit, text, kind, offsetY) {
    const fx = document.getElementById('fx-' + unit.id);
    if (!fx) return;
    const el = h('div', { class: 'popup ' + (kind || 'dmg') }, text);
    // Spread: cycle through 5 horizontal slots (0%, 20%, 40%, 60%, 80% of unit width)
    // so back-to-back hits always land in different spots.
    _popupXSeed = (_popupXSeed + 1) % 5;
    const slots = [20, 40, 60, 80, 50];
    el.style.left = slots[_popupXSeed] + '%';
    if (offsetY) el.style.top = offsetY + 'px';
    fx.appendChild(el);
    setTimeout(() => el.remove(), 1000);

    const AU = window.GAME_AUDIO;
    if (kind === 'crit') {
      if (AU) AU.play('hit_crit');
      shakeField('crit'); hitStop(80);
      const now = Date.now();
      if (now - _critStampLastMs > 900) { _critStampLastMs = now; capcomStamp('CRITICAL!', 'crit', 700); }
    }
    else if (kind === 'strong') { if (AU) AU.play('hit_strong'); shakeField('big');  hitStop(50); }
    else if (kind === 'weak')   { if (AU) AU.play('hit_weak'); }
    else if (kind === 'dmg')    { if (AU) AU.play('hit_normal'); shakeField('small'); }
    else if (kind === 'heal')   { if (AU) AU.play('heal'); }

    // Death drop: if this hit dropped a unit to 0 HP, drop them once.
    if ((kind === 'dmg' || kind === 'crit') && unit.hp === 0 && !unit._dyingAnimDone) {
      unit._dyingAnimDone = true;
      const node = document.getElementById('unit-' + unit.id);
      if (node) {
        setTimeout(() => {
          node.classList.add('dying');
          if (AU) { AU.play('unit_die'); AU.play('ko_stamp'); }
          capcomStamp('K.O.!', 'ko', 900);
          // Slow-mo: desaturate the field during the lethal hitstop
          const _field = document.getElementById('battle-field');
          if (_field) {
            _field.classList.add('ko-slowmo');
            setTimeout(function () { _field.classList.remove('ko-slowmo'); }, 700);
          }
          setTimeout(() => node.classList.remove('dying'), 600);
        }, 120);
      }
    }
  }

  // Element burst — a brief coloured ring on the target unit when an elemental
  // advantage hit lands. Called from game.js as U.elementBurst(target, attackerElement).
  // Uses the `.element-burst.el-<element>` CSS classes already defined in style.css.
  function elementBurst(unit, element) {
    const fx = document.getElementById('fx-' + unit.id);
    if (!fx) return;
    const ring = document.createElement('div');
    ring.className = 'element-burst el-' + (element || 'fire');
    fx.appendChild(ring);
    setTimeout(() => ring.remove(), 500);
  }

  function animateUnit(unit, animClass, cb) {
    const shell = document.getElementById('unit-' + unit.id);
    if (!shell) { if (cb) cb(); return; }
    const body = shell.querySelector('.unit-body') || shell;
    // Determine direction-aware class
    let cls = animClass;
    if (animClass === 'lunge-strike' || animClass === 'lunge' || animClass === 'attack-anim') {
      cls = unit.side === 'ally' ? 'lunge-ally' : 'lunge-enemy';
    }
    // Two-phase windup for lunge animations
    if (animClass === 'lunge' || animClass === 'lunge-strike' || animClass === 'attack-anim') {
      const elColors = (unit.element && A.ELEMENT_COLORS && A.ELEMENT_COLORS[unit.element]) || null;
      if (elColors) shell.style.setProperty('--windup-color', elColors.aura);
      body.classList.remove('lunge-ally', 'lunge-enemy', 'flash', 'windup');
      void body.offsetWidth;
      body.classList.add('windup');
      const AU = window.GAME_AUDIO;
      if (AU) { AU.play('skill_cast'); setTimeout(function(){ AU.play('kiai'); }, 40); }
      setTimeout(() => {
        body.classList.remove('windup');
        void body.offsetWidth;
        body.classList.add(cls);
        let done = false;
        const onEnd = () => {
          if (done) return;
          done = true;
          body.classList.remove(cls);
          body.removeEventListener('animationend', onEnd);
          if (cb) cb();
        };
        body.addEventListener('animationend', onEnd);
        setTimeout(() => { if (!done) onEnd(); }, 400);
      }, 180);
    } else {
      body.classList.remove(cls);
      void body.offsetWidth;
      body.classList.add(cls);
      let done = false;
      const onEnd = () => {
        if (done) return;
        done = true;
        body.classList.remove(cls);
        body.removeEventListener('animationend', onEnd);
        if (cb) cb();
      };
      body.addEventListener('animationend', onEnd);
      // Fallback: if animationend never fires (reduced-motion, display:none, etc.)
      setTimeout(() => { if (!done) onEnd(); }, 700);
    }
  }

  // ===== SUMMON =====
  const RARITY_THEME = {
    3: { name: '3★ Common',    color: '#5ab9ff', glow: 'rgba(110,231,255,0.55)' },
    4: { name: '4★ Rare',      color: '#c084ff', glow: 'rgba(192,132,255,0.65)' },
    5: { name: '5★ Legendary', color: '#ffb84d', glow: 'rgba(255,184,77,0.75)' },
  };

  function renderSummon(app, ctx) {
    app.innerHTML = '';
    const cb = renderCurrencyBar(ctx);
    if (cb) app.appendChild(cb);
    const header = h('div', { class: 'screen-header' });
    const tw = h('div', null);
    tw.appendChild(h('h2', null, 'Summon Heroes'));
    tw.appendChild(h('div', { class: 'subtitle' }, 'Channel the Aether to call new champions. Rates: 75% / 20% / 5% (3★ / 4★ / 5★).'));
    header.appendChild(tw);
    header.appendChild(backButton(ctx));
    app.appendChild(header);
    const SUM = window.GAME_SUMMON;
    const banner = h('div', { class: 'summon-banner' });
    banner.innerHTML = '<div class="orb-bg"></div><div class="banner-text"><div class="banner-name">The Aether Gate</div><div class="banner-sub">Standard Summon</div></div>';
    app.appendChild(banner);
    const p = ctx.state.player;
    const meta = h('div', { class: 'summon-meta' });
    const pityCount = Math.max(0, Math.min(SUM.PITY_THRESHOLD, p.pityCount | 0));
    const pityRemaining = Math.max(0, SUM.PITY_THRESHOLD - pityCount);
    const pityPct = Math.min(100, Math.round((pityCount / SUM.PITY_THRESHOLD) * 100));
    const pityClose = pityRemaining <= 5;
    meta.innerHTML = `<div><span class="meta-key">Total summons</span><span class="meta-val">${p.totalSummons}</span></div>
<div><span class="meta-key">Pity in</span><span class="meta-val">${pityRemaining} pulls</span></div>`;
    app.appendChild(meta);
    // Visible pity progress bar — retention-loop signal for the player.
    const pityBar = h('div', { class: 'pity-bar' + (pityClose ? ' close' : '') });
    pityBar.innerHTML = `<div class="pity-bar-label"><span>5★ Guarantee</span><span class="pity-bar-count">${pityCount} / ${SUM.PITY_THRESHOLD}</span></div>
<div class="pity-bar-track"><div class="pity-bar-fill" style="width:${pityPct}%"></div></div>`;
    app.appendChild(pityBar);
    const actions = h('div', { class: 'summon-actions' });
    const canSingleC = p.crystals >= SUM.COST_SINGLE_CRYSTALS;
    const canSingleS = p.scrolls >= 1;
    const canTen = p.crystals >= SUM.COST_TEN_CRYSTALS;
    const singleC = h('button', { class: 'summon-btn' + (canSingleC ? '' : ' off'), onclick: () => doSinglePull(ctx, 'crystal') });
    singleC.innerHTML = `<div class="sb-title">Single Pull</div><div class="sb-cost"><span class="cost-icon cur-crystal">◆</span> ${SUM.COST_SINGLE_CRYSTALS}</div>`;
    singleC.disabled = !canSingleC;
    actions.appendChild(singleC);
    const singleS = h('button', { class: 'summon-btn' + (canSingleS ? '' : ' off'), onclick: () => doSinglePull(ctx, 'scroll') });
    singleS.innerHTML = `<div class="sb-title">Single Pull</div><div class="sb-cost"><span class="cost-icon cur-scroll">✦</span> 1 Scroll</div>`;
    singleS.disabled = !canSingleS;
    actions.appendChild(singleS);
    const ten = h('button', { class: 'summon-btn ten' + (canTen ? '' : ' off'), onclick: () => doTenPull(ctx) });
    ten.innerHTML = `<div class="sb-title">10-Pull</div><div class="sb-cost"><span class="cost-icon cur-crystal">◆</span> ${SUM.COST_TEN_CRYSTALS}</div><div class="sb-bonus">4★+ guaranteed</div>`;
    ten.disabled = !canTen;
    actions.appendChild(ten);
    app.appendChild(actions);
    if (!canSingleC && !canSingleS && !canTen) {
      const nudge = h('div', { class: 'summon-nudge' });
      nudge.appendChild(h('span', { class: 'summon-nudge-text' }, 'Need more crystals? '));
      const shopLink = h('button', { class: 'btn-link', onclick: () => ctx.navigate('shop') }, '🛒 Visit the Shop');
      nudge.appendChild(shopLink);
      app.appendChild(nudge);
    }
    const note = h('div', { class: 'summon-note' });
    note.innerHTML = `Pity system: a 5★ hero is guaranteed within ${SUM.PITY_THRESHOLD} pulls.`;
    app.appendChild(note);
  }

  function doSinglePull(ctx, currency) {
    const SUM = window.GAME_SUMMON;
    const S = window.GAME_SAVE;
    const p = ctx.state.player;
    if (!SUM.chargeSingle(p, currency)) { toast('Not enough ' + (currency === 'scroll' ? 'scrolls' : 'crystals') + '.'); return; }
    const result = SUM.performPull(p);
    if (S && S.progressQuest) S.progressQuest(p, 'summon', 1);
    if (ctx.persistNow) ctx.persistNow();
    showReveal([result], ctx);
  }
  function doTenPull(ctx) {
    const SUM = window.GAME_SUMMON;
    const S = window.GAME_SAVE;
    const p = ctx.state.player;
    if (!SUM.chargeTen(p)) { toast('Not enough crystals.'); return; }
    const results = SUM.performTenPull(p);
    if (S && S.progressQuest) S.progressQuest(p, 'summon', results.length);
    if (ctx.persistNow) ctx.persistNow();
    showReveal(results, ctx);
  }

  function showReveal(results, ctx) {
    const overlay = h('div', { class: 'reveal-overlay' });
    document.body.appendChild(overlay);
    const isTen = results.length > 1;

    // Click-anywhere-to-dismiss is armed after the reveal animation completes,
    // so the triggering click does not immediately close the overlay.
    let dismissArmed = false;
    function armDismiss() {
      if (dismissArmed) return;
      dismissArmed = true;
      overlay.style.cursor = 'pointer';
      overlay.addEventListener('click', () => { overlay.remove(); ctx.navigate('summon'); });
    }
    function tapHint() {
      return h('div', { class: 'reveal-hint' }, 'Tap anywhere to continue');
    }
    function showSummary() {
      overlay.innerHTML = '';
      const wrap = h('div', { class: 'reveal-summary' });
      wrap.appendChild(h('h2', null, isTen ? '10-Pull Results' : 'Summon Result'));
      const grid = h('div', { class: 'reveal-grid' });
      results.forEach((r, idx) => {
        const cell = h('div', { class: `reveal-cell rarity-${r.rarity} stagger-in` });
        cell.style.animationDelay = (idx * 70) + 'ms';
        if (r.isNew) cell.appendChild(h('div', { class: 'new-badge' }, 'NEW'));
        cell.appendChild(h('div', { class: 'portrait', html: A.renderPortrait(r.hero) }));
        cell.appendChild(h('div', { class: 'reveal-name' }, r.hero.name));
        cell.appendChild(h('div', { class: 'reveal-stars' }, A.renderStars(r.rarity)));
        if (r.pityActivated) cell.appendChild(h('div', { class: 'reveal-tag pity' }, 'PITY'));
        else if (r.guaranteedFourPlus) cell.appendChild(h('div', { class: 'reveal-tag guaranteed' }, 'BONUS'));
        grid.appendChild(cell);
      });
      wrap.appendChild(grid);
      wrap.appendChild(tapHint());
      overlay.appendChild(wrap);
      // Arm dismiss after all stagger-in cards have landed
      setTimeout(armDismiss, 300 + results.length * 70);
    }
    function showBatchIntro() {
      const bestRarity = results.reduce((m, r) => Math.max(m, r.rarity), 3);
      const theme = RARITY_THEME[bestRarity];
      overlay.innerHTML = '';
      const stage = h('div', { class: `reveal-stage rarity-${bestRarity} batch-intro` });
      stage.style.setProperty('--rarity-color', theme.color);
      stage.style.setProperty('--rarity-glow', theme.glow);
      for (let i = 0; i < 10; i++) {
        const o = h('div', { class: 'reveal-orb batch-orb' });
        o.style.animationDelay = (i * 40) + 'ms';
        const angle = (i / 10) * Math.PI * 2;
        const r2 = 80;
        o.style.left = `calc(50% + ${Math.cos(angle) * r2}px)`;
        o.style.top = `calc(50% + ${Math.sin(angle) * r2}px)`;
        stage.appendChild(o);
      }
      stage.appendChild(h('div', { class: 'batch-label' }, '10 Heroes Incoming!'));
      overlay.appendChild(stage);
      const AU = window.GAME_AUDIO; if (AU) AU.play('summon_pop');
      setTimeout(() => showSummary(), 850);
    }
    function revealOne(idx) {
      const r = results[idx];
      const theme = RARITY_THEME[r.rarity];
      overlay.innerHTML = '';
      const stage = h('div', { class: `reveal-stage rarity-${r.rarity}` });
      stage.style.setProperty('--rarity-color', theme.color);
      stage.style.setProperty('--rarity-glow', theme.glow);
      const orb = h('div', { class: 'reveal-orb' });
      stage.appendChild(orb);
      overlay.appendChild(stage);
      setTimeout(() => {
        const silh = h('div', { class: 'reveal-silhouette', html: A.renderPortrait(r.hero) });
        stage.appendChild(silh);
        setTimeout(() => {
          orb.classList.add('burst');
          const card = h('div', { class: `reveal-card rarity-${r.rarity}` });
          if (r.isNew) card.appendChild(h('div', { class: 'new-badge' }, 'NEW'));
          card.appendChild(h('div', { class: 'portrait', html: A.renderPortrait(r.hero) }));
          card.appendChild(h('div', { class: 'reveal-rarity-label' }, theme.name));
          card.appendChild(h('div', { class: 'reveal-name' }, r.hero.name));
          card.appendChild(h('div', { class: 'reveal-stars' }, A.renderStars(r.rarity)));
          if (r.pityActivated) card.appendChild(h('div', { class: 'reveal-tag pity' }, 'PITY'));
          else if (r.guaranteedFourPlus) card.appendChild(h('div', { class: 'reveal-tag guaranteed' }, 'BONUS'));
          card.classList.add('card-land');
          stage.appendChild(card);
          stage.appendChild(tapHint());
          setTimeout(armDismiss, 400);
        }, 350);
      }, 280);
    }
    if (isTen) showBatchIntro();
    else revealOne(0);
  }


  // ----- Daily login bonus modal -----
  function showDailyBonus(bonus, ctx) {
    const overlay = h('div', { class: 'result-overlay' });
    const box = h('div', { class: 'result-box' });
    box.appendChild(h('div', { class: 'result-title' }, '☀️ Daily Login Bonus'));
    const streak = bonus.streak || 1;
    box.appendChild(h('div', { class: 'result-subtitle', style: 'color:var(--gold);margin-bottom:12px;' },
      streak > 1 ? streak + '-Day Streak!' : 'Welcome back!'));
    const rwds = h('div', { class: 'result-rewards' });
    const crystalRow = h('div', { class: 'reward-row' });
    crystalRow.appendChild(h('span', { class: 'reward-icon' }, '\u{1F48E}'));
    crystalRow.appendChild(h('span', { class: 'reward-amt' }, '+' + bonus.crystals + ' Crystals'));
    rwds.appendChild(crystalRow);
    if (bonus.scrolls > 0) {
      const scrollRow = h('div', { class: 'reward-row' });
      scrollRow.appendChild(h('span', { class: 'reward-icon' }, '\u{1F4DC}'));
      scrollRow.appendChild(h('span', { class: 'reward-amt' }, '+' + bonus.scrolls + ' Scroll' + (bonus.scrolls > 1 ? 's' : '')));
      rwds.appendChild(scrollRow);
    }
    box.appendChild(rwds);
    const btn = h('button', { class: 'btn-primary', style: 'margin-top:18px;' }, 'Claim');
    btn.onclick = function () { overlay.remove(); };
    box.appendChild(btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // ----- Reusable in-game confirm modal -----
  // showConfirm(title, body, confirmLabel, onConfirm)
  // Renders a small centered modal; calls onConfirm() if the player taps the
  // confirm button, removes itself on cancel or backdrop click.
  function showConfirm(title, body, confirmLabel, onConfirm) {
    const overlay = h('div', { class: 'modal-bg' });
    const modal   = h('div', { class: 'modal confirm-modal' });
    modal.appendChild(h('h3', { class: 'confirm-title' }, title));
    if (body) modal.appendChild(h('p',  { class: 'confirm-body'  }, body));
    const actions = h('div', { class: 'modal-actions' });
    const okBtn = h('button', { class: 'btn', onclick: function () {
      overlay.remove();
      if (onConfirm) onConfirm();
    }}, confirmLabel || 'Confirm');
    const cancelBtn = h('button', { class: 'btn-nav', onclick: function () { overlay.remove(); } }, 'Cancel');
    actions.appendChild(okBtn);
    actions.appendChild(cancelBtn);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  // ----- Shop screen -----
  const SHOP_CRYSTAL_PACKS = [
    { id: 'pack_starter', name: 'Starter Pack',  amount: 500,  price: '$0.99', icon: '\u{1F48E}', badge: null,         featured: false },
    { id: 'pack_medium',  name: 'Crystal Trove', amount: 1200, price: '$1.99', icon: '\u{1F48E}', badge: null,         featured: false },
    { id: 'pack_mega',    name: 'Mega Cache',    amount: 3000, price: '$4.99', icon: '\u{1F48E}', badge: 'BEST VALUE', featured: true,
      bonus: '+600 Bonus Crystals' },
  ];
  const SHOP_SCROLL_PACKS = [
    { id: 'scroll_1', name: 'Summon Scroll',   scrolls: 1, price: '$0.99', icon: '\u{1F4DC}' },
    { id: 'scroll_5', name: '5-Scroll Bundle', scrolls: 5, price: '$3.99', icon: '\u{1F4DC}', badge: 'SAVE 20%' },
  ];

  function renderShop(app, ctx) {
    app.innerHTML = '';
    const cb = renderCurrencyBar(ctx);
    if (cb) app.appendChild(cb);
    const header = h('div', { class: 'screen-header' });
    header.appendChild(h('h2', null, '\u{1F6D2} Shop'));
    header.appendChild(backButton(ctx));
    app.appendChild(header);

    const screen = h('div', { class: 'shop-screen' });
    const S = window.GAME_SAVE;
    const p = ctx.state.player;

    // Free daily gift
    screen.appendChild(h('div', { class: 'shop-section-title' }, 'Free Gifts'));
    const freeRow = h('div', { class: 'shop-free-row' });
    const todayStr = S.getTodayStr ? S.getTodayStr() : '';
    const freeKey = 'aetherbound.shop.free.' + todayStr;
    const freeAlreadyClaimed = (typeof localStorage !== 'undefined') ? !!localStorage.getItem(freeKey) : false;
    const freeCard = h('div', { class: 'shop-free-card' + (freeAlreadyClaimed ? ' claimed' : '') });
    freeCard.appendChild(h('div', { class: 'shop-icon' }, '\u{1F381}'));
    freeCard.appendChild(h('div', { class: 'shop-name' }, 'Daily Gift'));
    freeCard.appendChild(h('div', { class: 'shop-amount' }, '250 Crystals'));
    freeCard.appendChild(h('div', { class: 'shop-price' }, freeAlreadyClaimed ? 'Claimed' : 'Claim Free'));
    if (!freeAlreadyClaimed) {
      freeCard.onclick = function () {
        S.addCrystals(p, 250);
        ctx.persistNow && ctx.persistNow();
        if (typeof localStorage !== 'undefined') localStorage.setItem(freeKey, '1');
        toast('+250 Crystals claimed!');
        renderShop(app, ctx);
      };
    }
    freeRow.appendChild(freeCard);
    const watchCard = h('div', { class: 'shop-free-card' });
    watchCard.appendChild(h('div', { class: 'shop-icon' }, '\u{1F4FA}'));
    watchCard.appendChild(h('div', { class: 'shop-name' }, 'Watch Ad'));
    watchCard.appendChild(h('div', { class: 'shop-amount' }, '100 Crystals'));
    watchCard.appendChild(h('div', { class: 'shop-price' }, 'Watch'));
    watchCard.onclick = function () { toast('No ad available right now. Try again later!'); };
    freeRow.appendChild(watchCard);
    screen.appendChild(freeRow);

    // Crystal packs
    screen.appendChild(h('div', { class: 'shop-section-title' }, 'Crystal Packs'));
    const crystalGrid = h('div', { class: 'shop-grid' });
    SHOP_CRYSTAL_PACKS.forEach(function (pack) {
      const card = h('div', { class: 'shop-card' + (pack.featured ? ' featured' : '') });
      if (pack.badge) card.appendChild(h('div', { class: 'shop-badge' }, pack.badge));
      card.appendChild(h('div', { class: 'shop-icon' }, pack.icon));
      card.appendChild(h('div', { class: 'shop-name' }, pack.name));
      card.appendChild(h('div', { class: 'shop-amount' }, pack.amount.toLocaleString() + ' Crystals'));
      if (pack.bonus) card.appendChild(h('div', { class: 'shop-bonus' }, pack.bonus));
      card.appendChild(h('div', { class: 'shop-price' }, pack.price));
      card.onclick = function () {
        const total = pack.amount + (pack.featured ? 600 : 0);
        showConfirm(
          pack.name,
          total.toLocaleString() + ' Crystals · ' + pack.price + ' (demo: free)',
          'Purchase',
          function () {
            S.addCrystals(p, total);
            ctx.persistNow && ctx.persistNow();
            toast('+' + total.toLocaleString() + ' Crystals added!');
            renderShop(app, ctx);
          }
        );
      };
      crystalGrid.appendChild(card);
    });
    screen.appendChild(crystalGrid);

    // Scroll packs
    screen.appendChild(h('div', { class: 'shop-section-title' }, 'Summon Scrolls'));
    const scrollGrid = h('div', { class: 'shop-grid' });
    SHOP_SCROLL_PACKS.forEach(function (pack) {
      const card = h('div', { class: 'shop-card' });
      if (pack.badge) card.appendChild(h('div', { class: 'shop-badge' }, pack.badge));
      card.appendChild(h('div', { class: 'shop-icon' }, pack.icon));
      card.appendChild(h('div', { class: 'shop-name' }, pack.name));
      card.appendChild(h('div', { class: 'shop-amount' }, pack.scrolls + ' Scroll' + (pack.scrolls > 1 ? 's' : '')));
      card.appendChild(h('div', { class: 'shop-price' }, pack.price));
      card.onclick = function () {
        showConfirm(
          pack.name,
          pack.scrolls + ' Summon Scroll' + (pack.scrolls > 1 ? 's' : '') + ' · ' + pack.price + ' (demo: free)',
          'Purchase',
          function () {
            S.addScrolls(p, pack.scrolls);
            ctx.persistNow && ctx.persistNow();
            toast('+' + pack.scrolls + ' Scroll' + (pack.scrolls > 1 ? 's' : '') + ' added!');
            renderShop(app, ctx);
          }
        );
      };
      scrollGrid.appendChild(card);
    });
    screen.appendChild(scrollGrid);
    app.appendChild(screen);
  }

  // ===== RUNE SCREEN (M4 — functional) =====
  // State: which hero is selected and which slot is highlighted.
  let _runeHeroId   = null;
  let _runeSlotSel  = null; // 0-based slot index the player wants to fill
  let _runeSort     = 'slot'; // 'slot' | 'stars' | 'type' | 'stat'

  const RUNE_SORT_OPTIONS = [
    { key: 'slot',  label: 'Slot #',   cmp: (a, b) => (a.slot - b.slot) || (b.stars - a.stars) },
    { key: 'stars', label: 'Stars ★',  cmp: (a, b) => (b.stars - a.stars) || (a.slot - b.slot) },
    { key: 'type',  label: 'Set Type', cmp: (a, b) => a.type.localeCompare(b.type) || (b.stars - a.stars) },
    { key: 'stat',  label: 'Main Stat',cmp: (a, b) => a.mainStat.localeCompare(b.mainStat) || (b.stars - a.stars) },
  ];

  function renderRunes(app, ctx) {
    const S = window.GAME_SAVE;
    const p = ctx.state.player;
    const RUNE_TYPES = D.RUNE_TYPES;
    const STAT_LABEL = D.RUNE_STAT_LABEL || {};
    const RUNE_SLOTS = S.RUNE_SLOTS || 6;

    app.innerHTML = '';
    const cb = renderCurrencyBar(ctx);
    if (cb) app.appendChild(cb);

    const header = h('div', { class: 'screen-header' });
    header.appendChild(h('h2', null, '💎 Runes'));
    header.appendChild(backButton(ctx));
    app.appendChild(header);

    const screen = h('div', { class: 'runes-screen' });

    // ---- Hero picker ----
    const ownedIds = [...new Set((p.ownedInstances || []).map(i => i.id))];
    if (!_runeHeroId || !ownedIds.includes(_runeHeroId)) _runeHeroId = ownedIds[0] || null;

    if (!_runeHeroId) {
      screen.appendChild(h('div', { class: 'runes-empty-msg' }, 'You have no heroes yet. Summon some first!'));
      app.appendChild(screen);
      return;
    }

    screen.appendChild(h('div', { class: 'runes-section-title' }, 'Select Hero'));
    const picker = h('div', { class: 'rune-hero-picker' });
    ownedIds.forEach(function(hid) {
      const hero = D.heroById(hid);
      if (!hero) return;
      const equipped = S.getEquippedRunes(p, hid).filter(Boolean).length;
      const btn = h('div', {
        class: 'rune-hero-btn' + (hid === _runeHeroId ? ' selected' : ''),
        onclick: function() { _runeHeroId = hid; _runeSlotSel = null; renderRunes(app, ctx); },
      });
      btn.appendChild(h('div', { class: 'rune-hero-name' }, hero.name));
      btn.appendChild(h('div', { class: 'rune-hero-meta' }, equipped + '/' + RUNE_SLOTS + ' runes'));
      picker.appendChild(btn);
    });
    screen.appendChild(picker);

    // ---- Rune Slots (6 slots in a 3×2 grid) ----
    const hero = D.heroById(_runeHeroId);
    const equippedRunes = S.getEquippedRunes(p, _runeHeroId); // array of 6, may be null
    const boosts = S.getHeroRuneBoosts(p, _runeHeroId);

    // Compute active set bonuses
    const typeCounts = {};
    equippedRunes.forEach(function(r) { if (r) typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
    const activeSetLines = [];
    Object.entries(typeCounts).forEach(function([tid, count]) {
      const rt = RUNE_TYPES[tid];
      if (!rt) return;
      if (rt.set4 && count >= 4) {
        activeSetLines.push(rt.icon + ' ' + rt.name + ' (4): ' + rt.set4.stat.toUpperCase() + ' +' + Math.round(rt.set4.pct * 100) + '%');
        if (rt.set2 && rt.set2.stat !== rt.set4.stat)
          activeSetLines.push(rt.icon + ' ' + rt.name + ' (2): ' + rt.set2.stat.toUpperCase() + ' +' + Math.round(rt.set2.pct * 100) + '%');
      } else if (count >= 2 && rt.set2) {
        activeSetLines.push(rt.icon + ' ' + rt.name + ' (2): ' + rt.set2.stat.toUpperCase() + ' +' + Math.round(rt.set2.pct * 100) + '%');
      }
    });

    // Stat totals banner
    const statKeys = ['atk','def','hp','spd','critRate','critDmg'];
    const statHasBoost = statKeys.some(k => (boosts[k] || 0) > 0);
    if (statHasBoost) {
      const statBanner = h('div', { class: 'rune-stat-banner' });
      statKeys.forEach(function(k) {
        if (!boosts[k]) return;
        const lbl = STAT_LABEL[k] || k;
        const val = (k === 'critRate' || k === 'critDmg')
          ? '+' + Math.round(boosts[k] * 100) + '%'
          : '+' + Math.round(boosts[k] * 100) + '%';
        const pill = h('span', { class: 'rune-stat-pill' });
        pill.innerHTML = '<span class="rune-stat-key">' + lbl + '</span> <span class="rune-stat-val">' + val + '</span>';
        statBanner.appendChild(pill);
      });
      if (activeSetLines.length) {
        activeSetLines.forEach(function(line) {
          statBanner.appendChild(h('span', { class: 'rune-stat-pill set-bonus' }, line));
        });
      }
      screen.appendChild(statBanner);
    }

    screen.appendChild(h('div', { class: 'runes-section-title' }, hero.name + ' — Rune Slots'));
    const slotsGrid = h('div', { class: 'rune-slots-grid' });
    for (let i = 0; i < RUNE_SLOTS; i++) {
      const rune = equippedRunes[i];
      const rt = rune ? RUNE_TYPES[rune.type] : null;
      const isSelected = _runeSlotSel === i;
      const slotEl = h('div', {
        class: 'rune-slot' + (rune ? ' filled' : ' empty') + (isSelected ? ' selected' : ''),
        onclick: function() {
          _runeSlotSel = isSelected ? null : i;
          renderRunes(app, ctx);
        },
      });
      slotEl.appendChild(h('div', { class: 'rune-slot-num' }, 'Slot ' + (i + 1)));
      if (rune) {
        const stars = '★'.repeat(rune.stars);
        const color = rt ? rt.color : 'var(--gold)';
        const icon = rt ? rt.icon : '💎';
        slotEl.appendChild(h('div', { class: 'rune-slot-type', style: 'color:' + color }, icon + ' ' + (rt ? rt.name : rune.type)));
        slotEl.appendChild(h('div', { class: 'rune-slot-stars', style: 'color:' + color }, stars));
        const lbl = STAT_LABEL[rune.mainStat] || rune.mainStat;
        slotEl.appendChild(h('div', { class: 'rune-slot-main' }, '+' + Math.round(rune.mainPct * 100) + '% ' + lbl));
        if (rune.subStats && rune.subStats.length) {
          const subDiv = h('div', { class: 'rune-slot-subs' });
          rune.subStats.forEach(function(sub) {
            subDiv.appendChild(h('span', null, '+' + Math.round(sub.pct * 100) + '% ' + (STAT_LABEL[sub.stat] || sub.stat)));
          });
          slotEl.appendChild(subDiv);
        }
        const unequipBtn = h('button', {
          class: 'rune-unequip-btn',
          title: 'Unequip this rune',
          onclick: function(e) {
            e.stopPropagation();
            S.unequipRune(p, _runeHeroId, i);
            _runeSlotSel = null;
            ctx.persist && ctx.persist();
            renderRunes(app, ctx);
          },
        }, '✕');
        slotEl.appendChild(unequipBtn);
      } else {
        slotEl.appendChild(h('div', { class: 'rune-slot-empty-label' }, isSelected ? '← pick from below' : 'Empty'));
      }
      slotsGrid.appendChild(slotEl);
    }
    screen.appendChild(slotsGrid);

    // ---- Inventory ----
    screen.appendChild(h('div', { class: 'runes-section-title', style: 'margin-top:18px' },
      'Rune Inventory (' + (p.runeInventory || []).length + ')'));

    const inventory = (p.runeInventory || []);
    if (!inventory.length) {
      screen.appendChild(h('div', { class: 'runes-empty-msg' }, 'No runes yet. Win battles to find them!'));
    } else {
      // Sort dropdown for inventory
      const sortRow = h('div', { class: 'rune-inv-sort-row' });
      sortRow.appendChild(h('span', { class: 'rune-inv-sort-label' }, 'Sort:'));
      const sortSel = h('select', {
        class: 'sort-select',
        onchange: function(e) { _runeSort = e.target.value; renderRunes(app, ctx); },
      });
      RUNE_SORT_OPTIONS.forEach(function(opt) {
        const o = document.createElement('option');
        o.value = opt.key; o.textContent = opt.label;
        if (opt.key === _runeSort) o.selected = true;
        sortSel.appendChild(o);
      });
      sortRow.appendChild(sortSel);
      screen.appendChild(sortRow);

      // Filter inventory to only show runes matching selected slot (if any).
      const filterSlot = _runeSlotSel !== null ? _runeSlotSel + 1 : null;
      const filterNote = filterSlot ? h('div', { class: 'rune-filter-note' },
        'Showing Slot ' + filterSlot + ' runes. Tap any to equip it. Tap slot again to cancel.') : null;
      if (filterNote) screen.appendChild(filterNote);

      const filtered = filterSlot
        ? inventory.filter(function(r) { return r.slot === filterSlot; })
        : inventory;
      // Apply sort
      const sortOpt = RUNE_SORT_OPTIONS.find(function(o) { return o.key === _runeSort; }) || RUNE_SORT_OPTIONS[0];
      const shown = filtered.slice().sort(sortOpt.cmp);

      if (!shown.length && filterSlot) {
        screen.appendChild(h('div', { class: 'runes-empty-msg' }, 'No Slot ' + filterSlot + ' runes in bag. Win battles to find more!'));
      }

      const invGrid = h('div', { class: 'rune-inv-grid' });
      shown.forEach(function(rune) {
        const rt = RUNE_TYPES[rune.type];
        const color = rt ? rt.color : 'var(--gold)';
        const icon = rt ? rt.icon : '💎';
        const stars = '★'.repeat(rune.stars);
        // Is this rune equipped on the current hero?
        const equippedOnHero = equippedRunes.some(function(er) { return er && er.runeId === rune.runeId; });
        // Is it equipped on ANY hero?
        const equippedAnywhere = Object.values(p.heroRunes || {}).some(function(slots) {
          return slots && slots.includes(rune.runeId);
        });

        const card = h('div', {
          class: 'rune-inv-card' +
            (equippedOnHero ? ' equipped-here' : '') +
            (equippedAnywhere && !equippedOnHero ? ' equipped-elsewhere' : '') +
            (_runeSlotSel !== null ? ' selectable' : ''),
          style: 'border-color:' + color + '55',
          onclick: function() {
            if (_runeSlotSel === null) return; // no slot selected — clicking does nothing
            // equipRune returns the previously-equipped runeId in that slot (or null).
            // Only count this as quest progress if a NET change occurred — re-clicking
            // the already-slotted rune should not advance the "Equip N Runes" daily.
            const displaced = S.equipRune(p, _runeHeroId, rune.runeId);
            const netChange = (displaced !== rune.runeId);
            if (netChange && S.progressQuest) S.progressQuest(p, 'rune', 1);
            _runeSlotSel = null;
            ctx.persist && ctx.persist();
            renderRunes(app, ctx);
          },
        });
        const topRow = h('div', { class: 'rune-inv-top' });
        topRow.appendChild(h('span', { class: 'rune-inv-type', style: 'color:' + color }, icon + ' ' + (rt ? rt.name : rune.type)));
        topRow.appendChild(h('span', { class: 'rune-inv-stars', style: 'color:' + color }, stars));
        card.appendChild(topRow);
        card.appendChild(h('div', { class: 'rune-inv-slot' }, 'Slot ' + rune.slot));
        const lbl = STAT_LABEL[rune.mainStat] || rune.mainStat;
        card.appendChild(h('div', { class: 'rune-inv-main' }, '+' + Math.round(rune.mainPct * 100) + '% ' + lbl));
        if (rune.subStats && rune.subStats.length) {
          const subDiv = h('div', { class: 'rune-inv-subs' });
          rune.subStats.forEach(function(sub) {
            subDiv.appendChild(h('span', null, '+' + Math.round(sub.pct * 100) + '% ' + (STAT_LABEL[sub.stat] || sub.stat)));
          });
          card.appendChild(subDiv);
        }
        if (equippedOnHero) card.appendChild(h('div', { class: 'rune-inv-badge equipped' }, '✓ Equipped'));
        else if (equippedAnywhere) card.appendChild(h('div', { class: 'rune-inv-badge elsewhere' }, '• On ' + _getHeroNameForRune(p, rune.runeId)));

        // Delete button — only show when not in slot-select mode
        if (_runeSlotSel === null) {
          const delBtn = h('button', {
            class: 'rune-del-btn',
            title: 'Discard this rune',
            onclick: function(e) {
              e.stopPropagation();
              showConfirm(
                'Discard Rune?',
                'This rune will be permanently removed from your inventory.',
                'Discard',
                function () {
                  S.deleteRune(p, rune.runeId);
                  ctx.persist && ctx.persist();
                  renderRunes(app, ctx);
                }
              );
            },
          }, '🗑');
          card.appendChild(delBtn);
        }

        invGrid.appendChild(card);
      });
      screen.appendChild(invGrid);
    }

    // ---- Set bonus reference ----
    screen.appendChild(h('div', { class: 'runes-section-title', style: 'margin-top:18px' }, 'Set Bonuses'));
    const setGrid = h('div', { class: 'rune-set-grid' });
    Object.values(RUNE_TYPES).forEach(function(rt) {
      const card = h('div', { class: 'rune-set-card', style: 'border-color:' + rt.color + '44' });
      const nameRow = h('div', { class: 'rune-set-name', style: 'color:' + rt.color });
      nameRow.innerHTML = rt.icon + ' ' + rt.name;
      card.appendChild(nameRow);
      if (rt.set2) card.appendChild(h('div', { class: 'rune-set-bonus' },
        '2-piece: ' + (STAT_LABEL[rt.set2.stat] || rt.set2.stat) + ' +' + Math.round(rt.set2.pct * 100) + '%'));
      if (rt.set4) card.appendChild(h('div', { class: 'rune-set-bonus' },
        '4-piece: ' + (STAT_LABEL[rt.set4.stat] || rt.set4.stat) + ' +' + Math.round(rt.set4.pct * 100) + '%'));
      setGrid.appendChild(card);
    });
    screen.appendChild(setGrid);

    app.appendChild(screen);
  }

  function _getHeroNameForRune(p, runeId) {
    const heroRunes = p.heroRunes || {};
    for (const [heroId, slots] of Object.entries(heroRunes)) {
      if (slots && slots.includes(runeId)) {
        const hero = D.heroById(heroId);
        return hero ? hero.name : heroId;
      }
    }
    return '?';
  }


  // ===== Quests screen =====
  function renderQuests(app, ctx) {
    const S = window.GAME_SAVE;
        const p = ctx.state.player;
    app.innerHTML = '';
    const cb = renderCurrencyBar(ctx);
    if (cb) app.appendChild(cb);
    const hdr = h('div', { class: 'screen-header' });
    const tw = h('div', null);
    tw.appendChild(h('h2', null, 'Daily Quests'));
    tw.appendChild(h('div', { class: 'subtitle' }, 'Quests reset each day. Complete them for bonus crystals & scrolls.'));
    hdr.appendChild(tw);
    hdr.appendChild(backButton(ctx, 'Back', 'title'));
    app.appendChild(hdr);

    if (!S || !S.getDailyQuests) {
      app.appendChild(h('div', { class: 'quests-empty' }, 'Quest system unavailable.'));
      return;
    }

    const quests = S.getDailyQuests(p);
    const grid = h('div', { class: 'quests-grid' });
    quests.forEach(function(q, idx) {
      const done = q.progress >= q.target;
      const card = h('div', { class: 'quest-card' + (done ? ' quest-done' : '') + (q.claimed ? ' quest-claimed' : '') });
      const titleRow = h('div', { class: 'quest-title-row' });
      titleRow.appendChild(h('span', { class: 'quest-label' }, q.label || q.id));
      if (q.claimed) titleRow.appendChild(h('span', { class: 'quest-badge claimed' }, 'Claimed'));
      else if (done) titleRow.appendChild(h('span', { class: 'quest-badge ready' }, 'Ready'));
      card.appendChild(titleRow);

      const target = q.target || 1;
      card.appendChild(h('div', { class: 'quest-progress-text' }, Math.min(q.progress, target) + ' / ' + target));
      const barWrap = h('div', { class: 'quest-progress' });
      const fill = h('div', { class: 'quest-progress-fill' });
      fill.style.width = Math.min(100, (q.progress / Math.max(1, target)) * 100) + '%';
      barWrap.appendChild(fill);
      card.appendChild(barWrap);

      const rewardRow = h('div', { class: 'quest-reward' });
      const reward = q.reward || {};
      if (reward.crystals) rewardRow.appendChild(h('span', { class: 'quest-reward-chip' }, String(reward.crystals) + ' crystals'));
      if (reward.scrolls)  rewardRow.appendChild(h('span', { class: 'quest-reward-chip' }, String(reward.scrolls) + ' scrolls'));
      card.appendChild(rewardRow);

      if (done && !q.claimed) {
        const claimBtn = h('button', { class: 'btn quest-claim-btn', onclick: function() {
          const got = S.claimQuestReward(p, idx);
          if (got) {
            ctx.persistNow && ctx.persistNow();
            toast('Claimed!');
            renderQuests(app, ctx);
          }
        } }, 'Claim Reward');
        card.appendChild(claimBtn);
      }
      grid.appendChild(card);
    });
    app.appendChild(grid);
  }

  function captureBattleSnapshot() {
    try {
      const field = document.getElementById('battle-field');
      if (!field) return 'No battle field found (battle not active).';
      const vw = window.innerWidth, vh = window.innerHeight;
      const fr = field.getBoundingClientRect();
      const fs = window.getComputedStyle(field);
      const cols = field.querySelectorAll(':scope > .team-column');
      const lines = [];
      lines.push('=== Aetherbound battle field snapshot ===');
      lines.push('Time: ' + new Date().toISOString());
      lines.push('UA: ' + (navigator.userAgent || 'unknown'));
      lines.push('Viewport: ' + vw + 'x' + vh + ' DPR ' + (window.devicePixelRatio || 1));
      lines.push('');
      lines.push('--- .field#battle-field ---');
      lines.push('  rect: left=' + Math.round(fr.left) + ' top=' + Math.round(fr.top) +
                 ' w=' + Math.round(fr.width) + ' h=' + Math.round(fr.height));
      lines.push('  computed: display=' + fs.display + ' position=' + fs.position + ' overflow=' + fs.overflow);
      lines.push('  classes: ' + field.className);
      lines.push('');
      cols.forEach(function (col) {
        const cr = col.getBoundingClientRect();
        const cs = window.getComputedStyle(col);
        const kind = col.classList.contains('enemies') ? 'enemies' :
                     col.classList.contains('allies')  ? 'allies'  : '?';
        lines.push('--- .team-column.' + kind + ' ---');
        lines.push('  rect (viewport): left=' + Math.round(cr.left) + ' top=' + Math.round(cr.top) +
                   ' w=' + Math.round(cr.width) + ' h=' + Math.round(cr.height));
        lines.push('  rect (field-rel): left=' + ((cr.left - fr.left) / fr.width * 100).toFixed(1) +
                   '% top=' + ((cr.top - fr.top) / fr.height * 100).toFixed(1) +
                   '% w=' + (cr.width / fr.width * 100).toFixed(1) + '%');
        lines.push('  computed: display=' + cs.display + ' position=' + cs.position +
                   ' left=' + cs.left + ' right=' + cs.right + ' top=' + cs.top + ' bottom=' + cs.bottom +
                   ' width=' + cs.width);
        const units = col.querySelectorAll(':scope > .unit');
        units.forEach(function (u, i) {
          const ur = u.getBoundingClientRect();
          const us = window.getComputedStyle(u);
          const nameEl = u.querySelector('.name');
          lines.push('  unit ' + (i + 1) + ' (#' + (u.id || '?') +
                     ' name=' + (nameEl ? nameEl.textContent : '?') + '):');
          lines.push('    classes: ' + u.className);
          lines.push('    rect (viewport): left=' + Math.round(ur.left) + ' top=' + Math.round(ur.top) +
                     ' w=' + Math.round(ur.width) + ' h=' + Math.round(ur.height));
          lines.push('    rect (field-rel): left=' + ((ur.left - fr.left) / fr.width * 100).toFixed(1) +
                     '% top=' + ((ur.top - fr.top) / fr.height * 100).toFixed(1) +
                     '% bottom=' + ((fr.bottom - ur.bottom) / fr.height * 100).toFixed(1) +
                     '% w=' + (ur.width / fr.width * 100).toFixed(1) + '%');
          lines.push('    computed: position=' + us.position + ' left=' + us.left + ' right=' + us.right +
                     ' bottom=' + us.bottom + ' top=' + us.top + ' width=' + us.width +
                     ' transform=' + us.transform + ' z-index=' + us.zIndex + ' display=' + us.display);
        });
        lines.push('');
      });
      try {
        const G = window.__GAME__;
        if (G && G.state && G.state.battle) {
          const b = G.state.battle;
          lines.push('--- Battle state ---');
          lines.push('  stage: ' + (b.stage && b.stage.id));
          lines.push('  acting: ' + (b.acting && b.acting.name));
          lines.push('  result: ' + (b.result || '(in progress)'));
        }
      } catch (e) {}
      lines.push('');
      lines.push('=== end snapshot ===');
      return lines.join('\n');
    } catch (e) {
      return 'Snapshot error: ' + (e && e.message);
    }
  }

  const renderCollection = renderVault;
  const renderHeroDetail = showHeroDetail;

  // ---- Global button-click audio (single delegated listener) -----------------
  // Most buttons in the game had no audio cue. Rather than wiring AU.play in
  // every single onclick handler, a delegated listener on document plays a
  // light "button" tick on visible button clicks and an "error" thud when the
  // user clicks something disabled. Battle-specific sounds (skill_cast, hit,
  // victory) are still fired explicitly from their own call sites.
  (function installClickSfx() {
    if (typeof document === 'undefined' || document.__abClickSfxInstalled) return;
    document.__abClickSfxInstalled = true;
    document.addEventListener('click', function (e) {
      const AU = window.GAME_AUDIO;
      if (!AU || !AU.play) return;
      // Find the nearest clickable affordance from the click target.
      const btn = e.target && e.target.closest && e.target.closest(
        'button, .btn, .btn-nav, .btn-secondary, .icon-btn, .btn-link, ' +
        '.summon-btn, .skill-btn, .shop-card, .stage-card, .roster-card'
      );
      if (!btn) return;
      // Skip click sounds on full-screen reveal overlays — those have their
      // own audio cues (summon_pop, capcom stamps) and a tick would muddy them.
      if (btn.closest && (btn.closest('.reveal-overlay') || btn.closest('.capcom-stamp'))) return;
      const isDisabled = btn.disabled === true ||
        btn.classList.contains('off') ||
        btn.getAttribute('aria-disabled') === 'true';
      try { AU.play(isDisabled ? 'error' : 'button'); } catch (_) {}
    }, true); // capture so we run before the click handler navigates away
  })();

  window.GAME_UI = {
    renderTitle, renderStageSelect, renderTeamSelect, renderBattle,
    renderSummon, renderVault, renderCollection, renderHeroDetail,
    renderShop, renderRunes, renderQuests,
    renderLog, renderSkillPanel, renderAtb,
    showPopup, animateUnit,
    shakeField, hitStop, elementBurst,
    showReveal, showResult, toast,
    fmt,
    SORT_OPTIONS, sortHeroes, renderSortSelector, roleClass,
    capcomFlash, capcomStamp, capcomVS,
    capcomCombo, capcomComboTick, capcomElemTint, capcomSuperZoom,
    captureBattleSnapshot,
  };
})();
