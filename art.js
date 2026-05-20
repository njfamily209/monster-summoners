/* ===========================================================
   Aetherbound — procedural chibi avatars (DETAILED rev)
   Owner: Frontend (art layer)

   Architecture: a small library of PARTS (face, eyes, hair, helm,
   weapon, body) composed per hero. The renderer reads art fields
   from the hero data (hair, helm, weapon, beard, horns, etc.) so
   each character looks distinct without needing a giant per-hero
   SVG file.

   Falls back gracefully: any missing field uses a sensible default.
   =========================================================== */
(function () {
  'use strict';

  const ELEMENT_COLORS = {
    fire:  { aura: '#ff6a4d', glow: '#ffb088', deep: '#7a2a18' },
    water: { aura: '#5ab9ff', glow: '#a6daff', deep: '#1e4878' },
    wind:  { aura: '#7ee787', glow: '#b6ffb8', deep: '#2c6a35' },
    light: { aura: '#ffd86a', glow: '#fff2b6', deep: '#8a6018' },
    dark:  { aura: '#c084ff', glow: '#dfb6ff', deep: '#4a2078' },
  };
  const OUT = '#0e0a22';

  // ===== PARTS LIBRARY =====

  function dropShadow(){return '<ellipse cx="50" cy="93" rx="20" ry="2.6" fill="#000" opacity="0.32"/>';}

  // Face base — oval, slightly chinned. Skin tone variable.
  function face(skin) {
    return `
      <ellipse cx="50" cy="40" rx="20" ry="22" fill="${skin}" stroke="${OUT}" stroke-width="1.6"/>
      <!-- subtle chin shading -->
      <path d="M36 50 Q50 58 64 50" fill="none" stroke="${OUT}" stroke-width="0.7" opacity="0.35"/>
    `;
  }

  // Big anime-style eyes. Style options: 'normal', 'fierce', 'closed', 'glow'
  function eyes(style, color, glowColor) {
    color = color || '#0a0a18';
    const ey = 42;
    if (style === 'closed') return `
      <path d="M39 ${ey} Q44 ${ey-2} 49 ${ey}" stroke="${OUT}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M51 ${ey} Q56 ${ey-2} 61 ${ey}" stroke="${OUT}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    `;
    if (style === 'fierce') return `
      <!-- angled eyes -->
      <path d="M39 41 L48 38 Q48 44 39 44 Z" fill="white" stroke="${OUT}" stroke-width="1.1"/>
      <path d="M52 38 L61 41 Q61 44 52 44 Z" fill="white" stroke="${OUT}" stroke-width="1.1"/>
      <circle cx="44" cy="42" r="1.8" fill="${color}"/>
      <circle cx="56" cy="42" r="1.8" fill="${color}"/>
      <circle cx="44.5" cy="41.4" r="0.6" fill="#fff"/>
      <circle cx="56.5" cy="41.4" r="0.6" fill="#fff"/>
    `;
    if (style === 'glow') return `
      <ellipse cx="44" cy="${ey}" rx="2.6" ry="3" fill="${glowColor || color}" opacity="0.95"/>
      <ellipse cx="56" cy="${ey}" rx="2.6" ry="3" fill="${glowColor || color}" opacity="0.95"/>
      <circle cx="44" cy="${ey}" r="1.1" fill="#fff"/>
      <circle cx="56" cy="${ey}" r="1.1" fill="#fff"/>
    `;
    if (style === 'wolf') return `
      <ellipse cx="44" cy="41" rx="2.8" ry="2.4" fill="#1a0e04" stroke="${OUT}" stroke-width="1.1"/>
      <ellipse cx="56" cy="41" rx="2.8" ry="2.4" fill="#1a0e04" stroke="${OUT}" stroke-width="1.1"/>
      <ellipse cx="44" cy="41" rx="1.4" ry="1.8" fill="#c88020"/>
      <ellipse cx="56" cy="41" rx="1.4" ry="1.8" fill="#c88020"/>
      <!-- vertical slit pupils -->
      <ellipse cx="44" cy="41" rx="0.45" ry="1.6" fill="#0e0604"/>
      <ellipse cx="56" cy="41" rx="0.45" ry="1.6" fill="#0e0604"/>
      <circle cx="44.7" cy="40" r="0.5" fill="#fff" opacity="0.8"/>
      <circle cx="56.7" cy="40" r="0.5" fill="#fff" opacity="0.8"/>
    `;
    if (style === 'skeleton') return `
      <ellipse cx="44" cy="${ey}" rx="4.5" ry="5" fill="#080404" stroke="${OUT}" stroke-width="1.1"/>
      <ellipse cx="56" cy="${ey}" rx="4.5" ry="5" fill="#080404" stroke="${OUT}" stroke-width="1.1"/>
      <!-- ember glow deep in hollow sockets -->
      <circle cx="44" cy="${ey+1}" r="2" fill="#7a0000" opacity="0.7"/>
      <circle cx="56" cy="${ey+1}" r="2" fill="#7a0000" opacity="0.7"/>
    `;
    if (style === 'lich') return `
      <ellipse cx="44" cy="${ey}" rx="4.5" ry="5" fill="#180820" stroke="${OUT}" stroke-width="1.1"/>
      <ellipse cx="56" cy="${ey}" rx="4.5" ry="5" fill="#180820" stroke="${OUT}" stroke-width="1.1"/>
      <!-- arcane violet glow in hollow sockets -->
      <circle cx="44" cy="${ey+1}" r="2.2" fill="${glowColor || '#a040ff'}" opacity="0.75"/>
      <circle cx="56" cy="${ey+1}" r="2.2" fill="${glowColor || '#a040ff'}" opacity="0.75"/>
      <circle cx="44" cy="${ey+1}" r="0.9" fill="#e0c8ff" opacity="0.9"/>
      <circle cx="56" cy="${ey+1}" r="0.9" fill="#e0c8ff" opacity="0.9"/>
    `;
    // 'normal' — big anime round eyes
    return `
      <ellipse cx="44" cy="${ey}" rx="3" ry="3.8" fill="white" stroke="${OUT}" stroke-width="1.2"/>
      <ellipse cx="56" cy="${ey}" rx="3" ry="3.8" fill="white" stroke="${OUT}" stroke-width="1.2"/>
      <ellipse cx="44" cy="${ey+0.6}" rx="1.8" ry="2.6" fill="${color}"/>
      <ellipse cx="56" cy="${ey+0.6}" rx="1.8" ry="2.6" fill="${color}"/>
      <!-- big highlight -->
      <circle cx="44.8" cy="${ey-0.6}" r="0.9" fill="#fff"/>
      <circle cx="56.8" cy="${ey-0.6}" r="0.9" fill="#fff"/>
      <!-- bottom secondary highlight -->
      <ellipse cx="43.4" cy="${ey+2.2}" rx="0.6" ry="0.5" fill="rgba(255,255,255,0.7)"/>
      <ellipse cx="55.4" cy="${ey+2.2}" rx="0.6" ry="0.5" fill="rgba(255,255,255,0.7)"/>
    `;
  }

  function eyebrows(color, style) {
    if (!style || style === 'none') return '';
    color = color || '#3a2616';
    if (style === 'fierce') return `
      <path d="M40 36 L48 34" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M52 34 L60 36" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
    `;
    if (style === 'arched') return `
      <path d="M40 36 Q44 33 48 35" stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M52 35 Q56 33 60 36" stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    `;
    // 'normal'
    return `
      <path d="M40 36 Q44 34.5 48 36" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M52 36 Q56 34.5 60 36" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    `;
  }

  function mouth(style) {
    if (style === 'smirk') return `<path d="M48 50 L54 50 Q56 51 55 52" stroke="${OUT}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
    if (style === 'grin') return `<path d="M46 49 Q50 53 54 49" stroke="${OUT}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
    if (style === 'open') return `<ellipse cx="50" cy="50" rx="2.5" ry="1.8" fill="#3a1a1a" stroke="${OUT}" stroke-width="1.1"/>`;
    if (style === 'fang') return `
      <path d="M46 49 Q50 52 54 49" stroke="${OUT}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M48 50 L48 53 L49.5 50 Z" fill="#fff" stroke="${OUT}" stroke-width="0.5"/>
    `;
    if (style === 'snarl') return `
      <path d="M44 56 L56 56" stroke="${OUT}" stroke-width="0.8" opacity="0.6"/>
      <!-- corner fangs -->
      <path d="M43 55 L42 61 L45.5 55 Z" fill="#e8e4d8" stroke="${OUT}" stroke-width="0.5"/>
      <path d="M57 55 L58 61 L54.5 55 Z" fill="#e8e4d8" stroke="${OUT}" stroke-width="0.5"/>
      <!-- mid teeth -->
      <rect x="46.5" y="55" width="2.5" height="4" fill="#e8e4d8" stroke="${OUT}" stroke-width="0.5" rx="0.4"/>
      <rect x="50.5" y="55" width="2.5" height="4" fill="#e8e4d8" stroke="${OUT}" stroke-width="0.5" rx="0.4"/>
    `;
    if (style === 'skull_teeth') return `
      <line x1="41" y1="51" x2="59" y2="51" stroke="${OUT}" stroke-width="1.1"/>
      <rect x="42" y="51" width="2.8" height="4.5" fill="#d8d4c4" stroke="${OUT}" stroke-width="0.5" rx="0.3"/>
      <rect x="46.2" y="51" width="2.8" height="4.5" fill="#d8d4c4" stroke="${OUT}" stroke-width="0.5" rx="0.3"/>
      <rect x="50.4" y="51" width="2.8" height="4.5" fill="#d8d4c4" stroke="${OUT}" stroke-width="0.5" rx="0.3"/>
      <rect x="54.6" y="51" width="2.8" height="4.5" fill="#d8d4c4" stroke="${OUT}" stroke-width="0.5" rx="0.3"/>
    `;
    // 'smile'
    return `<path d="M47 50 Q50 52.5 53 50" stroke="${OUT}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  }

  function blush() {
    return `
      <ellipse cx="40" cy="48" rx="2.8" ry="1.6" fill="#ffb0b0" opacity="0.55"/>
      <ellipse cx="60" cy="48" rx="2.8" ry="1.6" fill="#ffb0b0" opacity="0.55"/>
    `;
  }

  // Pointed ears — for elves, goblins, fey
  function pointedEars(skin) {
    return `
      <path d="M31 38 L24 32 L31 44 Z" fill="${skin}" stroke="${OUT}" stroke-width="1.2"/>
      <path d="M69 38 L76 32 L69 44 Z" fill="${skin}" stroke="${OUT}" stroke-width="1.2"/>
    `;
  }

  // Horns — different shapes
  function horns(color, style) {
    color = color || '#2a1810';
    if (style === 'curled') return `
      <path d="M32 22 Q24 18 26 12 Q30 14 32 20 Z" fill="${color}" stroke="${OUT}" stroke-width="1.3"/>
      <path d="M68 22 Q76 18 74 12 Q70 14 68 20 Z" fill="${color}" stroke="${OUT}" stroke-width="1.3"/>
    `;
    if (style === 'ram') return `
      <path d="M30 24 Q22 26 22 18 Q26 20 30 22 Z" fill="${color}" stroke="${OUT}" stroke-width="1.3"/>
      <path d="M70 24 Q78 26 78 18 Q74 20 70 22 Z" fill="${color}" stroke="${OUT}" stroke-width="1.3"/>
    `;
    if (style === 'devil') return `
      <path d="M34 18 L30 8 L38 16 Z" fill="${color}" stroke="${OUT}" stroke-width="1.3"/>
      <path d="M66 18 L70 8 L62 16 Z" fill="${color}" stroke="${OUT}" stroke-width="1.3"/>
    `;
    return '';
  }

  // Hair — drawn BEHIND the face (back) and AROUND the face (front).
  // Returns { back, front } so callers can layer correctly.
  function hairBack(color, style) {
    if (style === 'long_flow') return `
      <path d="M28 30 Q22 50 24 70 L34 70 L34 50 Q34 30 30 24 Z"
        fill="${color}" stroke="${OUT}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M72 30 Q78 50 76 70 L66 70 L66 50 Q66 30 70 24 Z"
        fill="${color}" stroke="${OUT}" stroke-width="1.4" stroke-linejoin="round"/>
    `;
    if (style === 'ponytail') return `
      <path d="M68 28 Q82 38 78 60 L72 58 Q74 40 66 32 Z"
        fill="${color}" stroke="${OUT}" stroke-width="1.4" stroke-linejoin="round"/>
    `;
    return '';
  }
  function hairFront(color, style) {
    if (style === 'short_male') return `
      <path d="M32 28 Q40 18 50 22 Q60 18 68 28 Q68 32 60 30 Q54 24 50 28 Q46 24 40 30 Q32 32 32 28 Z"
        fill="${color}" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>
    `;
    if (style === 'spiky') return `
      <path d="M30 30 L32 18 L38 26 L42 16 L46 24 L50 14 L54 24 L58 16 L62 26 L68 18 L70 30 Q60 24 50 24 Q40 24 30 30 Z"
        fill="${color}" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>
    `;
    if (style === 'bowl') return `
      <path d="M30 30 Q30 18 50 16 Q70 18 70 30 L68 32 Q64 28 50 28 Q36 28 32 32 Z"
        fill="${color}" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>
    `;
    if (style === 'side_swept') return `
      <path d="M30 28 Q32 18 50 20 Q66 18 70 28 Q70 32 62 30 Q52 22 38 32 Q30 32 30 28 Z"
        fill="${color}" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>
    `;
    if (style === 'long_bangs') return `
      <path d="M30 24 Q36 16 50 18 Q64 16 70 24 Q70 32 62 30 Q52 24 50 32 Q48 24 38 30 Q30 32 30 24 Z"
        fill="${color}" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>
    `;
    if (style === 'mohawk') return `
      <path d="M44 28 L46 12 L50 18 L54 12 L56 28 Z"
        fill="${color}" stroke="${OUT}" stroke-width="1.4" stroke-linejoin="round"/>
    `;
    return '';
  }

  // Beard — covers chin
  function beard(color, style) {
    if (style === 'full') return `
      <path d="M34 46 Q36 60 50 65 Q64 60 66 46 Q60 52 50 52 Q40 52 34 46 Z"
        fill="${color}" stroke="${OUT}" stroke-width="1.4"/>
      <path d="M44 48 Q46 50 50 49 Q54 50 56 48 L56 51 Q53 53 50 52 Q47 53 44 51 Z"
        fill="${color}" stroke="${OUT}" stroke-width="0.6"/>
    `;
    if (style === 'goatee') return `
      <path d="M46 52 Q50 60 54 52 Q52 55 50 55 Q48 55 46 52 Z" fill="${color}" stroke="${OUT}" stroke-width="1.1"/>
    `;
    if (style === 'stubble') return `
      <circle cx="44" cy="52" r="0.5" fill="${color}"/>
      <circle cx="48" cy="54" r="0.5" fill="${color}"/>
      <circle cx="52" cy="54" r="0.5" fill="${color}"/>
      <circle cx="56" cy="52" r="0.5" fill="${color}"/>
      <circle cx="46" cy="53" r="0.5" fill="${color}"/>
      <circle cx="54" cy="53" r="0.5" fill="${color}"/>
    `;
    return '';
  }

  // Helmet / hat — many types. Returns the SVG drawn ABOVE the hair.
  function helm(opts) {
    const type = (opts && opts.type) || 'none';
    const c = (opts && opts.color) || '#3a4063';
    const accent = (opts && opts.accent) || '#caa75e';
    const glow = (opts && opts.glow) || '#ffb088';
    if (type === 'horned_knight') return `
      <path d="M28 38 Q28 14 50 12 Q72 14 72 38 L68 32 Q60 26 50 26 Q40 26 32 32 Z"
        fill="${c}" stroke="${OUT}" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M28 34 L22 20 L34 30 Z" fill="${c}" stroke="${OUT}" stroke-width="1.4"/>
      <path d="M72 34 L78 20 L66 30 Z" fill="${c}" stroke="${OUT}" stroke-width="1.4"/>
      <rect x="40" y="34" width="20" height="4" fill="${accent}" stroke="${OUT}" stroke-width="0.8"/>
      <rect x="48" y="14" width="4" height="6" fill="${accent}" stroke="${OUT}" stroke-width="0.8"/>
    `;
    if (type === 'wizard_hat') return `
      <path d="M50 4 L78 36 L22 36 Z" fill="${c}" stroke="${OUT}" stroke-width="1.7" stroke-linejoin="round"/>
      <ellipse cx="50" cy="36" rx="30" ry="4.5" fill="${c}" stroke="${OUT}" stroke-width="1.5"/>
      <path d="M70 18 Q72 20 70 22" stroke="${OUT}" stroke-width="0.8" fill="none"/>
      <circle cx="50" cy="14" r="2.4" fill="${accent}" stroke="${OUT}" stroke-width="0.8"/>
    `;
    if (type === 'witch_hat') return `
      <path d="M48 4 Q56 22 78 38 L22 38 Q44 22 48 4 Z" fill="${c}" stroke="${OUT}" stroke-width="1.7" stroke-linejoin="round"/>
      <ellipse cx="50" cy="38" rx="30" ry="4.5" fill="${c}" stroke="${OUT}" stroke-width="1.5"/>
      <path d="M30 36 Q50 30 70 36 L70 38 Q50 32 30 38 Z" fill="${accent}" opacity="0.7"/>
    `;
    if (type === 'hood_simple') return `
      <path d="M28 40 Q26 18 50 14 Q74 18 72 40 L66 36 Q60 32 50 32 Q40 32 34 36 Z"
        fill="${c}" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M28 40 L36 44 Q42 38 50 38 Q58 38 64 44 L72 40"
        fill="none" stroke="${OUT}" stroke-width="1.4" stroke-linecap="round"/>
    `;
    if (type === 'hood_pointy') return `
      <path d="M50 8 L46 0 L54 0 Z" fill="${c}" stroke="${OUT}" stroke-width="1.2"/>
      <path d="M28 40 Q26 14 50 8 Q74 14 72 40 L66 36 Q60 32 50 32 Q40 32 34 36 Z"
        fill="${c}" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>
    `;
    if (type === 'cleric_veil') return `
      <path d="M28 42 Q28 16 50 12 Q72 16 72 42 L66 36 Q58 30 50 30 Q42 30 34 36 Z"
        fill="${c}" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>
      <ellipse cx="50" cy="12" rx="18" ry="3" fill="none" stroke="${glow}" stroke-width="1.8"/>
    `;
    if (type === 'crown') return `
      <path d="M30 30 L32 18 L40 24 L46 16 L54 16 L60 24 L68 18 L70 30 Z"
        fill="${accent}" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="38" cy="20" r="1.6" fill="${glow}" stroke="${OUT}" stroke-width="0.6"/>
      <circle cx="50" cy="18" r="1.8" fill="${glow}" stroke="${OUT}" stroke-width="0.6"/>
      <circle cx="62" cy="20" r="1.6" fill="${glow}" stroke="${OUT}" stroke-width="0.6"/>
    `;
    if (type === 'circlet') return `
      <rect x="30" y="28" width="40" height="3" rx="1.5" fill="${accent}" stroke="${OUT}" stroke-width="1"/>
      <circle cx="50" cy="29" r="1.8" fill="${glow}" stroke="${OUT}" stroke-width="0.7"/>
    `;
    if (type === 'open_helm') return `
      <path d="M28 38 Q28 16 50 14 Q72 16 72 38 L68 30 Q60 24 50 24 Q40 24 32 30 Z"
        fill="${c}" stroke="${OUT}" stroke-width="1.7" stroke-linejoin="round"/>
      <rect x="38" y="34" width="24" height="4" fill="${accent}" stroke="${OUT}" stroke-width="0.8"/>
    `;
    if (type === 'bandana') return `
      <path d="M30 26 Q50 22 70 26 L68 32 Q50 28 32 32 Z"
        fill="${c}" stroke="${OUT}" stroke-width="1.5"/>
      <path d="M68 28 L78 32 L72 24 Z" fill="${c}" stroke="${OUT}" stroke-width="1.2"/>
    `;
    if (type === 'bone_mask') return `
      <ellipse cx="50" cy="42" rx="14" ry="10" fill="#e6e8ec" stroke="${OUT}" stroke-width="1.4"/>
      <ellipse cx="44" cy="40" rx="3" ry="3.5" fill="#000"/>
      <ellipse cx="56" cy="40" rx="3" ry="3.5" fill="#000"/>
      <circle cx="44" cy="40" r="1.4" fill="${glow}"/>
      <circle cx="56" cy="40" r="1.4" fill="${glow}"/>
      <path d="M44 48 L56 48 L55 52 L45 52 Z" fill="#fff" stroke="${OUT}" stroke-width="0.7"/>
      <line x1="46" y1="48" x2="46" y2="52" stroke="${OUT}" stroke-width="0.4"/>
      <line x1="50" y1="48" x2="50" y2="52" stroke="${OUT}" stroke-width="0.4"/>
      <line x1="54" y1="48" x2="54" y2="52" stroke="${OUT}" stroke-width="0.4"/>
    `;
    return '';
  }

  // Body / robe / armor variations
  function body(opts) {
    const type = (opts && opts.type) || 'robe';
    const robe = (opts && opts.color) || '#3a4063';
    const dark = (opts && opts.dark) || '#1a2030';
    const belt = (opts && opts.belt) || '#3a2616';
    const accent = (opts && opts.accent) || '#caa75e';

    if (type === 'plate_armor') return `
      <path d="M28 58 L72 58 L76 91 L24 91 Z" fill="${robe}" stroke="${OUT}" stroke-width="1.7" stroke-linejoin="round"/>
      <!-- chest plate central -->
      <path d="M40 60 L60 60 L62 78 L38 78 Z" fill="${dark}" stroke="${OUT}" stroke-width="1.3"/>
      <!-- gem -->
      <polygon points="50,66 53,70 50,74 47,70" fill="${accent}" stroke="${OUT}" stroke-width="0.8"/>
      <!-- shoulder pads -->
      <ellipse cx="26" cy="60" rx="9" ry="6.5" fill="${dark}" stroke="${OUT}" stroke-width="1.3"/>
      <ellipse cx="74" cy="60" rx="9" ry="6.5" fill="${dark}" stroke="${OUT}" stroke-width="1.3"/>
      <!-- belt -->
      <rect x="24" y="76" width="52" height="5" fill="${belt}" stroke="${OUT}" stroke-width="1.2"/>
      <rect x="46" y="76" width="8" height="5" fill="${accent}" stroke="${OUT}" stroke-width="0.8"/>
    `;
    if (type === 'mage_robe') return `
      <path d="M28 58 L72 58 L78 91 L22 91 Z" fill="${robe}" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>
      <!-- inner robe lighter -->
      <path d="M40 58 L60 58 L60 91 L40 91 Z" fill="${dark}" opacity="0.5"/>
      <!-- robe trim -->
      <path d="M28 58 L72 58" stroke="${accent}" stroke-width="1.4"/>
      <rect x="40" y="78" width="20" height="2.4" fill="${accent}" stroke="${OUT}" stroke-width="0.6"/>
      <!-- sleeves -->
      <rect x="18" y="62" width="12" height="20" rx="4" fill="${robe}" stroke="${OUT}" stroke-width="1.4"/>
      <rect x="70" y="62" width="12" height="20" rx="4" fill="${robe}" stroke="${OUT}" stroke-width="1.4"/>
    `;
    if (type === 'leather') return `
      <path d="M30 60 L70 60 L74 91 L26 91 Z" fill="${robe}" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>
      <!-- leather straps -->
      <line x1="36" y1="60" x2="40" y2="91" stroke="${dark}" stroke-width="1.2"/>
      <line x1="64" y1="60" x2="60" y2="91" stroke="${dark}" stroke-width="1.2"/>
      <!-- belt with buckle -->
      <rect x="26" y="76" width="48" height="4.5" fill="${belt}" stroke="${OUT}" stroke-width="1.2"/>
      <rect x="46" y="76" width="8" height="4.5" fill="${accent}" stroke="${OUT}" stroke-width="0.8"/>
      <!-- pouch -->
      <rect x="58" y="80" width="6" height="7" rx="1" fill="${belt}" stroke="${OUT}" stroke-width="1.1"/>
      <!-- sleeves -->
      <rect x="22" y="62" width="9" height="16" rx="3" fill="${robe}" stroke="${OUT}" stroke-width="1.3"/>
      <rect x="69" y="62" width="9" height="16" rx="3" fill="${robe}" stroke="${OUT}" stroke-width="1.3"/>
    `;
    if (type === 'tunic') return `
      <path d="M30 60 L70 60 L72 91 L28 91 Z" fill="${robe}" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>
      <rect x="26" y="76" width="48" height="4" fill="${belt}" stroke="${OUT}" stroke-width="1.1"/>
      <rect x="22" y="62" width="9" height="14" rx="3" fill="${robe}" stroke="${OUT}" stroke-width="1.3"/>
      <rect x="69" y="62" width="9" height="14" rx="3" fill="${robe}" stroke="${OUT}" stroke-width="1.3"/>
    `;
    if (type === 'goblin_bare') return `
      <path d="M32 60 L68 60 L72 91 L28 91 Z" fill="${robe}" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>
      <!-- loincloth -->
      <path d="M40 76 L60 76 L62 91 L38 91 Z" fill="${belt}" stroke="${OUT}" stroke-width="1.2"/>
      <rect x="38" y="74" width="24" height="3" fill="${dark}" stroke="${OUT}" stroke-width="0.9"/>
    `;
    // default robe
    return `
      <path d="M30 60 L70 60 L74 91 L26 91 Z" fill="${robe}" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M30 60 L34 91 L26 91 Z" fill="${dark}" opacity="0.55"/>
      <path d="M70 60 L66 91 L74 91 Z" fill="${dark}" opacity="0.55"/>
      <rect x="26" y="76" width="48" height="4.5" fill="${belt}" stroke="${OUT}" stroke-width="1.2"/>
      <circle cx="50" cy="78.3" r="1.6" fill="${accent}" stroke="${OUT}" stroke-width="0.5"/>
      <rect x="20" y="62" width="10" height="16" rx="3.5" fill="${robe}" stroke="${OUT}" stroke-width="1.4"/>
      <rect x="70" y="62" width="10" height="16" rx="3.5" fill="${robe}" stroke="${OUT}" stroke-width="1.4"/>
    `;
  }

  // Cape behind body
  function cape(color, dark) {
    return `
      <path d="M22 58 L78 58 L82 92 L74 88 L72 70 L28 70 L26 88 L18 92 Z"
        fill="${color}" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M40 60 L42 90 L58 90 L60 60 Z" fill="${dark || color}" opacity="0.55"/>
    `;
  }

  // Weapons — each fully styled
  function weapon(opts) {
    const type = opts.type;
    const accent = opts.accent || '#caa75e';
    const elGlow = opts.elGlow || '#ffb088';
    const elAura = opts.elAura || '#ff6a4d';

    if (type === 'greatsword') return `
      <rect x="78" y="42" width="6" height="38" rx="1" fill="#dde3ef" stroke="${OUT}" stroke-width="1.4"/>
      <path d="M78 42 L84 42 L81 36 Z" fill="#fff" stroke="${OUT}" stroke-width="1"/>
      <rect x="73" y="78" width="16" height="5" fill="${accent}" stroke="${OUT}" stroke-width="1.2"/>
      <rect x="78" y="83" width="6" height="7" fill="#7a4a2a" stroke="${OUT}" stroke-width="1"/>
      <circle cx="81" cy="91" r="2.2" fill="${accent}" stroke="${OUT}" stroke-width="1"/>
      <!-- element glow on blade -->
      <line x1="81" y1="44" x2="81" y2="78" stroke="${elAura}" stroke-width="1" opacity="0.65"/>
    `;
    if (type === 'flame_sword') return `
      <rect x="78" y="44" width="5" height="36" rx="1" fill="${elAura}" stroke="${OUT}" stroke-width="1.4"/>
      <path d="M78 44 L83 44 L80.5 38 Z" fill="${elGlow}" stroke="${OUT}" stroke-width="1"/>
      <!-- flame tongues coming off blade -->
      <path d="M81 50 Q85 52 84 56 Q82 54 81 56 Z" fill="${elGlow}" opacity="0.8"/>
      <path d="M81 64 Q77 66 78 70 Q80 68 81 70 Z" fill="${elGlow}" opacity="0.8"/>
      <rect x="73" y="78" width="15" height="5" fill="${accent}" stroke="${OUT}" stroke-width="1.2"/>
      <rect x="78" y="83" width="5" height="6" fill="#7a4a2a" stroke="${OUT}" stroke-width="1"/>
    `;
    if (type === 'rapier') return `
      <rect x="80" y="40" width="2.5" height="40" rx="0.5" fill="#dde3ef" stroke="${OUT}" stroke-width="1.2"/>
      <circle cx="81.2" cy="82" r="3.5" fill="${accent}" stroke="${OUT}" stroke-width="1.1"/>
      <path d="M76 84 Q81 80 86 84" stroke="${accent}" stroke-width="1.4" fill="none"/>
    `;
    if (type === 'lance') return `
      <rect x="79" y="32" width="2.5" height="56" fill="#7a4a2a" stroke="${OUT}" stroke-width="1.2"/>
      <path d="M80 28 L84 36 L80 36 L76 36 Z" fill="#dde3ef" stroke="${OUT}" stroke-width="1.2"/>
      <path d="M76 36 L84 36 L82 40 L78 40 Z" fill="${accent}" stroke="${OUT}" stroke-width="1"/>
      <!-- pennon flag -->
      <path d="M82 36 L92 38 L86 44 Z" fill="${elAura}" stroke="${OUT}" stroke-width="1.1"/>
    `;
    if (type === 'staff_orb') return `
      <rect x="16" y="34" width="3" height="56" fill="#7a4a2a" stroke="${OUT}" stroke-width="1.2"/>
      <circle cx="17.5" cy="30" r="7" fill="${elGlow}" stroke="${OUT}" stroke-width="1.4"/>
      <circle cx="17.5" cy="30" r="3.5" fill="${elAura}"/>
      <circle cx="15.8" cy="28.5" r="1.2" fill="#fff" opacity="0.85"/>
    `;
    if (type === 'trident') return `
      <rect x="16" y="40" width="3" height="50" fill="#7a4a2a" stroke="${OUT}" stroke-width="1.2"/>
      <path d="M17.5 40 L17.5 28 L21 32 L17.5 30 L14 32 L17.5 28" fill="none" stroke="#dde3ef" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M10 32 L10 22 L13 26 L10 22" fill="none" stroke="#dde3ef" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M25 32 L25 22 L22 26 L25 22" fill="none" stroke="#dde3ef" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="17.5" cy="38" r="2.5" fill="${elAura}" stroke="${OUT}" stroke-width="1"/>
    `;
    if (type === 'longbow') return `
      <path d="M18 28 Q10 56 18 86" stroke="#7a4a2a" stroke-width="3" fill="none" stroke-linecap="round"/>
      <line x1="18" y1="28" x2="18" y2="86" stroke="#e0e6f0" stroke-width="1"/>
      <!-- arrow nocked -->
      <line x1="18" y1="56" x2="42" y2="56" stroke="${accent}" stroke-width="1.8"/>
      <polygon points="42,53 48,56 42,59" fill="${elAura}" stroke="${OUT}" stroke-width="0.7"/>
      <path d="M18 56 L15 53 M18 56 L15 59" stroke="${accent}" stroke-width="1.3" stroke-linecap="round"/>
    `;
    if (type === 'mace_holy') return `
      <rect x="80" y="40" width="2.8" height="50" fill="#7a4a2a" stroke="${OUT}" stroke-width="1.2"/>
      <ellipse cx="81.4" cy="36" rx="6" ry="5.5" fill="${accent}" stroke="${OUT}" stroke-width="1.3"/>
      <!-- holy spikes -->
      <path d="M76 36 L76 30 M81.4 30 L81.4 22 M87 36 L87 30 M81.4 41 L81.4 50" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="81.4" cy="36" r="2" fill="${elGlow}" stroke="${OUT}" stroke-width="0.6"/>
    `;
    if (type === 'twin_daggers') return `
      <g transform="translate(50,76)">
        <g transform="rotate(28)">
          <rect x="-14" y="-1.3" width="24" height="2.8" fill="#dde3ef" stroke="${OUT}" stroke-width="0.9"/>
          <polygon points="-14,0 -18,-2 -18,2" fill="#dde3ef" stroke="${OUT}" stroke-width="0.6"/>
          <rect x="9" y="-2.8" width="6" height="5.6" fill="${accent}" stroke="${OUT}" stroke-width="0.8"/>
          <circle cx="12" cy="0" r="1" fill="${elGlow}"/>
        </g>
        <g transform="rotate(-28)">
          <rect x="-14" y="-1.3" width="24" height="2.8" fill="#dde3ef" stroke="${OUT}" stroke-width="0.9"/>
          <polygon points="14,0 18,-2 18,2" fill="#dde3ef" stroke="${OUT}" stroke-width="0.6"/>
          <rect x="-15" y="-2.8" width="6" height="5.6" fill="${accent}" stroke="${OUT}" stroke-width="0.8"/>
          <circle cx="-12" cy="0" r="1" fill="${elGlow}"/>
        </g>
      </g>
    `;
    if (type === 'tower_shield') return `
      <path d="M8 50 Q4 78 16 90 Q28 78 24 50 Z" fill="${accent}" stroke="${OUT}" stroke-width="1.7"/>
      <path d="M10 52 Q8 76 16 86 Q24 76 22 52 Z" fill="${elAura}" stroke="${OUT}" stroke-width="1.2"/>
      <circle cx="16" cy="70" r="4" fill="${accent}" stroke="${OUT}" stroke-width="1.2"/>
      <circle cx="16" cy="70" r="1.5" fill="${elGlow}"/>
    `;
    if (type === 'twin_axes') return `
      <g transform="translate(78,68)">
        <rect x="-1" y="-22" width="2.5" height="44" fill="#7a4a2a" stroke="${OUT}" stroke-width="1.1"/>
        <path d="M-8 -18 L8 -22 L14 -10 L8 -2 L-2 -8 Z" fill="${accent}" stroke="${OUT}" stroke-width="1.2"/>
        <path d="M-8 -18 L0 -14 L-2 -8" fill="${elAura}" stroke="${OUT}" stroke-width="0.7"/>
      </g>
    `;
    if (type === 'club_bone') return `
      <rect x="76" y="48" width="4" height="34" fill="#7a4a2a" stroke="${OUT}" stroke-width="1.2"/>
      <ellipse cx="78" cy="46" rx="7" ry="6" fill="#7a4a2a" stroke="${OUT}" stroke-width="1.3"/>
      <circle cx="76" cy="44" r="1" fill="#3a2616"/>
      <circle cx="80" cy="48" r="1" fill="#3a2616"/>
    `;
    if (type === 'battle_axe') return `
      <rect x="78" y="36" width="3.5" height="54" fill="#5a3a1a" stroke="${OUT}" stroke-width="1.2"/>
      <path d="M70 36 L86 28 L92 36 L86 44 L82 40 Z" fill="#7a7a8a" stroke="${OUT}" stroke-width="1.3"/>
      <path d="M86 28 L92 34 L86 40 Z" fill="${elAura}" stroke="${OUT}" stroke-width="1"/>
    `;
    if (type === 'bone_staff') return `
      <rect x="80" y="34" width="3" height="56" fill="#e6e8ec" stroke="${OUT}" stroke-width="1.2"/>
      <path d="M76 30 L86 30 L83 24 L79 24 Z" fill="${elAura}" stroke="${OUT}" stroke-width="1.2"/>
      <!-- bone joint -->
      <ellipse cx="81.5" cy="58" rx="3" ry="2" fill="#e6e8ec" stroke="${OUT}" stroke-width="1"/>
    `;
    return '';
  }

  // Wolf ears — upright triangular ears with pink inner ear
  function wolfEars(skin) {
    return `
      <path d="M31 30 L24 12 L40 26 Z" fill="${skin}" stroke="${OUT}" stroke-width="1.3"/>
      <path d="M69 30 L76 12 L60 26 Z" fill="${skin}" stroke="${OUT}" stroke-width="1.3"/>
      <path d="M31 28 L27 17 L38 25 Z" fill="#d4a080" stroke="none" opacity="0.65"/>
      <path d="M69 28 L73 17 L62 25 Z" fill="#d4a080" stroke="none" opacity="0.65"/>
    `;
  }

  // Wolf snout / muzzle — drawn over the lower face to create a protruding muzzle
  function wolfSnout(skin) {
    return `
      <!-- muzzle shape -->
      <ellipse cx="50" cy="54" rx="9" ry="7" fill="${skin}" stroke="${OUT}" stroke-width="1.2"/>
      <ellipse cx="50" cy="48" rx="5.5" ry="3.5" fill="${skin}" stroke="${OUT}" stroke-width="0.9"/>
      <!-- nostrils -->
      <ellipse cx="47" cy="48" rx="1.4" ry="1.1" fill="#2a1208" stroke="${OUT}" stroke-width="0.5"/>
      <ellipse cx="53" cy="48" rx="1.4" ry="1.1" fill="#2a1208" stroke="${OUT}" stroke-width="0.5"/>
      <!-- cleft groove -->
      <line x1="50" y1="46" x2="50" y2="50" stroke="${OUT}" stroke-width="0.6" opacity="0.4"/>
    `;
  }

  // Accessory: cape, pouches, ammo, etc.
  function quiver() {
    return `
      <rect x="70" y="60" width="7" height="20" rx="2" fill="#5a3a1a" stroke="${OUT}" stroke-width="1.3"/>
      <line x1="72" y1="58" x2="72" y2="54" stroke="#7a4a2a" stroke-width="1.5"/>
      <line x1="74" y1="58" x2="74" y2="53" stroke="#7a4a2a" stroke-width="1.5"/>
      <line x1="76" y1="58" x2="76" y2="55" stroke="#7a4a2a" stroke-width="1.5"/>
      <polygon points="72,54 74,52 76,54" fill="#dde3ef"/>
    `;
  }

  // ===== HERO COMPOSITION =====
  // Each hero specifies their parts via art config. If no art config,
  // we infer from kind.

  function composeAvatar(monster) {
    const el = ELEMENT_COLORS[monster.element] || ELEMENT_COLORS.fire;
    const art = monster.art || {};
    const kind = art.kind || 'warrior';
    const accent = art.accent || '#ffe2b3';
    const skin = art.skin ||
      (kind === 'goblin' || kind === 'goblin_shaman' || kind === 'goblin_chief' ? '#8fcf6e' :
       kind === 'wolf' || kind === 'wolf_chief' ? '#8a7a5a' :
       kind === 'skeleton' ? '#c0bcac' :
       kind === 'lich' || kind === 'lich_lord' ? '#c0b8d4' :
       kind === 'wraith' ? '#d0cce4' :
       '#f7d4ad');

    // Defaults by kind
    const presets = {
      warrior:  { body:'plate_armor', helm:'horned_knight', hair:'short_male',  hairColor:'#3a2616', weapon:'greatsword',  eyes:'normal',  brows:'fierce',  mouth:'smile' },
      mage:     { body:'mage_robe',   helm:'wizard_hat',   hair:'side_swept',  hairColor:'#2a1a3a', weapon:'staff_orb',   eyes:'normal',  brows:'arched',  mouth:'smirk' },
      ranger:   { body:'leather',     helm:'hood_simple',  hair:'long_bangs',  hairColor:'#5a3416', weapon:'longbow',     eyes:'fierce',  brows:'normal',  mouth:'smirk' },
      healer:   { body:'mage_robe',   helm:'cleric_veil',  hair:'long_flow',   hairColor:'#caa75e', weapon:'mace_holy',   eyes:'closed',  brows:'arched',  mouth:'smile' },
      assassin: { body:'leather',     helm:'hood_pointy',  hair:'spiky',       hairColor:'#1a0e2a', weapon:'twin_daggers',eyes:'glow',    brows:'fierce',  mouth:'smirk' },
      tank:     { body:'plate_armor', helm:'open_helm',    hair:'short_male',  hairColor:'#3a2616', weapon:'tower_shield',eyes:'fierce',  brows:'fierce',  mouth:'smile' },
      goblin:        { body:'goblin_bare', helm:'',          hair:'mohawk', hairColor:'#3a2616', weapon:'club_bone',   eyes:'normal',   brows:'fierce', mouth:'fang',       ears:'pointed' },
      goblin_shaman: { body:'mage_robe',   helm:'bone_mask', hair:'',       hairColor:'#3a2616', weapon:'bone_staff',  eyes:'glow',     brows:'normal', mouth:'',           ears:'pointed' },
      goblin_chief:  { body:'goblin_bare', helm:'crown',     hair:'mohawk', hairColor:'#3a2616', weapon:'battle_axe',  eyes:'fierce',   brows:'fierce', mouth:'fang',       ears:'pointed' },
      wolf:          { body:'goblin_bare', helm:'',          hair:'',       hairColor:'#3a2a1a', weapon:'club_bone',   eyes:'wolf',     brows:'fierce', mouth:'snarl',      ears:'wolf',  snout:true },
      wolf_chief:    { body:'goblin_bare', helm:'crown',     hair:'',       hairColor:'#3a2a1a', weapon:'battle_axe',  eyes:'wolf',     brows:'fierce', mouth:'snarl',      ears:'wolf',  snout:true },
      skeleton:      { body:'plate_armor', helm:'',          hair:'',       hairColor:'#b4b0a0', weapon:'bone_staff',  eyes:'skeleton', brows:'none',   mouth:'skull_teeth' },
      lich:          { body:'mage_robe',   helm:'hood_simple', hair:'',      hairColor:'#c0b8d4', weapon:'bone_staff',  eyes:'lich',     brows:'none',   mouth:'skull_teeth' },
      lich_lord:     { body:'mage_robe',   helm:'crown',      hair:'',       hairColor:'#c0b8d4', weapon:'staff_orb',   eyes:'lich',     brows:'none',   mouth:'skull_teeth' },
      wraith:        { body:'mage_robe',   helm:'hood_simple', hair:'',      hairColor:'#d0cce4', weapon:'twin_daggers',eyes:'glow',     brows:'none',   mouth:'open' },
    };
    const p = Object.assign({}, presets[kind] || presets.warrior, art);

    // Build the avatar
    const parts = [];
    parts.push(dropShadow());
    // Cape (some heroes have one)
    if (p.cape) parts.push(cape(p.capeColor || el.aura, el.deep));
    // Hair back (for long hair)
    if (p.hair) parts.push(hairBack(p.hairColor, p.hair));
    // Body
    parts.push(body({ type: p.body, color: el.aura, dark: el.deep, belt: '#3a2616', accent: accent }));
    // Quiver / accessory behind body
    if (p.quiver) parts.push(quiver());
    // Head/face starts here. Ears go behind face.
    if (p.ears === 'pointed') parts.push(pointedEars(skin));
    if (p.ears === 'wolf') parts.push(wolfEars(skin));
    parts.push(face(skin));
    // Hair front (heroes only; wolf/skeleton have no hair)
    if (p.hair) parts.push(hairFront(p.hairColor, p.hair));
    // Wolf snout -- drawn over lower face, before facial detail layers
    if (p.snout) parts.push(wolfSnout(skin));
    // Beard
    if (p.beard) parts.push(beard(p.beardColor || p.hairColor, p.beard));
    // Horns behind helm if any
    if (p.horns) parts.push(horns(p.hornColor, p.horns));
    // Helm
    if (p.helm) parts.push(helm({ type: p.helm, color: el.deep, accent: accent, glow: el.glow }));
    // Face details: eyes, brows, mouth, blush (skipped for masked faces)
    const skipBlush = kind === 'wolf' || kind === 'wolf_chief' || kind === 'skeleton' || kind === 'lich' || kind === 'lich_lord' || kind === 'wraith';
    if (p.helm !== 'bone_mask') {
      parts.push(eyebrows(p.hairColor, p.brows));
      parts.push(eyes(p.eyes, '#0a0a18', el.glow));
      if (p.mouth) parts.push(mouth(p.mouth));
      if (!skipBlush) parts.push(blush());
    }
    // Weapon
    if (p.weapon) parts.push(weapon({ type: p.weapon, accent: accent, elGlow: el.glow, elAura: el.aura }));

    return parts.join('');
  }

  function proceduralPortrait(monster) {
    return `
      <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
           shape-rendering="geometricPrecision" role="img"
           aria-label="${monster.name} portrait">
        ${composeAvatar(monster)}
      </svg>
    `;
  }

  const packs = { procedural: { renderPortrait: proceduralPortrait } };
  let currentPackId = 'procedural';
  // Portrait cache: keyed by "<packId>/<monsterId>" so pack swaps and
  // procedural templates are each cached independently.
  const portraitCache = Object.create(null);

  function renderPortrait(monster) {
    if (monster.art && monster.art.src) {
      const alt = (monster.art.alt || monster.name).replace(/"/g, '&quot;');
      return `<img class="portrait-img" src="${monster.art.src}" alt="${alt}" loading="lazy" decoding="async"/>`;
    }
    // Procedural pack is deterministic — cache its results forever.
    // Other packs (e.g. lpc) are dynamic: their SPRITE_MAP can change at
    // any time, so we skip the outer cache and let the pack decide.
    if (currentPackId === 'procedural') {
      const cacheKey = 'procedural/' + monster.id;
      if (portraitCache[cacheKey]) return portraitCache[cacheKey];
      const svg = packs.procedural.renderPortrait(monster);
      portraitCache[cacheKey] = svg;
      return svg;
    }
    const pack = packs[currentPackId] || packs.procedural;
    return pack.renderPortrait(monster);
  }
  function registerPack(id, pack) {
    if (!pack || typeof pack.renderPortrait !== 'function') {
      console.warn('registerPack: pack must have renderPortrait()'); return;
    }
    packs[id] = pack;
    // Invalidate cache entries for this pack so new renders pick up the new pack.
    for (const k of Object.keys(portraitCache)) {
      if (k.startsWith(id + '/')) delete portraitCache[k];
    }
  }
  function setPack(id) {
    if (packs[id]) { currentPackId = id; }
    else console.warn('setPack: unknown pack ' + id);
  }
  // Invalidate specific or all portrait cache entries.
  // Called by sprites.js when a sprite is registered or deleted so the next
  // renderPortrait call re-evaluates against the updated SPRITE_MAP.
  function clearPortraitCache(packId, monsterId) {
    if (packId && monsterId) {
      delete portraitCache[packId + '/' + monsterId];
    } else if (packId) {
      for (const k of Object.keys(portraitCache)) {
        if (k.startsWith(packId + '/')) delete portraitCache[k];
      }
    } else {
      for (const k of Object.keys(portraitCache)) delete portraitCache[k];
    }
  }
  function renderStars(n) { return '★'.repeat(n); }

  window.GAME_ART = {
    renderPortrait, renderStars, ELEMENT_COLORS,
    registerPack, setPack, clearPortraitCache,
    getPack: (id) => packs[id] || null,
    getCurrentPack: () => currentPackId,
    listPacks: () => Object.keys(packs),
  };
})();
    listPacks: () => Object.keys(packs)
  };
})();
