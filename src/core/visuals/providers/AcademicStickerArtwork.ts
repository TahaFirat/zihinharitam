function svgToDataUri(svgContent: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent.trim())}`;
}

/**
 * Wraps inner illustration markup in a genuine Die-Cut White Contour Sticker SVG
 * (thick #FFFFFF morphological contour filter + 1px cut-line + soft paper shadow, zero text).
 */
function wrapAsDieCutStickerSvg(innerMarkup: string, viewBox = '0 0 160 160'): string {
  return svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="160" height="160">
  <defs>
    <filter id="diecut" x="-22%" y="-22%" width="144%" height="148%" color-interpolation-filters="sRGB">
      <feMorphology in="SourceAlpha" operator="dilate" radius="7.5" result="dilatedWhite"/>
      <feFlood flood-color="#FFFFFF" flood-opacity="1" result="whiteFill"/>
      <feComposite in="whiteFill" in2="dilatedWhite" operator="in" result="whiteSticker"/>
      <feMorphology in="SourceAlpha" operator="dilate" radius="8.6" result="dilatedBorder"/>
      <feFlood flood-color="#0F172A" flood-opacity="0.11" result="borderFill"/>
      <feComposite in="borderFill" in2="dilatedBorder" operator="in" result="cutLine"/>
      <feDropShadow in="cutLine" dx="0" dy="5" stdDeviation="5.5" flood-color="#0F172A" flood-opacity="0.15" result="shadowedBase"/>
      <feMerge>
        <feMergeNode in="shadowedBase"/>
        <feMergeNode in="whiteSticker"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <g filter="url(#diecut)">
    ${innerMarkup}
  </g>
</svg>`);
}

// ============================================================================
// 1. HAND-DRAWN WATERCOLOR & INK ACADEMIC ILLUSTRATIONS (Zero Text, Die-Cut)
// ============================================================================

const HAND_DRAWN_ILLUSTRATIONS: Record<string, string> = {
  heart_anatomy: wrapAsDieCutStickerSvg(`
    <path d="M58 46 C48 26, 72 20, 78 38 L78 52" fill="#38BDF8" stroke="#1E293B" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M84 44 C86 22, 112 24, 110 46 L104 58" fill="#FB7185" stroke="#1E293B" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M80 48 C50 42, 34 68, 44 98 C52 122, 76 134, 86 136 C98 132, 122 110, 120 80 C118 56, 98 46, 80 48 Z" fill="#F43F5E" stroke="#1E293B" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M56 68 C66 80, 78 96, 84 126" fill="none" stroke="#FFF1F2" stroke-width="4" stroke-linecap="round"/>
    <path d="M74 78 L88 72 M76 88 L92 84" stroke="#FDE047" stroke-width="4.5" stroke-linecap="round"/>
    <circle cx="62" cy="64" r="6" fill="#FDA4AF" opacity="0.75"/>
  `),

  lungs_anatomy: wrapAsDieCutStickerSvg(`
    <path d="M80 26 L80 64 M80 54 L62 70 M80 54 L98 70" fill="none" stroke="#0EA5E9" stroke-width="7" stroke-linecap="round"/>
    <path d="M72 48 C44 46, 28 74, 30 112 C32 126, 54 128, 70 118 C74 114, 74 62, 72 48 Z" fill="#FDA4AF" stroke="#1E293B" stroke-width="4.2"/>
    <path d="M88 48 C116 46, 132 74, 130 112 C128 126, 106 128, 90 118 C86 114, 86 62, 88 48 Z" fill="#FB7185" stroke="#1E293B" stroke-width="4.2"/>
    <path d="M62 72 L48 84 M56 78 L52 98 M98 72 L112 84 M104 78 L108 98" stroke="#FFE4E6" stroke-width="3.4" stroke-linecap="round"/>
  `),

  brain_neuron: wrapAsDieCutStickerSvg(`
    <path d="M52 98 C32 96, 26 74, 38 60 C34 42, 54 30, 74 36 C86 26, 114 32, 118 50 C134 60, 130 88, 112 96 C110 114, 86 118, 76 108 C64 116, 50 110, 52 98 Z" fill="#C084FC" stroke="#1E293B" stroke-width="4.4" stroke-linejoin="round"/>
    <path d="M52 64 C66 56, 78 68, 92 58 M48 82 C66 78, 84 88, 106 76 M76 38 C74 62, 80 84, 76 108" fill="none" stroke="#F3E8FF" stroke-width="3.8" stroke-linecap="round"/>
    <circle cx="48" cy="54" r="5" fill="#FDE047"/>
    <circle cx="104" cy="64" r="5" fill="#38BDF8"/>
    <circle cx="84" cy="92" r="5" fill="#34D399"/>
  `),

  dna_helix: wrapAsDieCutStickerSvg(`
    <path d="M48 28 C108 52, 52 108, 112 132" fill="none" stroke="#0EA5E9" stroke-width="7" stroke-linecap="round"/>
    <path d="M112 28 C52 52, 108 108, 48 132" fill="none" stroke="#F43F5E" stroke-width="7" stroke-linecap="round"/>
    <line x1="60" y1="40" x2="100" y2="40" stroke="#F59E0B" stroke-width="4.5" stroke-linecap="round"/>
    <line x1="68" y1="58" x2="92" y2="58" stroke="#10B981" stroke-width="4.5" stroke-linecap="round"/>
    <line x1="68" y1="102" x2="92" y2="102" stroke="#8B5CF6" stroke-width="4.5" stroke-linecap="round"/>
    <line x1="60" y1="120" x2="100" y2="120" stroke="#F59E0B" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M48 28 C108 52, 52 108, 112 132 M112 28 C52 52, 108 108, 48 132" fill="none" stroke="#1E293B" stroke-width="2.2" stroke-linecap="round"/>
  `),

  cell_biology: wrapAsDieCutStickerSvg(`
    <ellipse cx="80" cy="82" rx="52" ry="42" fill="#6EE7B7" stroke="#1E293B" stroke-width="4.4"/>
    <ellipse cx="80" cy="82" rx="42" ry="32" fill="#A7F3D0" stroke="#059669" stroke-width="2.5" stroke-dasharray="6 4"/>
    <circle cx="72" cy="78" r="16" fill="#8B5CF6" stroke="#1E293B" stroke-width="3.6"/>
    <circle cx="70" cy="76" r="6" fill="#DDD6FE"/>
    <ellipse cx="104" cy="72" rx="11" ry="7" transform="rotate(-25 104 72)" fill="#F97316" stroke="#1E293B" stroke-width="3"/>
    <ellipse cx="98" cy="96" rx="10" ry="6" transform="rotate(20 98 96)" fill="#F59E0B" stroke="#1E293B" stroke-width="3"/>
  `),

  stethoscope_clinic: wrapAsDieCutStickerSvg(`
    <path d="M50 34 L50 66 C50 88, 86 88, 86 66 L86 34" fill="none" stroke="#0EA5E9" stroke-width="6.5" stroke-linecap="round"/>
    <path d="M68 84 L68 112 C68 130, 112 130, 112 102" fill="none" stroke="#1E293B" stroke-width="5.5" stroke-linecap="round"/>
    <circle cx="112" cy="94" r="15" fill="#F59E0B" stroke="#1E293B" stroke-width="4.2"/>
    <circle cx="112" cy="94" r="7" fill="#FEF08A"/>
    <circle cx="50" cy="32" r="5.5" fill="#F43F5E" stroke="#1E293B" stroke-width="3"/>
    <circle cx="86" cy="32" r="5.5" fill="#F43F5E" stroke="#1E293B" stroke-width="3"/>
  `),

  bone_joint: wrapAsDieCutStickerSvg(`
    <path d="M48 42 C36 34, 30 50, 42 58 L98 114 C106 126, 122 120, 114 108 C126 116, 132 100, 120 92 L64 36 C56 24, 40 30, 48 42 Z" fill="#FEF3C7" stroke="#1E293B" stroke-width="4.4" stroke-linejoin="round"/>
    <circle cx="80" cy="76" r="14" fill="#38BDF8" opacity="0.35"/>
  `),

  opamp_electronics: wrapAsDieCutStickerSvg(`
    <polygon points="48,38 48,122 122,80" fill="#38BDF8" stroke="#1E293B" stroke-width="4.5" stroke-linejoin="round"/>
    <polygon points="54,48 54,112 110,80" fill="#BAE6FD"/>
    <line x1="26" y1="62" x2="48" y2="62" stroke="#F43F5E" stroke-width="5" stroke-linecap="round"/>
    <line x1="26" y1="98" x2="48" y2="98" stroke="#10B981" stroke-width="5" stroke-linecap="round"/>
    <line x1="122" y1="80" x2="140" y2="80" stroke="#F59E0B" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M36 62 L36 28 L66 28 L70 20 L78 36 L86 20 L94 36 L98 28 L128 28 L128 80" fill="none" stroke="#8B5CF6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="57" y1="62" x2="69" y2="62" stroke="#1E293B" stroke-width="3.6" stroke-linecap="round"/>
    <line x1="57" y1="98" x2="69" y2="98" stroke="#1E293B" stroke-width="3.6" stroke-linecap="round"/>
    <line x1="63" y1="92" x2="63" y2="104" stroke="#1E293B" stroke-width="3.6" stroke-linecap="round"/>
  `),

  microchip_cpu: wrapAsDieCutStickerSvg(`
    <rect x="46" y="46" width="68" height="68" rx="12" fill="#10B981" stroke="#1E293B" stroke-width="4.4"/>
    <rect x="60" y="60" width="40" height="40" rx="6" fill="#FDE047" stroke="#1E293B" stroke-width="3.6"/>
    <path d="M58 30 V46 M80 30 V46 M102 30 V46 M58 114 V130 M80 114 V130 M102 114 V130 M30 58 H46 M30 80 H46 M30 102 H46 M114 58 H130 M114 80 H130 M114 102 H130" stroke="#F59E0B" stroke-width="5" stroke-linecap="round"/>
    <circle cx="80" cy="80" r="9" fill="#0EA5E9" stroke="#1E293B" stroke-width="3"/>
  `),

  circuit_components: wrapAsDieCutStickerSvg(`
    <rect x="36" y="44" width="88" height="26" rx="13" fill="#F59E0B" stroke="#1E293B" stroke-width="4.2"/>
    <rect x="52" y="44" width="10" height="26" fill="#EF4444"/>
    <rect x="72" y="44" width="10" height="26" fill="#8B5CF6"/>
    <rect x="92" y="44" width="8" height="26" fill="#FDE047"/>
    <line x1="22" y1="57" x2="36" y2="57" stroke="#1E293B" stroke-width="4.5" stroke-linecap="round"/>
    <line x1="124" y1="57" x2="138" y2="57" stroke="#1E293B" stroke-width="4.5" stroke-linecap="round"/>
    <rect x="52" y="92" width="14" height="34" rx="4" fill="#0EA5E9" stroke="#1E293B" stroke-width="3.8"/>
    <rect x="94" y="92" width="14" height="34" rx="4" fill="#0EA5E9" stroke="#1E293B" stroke-width="3.8"/>
    <line x1="28" y1="109" x2="52" y2="109" stroke="#1E293B" stroke-width="4.2" stroke-linecap="round"/>
    <line x1="108" y1="109" x2="132" y2="109" stroke="#1E293B" stroke-width="4.2" stroke-linecap="round"/>
  `),

  mechanical_gears: wrapAsDieCutStickerSvg(`
    <circle cx="66" cy="70" r="28" fill="#F59E0B" stroke="#1E293B" stroke-width="4.4"/>
    <circle cx="66" cy="70" r="11" fill="#FEF3C7" stroke="#1E293B" stroke-width="3.6"/>
    <circle cx="108" cy="104" r="20" fill="#0EA5E9" stroke="#1E293B" stroke-width="4.2"/>
    <circle cx="108" cy="104" r="8" fill="#E0F2FE" stroke="#1E293B" stroke-width="3.2"/>
    <path d="M66 34 V42 M66 98 V106 M30 70 H38 M94 70 H102 M41 45 L47 51 M85 89 L91 95 M91 45 L85 51 M47 89 L41 95" stroke="#1E293B" stroke-width="6" stroke-linecap="round"/>
  `),

  ai_network: wrapAsDieCutStickerSvg(`
    <line x1="42" y1="46" x2="80" y2="64" stroke="#8B5CF6" stroke-width="4"/>
    <line x1="42" y1="80" x2="80" y2="64" stroke="#0EA5E9" stroke-width="4"/>
    <line x1="42" y1="114" x2="80" y2="96" stroke="#10B981" stroke-width="4"/>
    <line x1="42" y1="80" x2="80" y2="96" stroke="#F59E0B" stroke-width="4"/>
    <line x1="80" y1="64" x2="118" y2="80" stroke="#F43F5E" stroke-width="4.5"/>
    <line x1="80" y1="96" x2="118" y2="80" stroke="#EC4899" stroke-width="4.5"/>
    <circle cx="42" cy="46" r="11" fill="#38BDF8" stroke="#1E293B" stroke-width="3.8"/>
    <circle cx="42" cy="80" r="11" fill="#A78BFA" stroke="#1E293B" stroke-width="3.8"/>
    <circle cx="42" cy="114" r="11" fill="#34D399" stroke="#1E293B" stroke-width="3.8"/>
    <circle cx="80" cy="64" r="13" fill="#FBBF24" stroke="#1E293B" stroke-width="4"/>
    <circle cx="80" cy="96" r="13" fill="#FB7185" stroke="#1E293B" stroke-width="4"/>
    <circle cx="118" cy="80" r="15" fill="#10B981" stroke="#1E293B" stroke-width="4.2"/>
  `),

  justice_scales: wrapAsDieCutStickerSvg(`
    <rect x="54" y="124" width="52" height="12" rx="6" fill="#F59E0B" stroke="#1E293B" stroke-width="4"/>
    <line x1="80" y1="32" x2="80" y2="124" stroke="#1E293B" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M36 52 Q80 42 124 52" fill="none" stroke="#F59E0B" stroke-width="6" stroke-linecap="round"/>
    <line x1="42" y1="52" x2="30" y2="88" stroke="#1E293B" stroke-width="3.2"/>
    <line x1="42" y1="52" x2="54" y2="88" stroke="#1E293B" stroke-width="3.2"/>
    <path d="M26 88 C26 102, 58 102, 58 88 Z" fill="#0EA5E9" stroke="#1E293B" stroke-width="3.8"/>
    <line x1="118" y1="52" x2="106" y2="88" stroke="#1E293B" stroke-width="3.2"/>
    <line x1="118" y1="52" x2="130" y2="88" stroke="#1E293B" stroke-width="3.2"/>
    <path d="M102 88 C102 102, 134 102, 134 88 Z" fill="#0EA5E9" stroke="#1E293B" stroke-width="3.8"/>
    <circle cx="80" cy="32" r="8" fill="#F43F5E" stroke="#1E293B" stroke-width="3.8"/>
  `),

  judge_gavel: wrapAsDieCutStickerSvg(`
    <g transform="rotate(-32 80 76)">
      <rect x="54" y="34" width="52" height="26" rx="8" fill="#D97706" stroke="#1E293B" stroke-width="4.2"/>
      <rect x="74" y="60" width="12" height="58" rx="5" fill="#F59E0B" stroke="#1E293B" stroke-width="4"/>
      <rect x="48" y="32" width="10" height="30" rx="4" fill="#FBBF24" stroke="#1E293B" stroke-width="3.6"/>
      <rect x="102" y="32" width="10" height="30" rx="4" fill="#FBBF24" stroke="#1E293B" stroke-width="3.6"/>
    </g>
    <ellipse cx="96" cy="126" rx="28" ry="9" fill="#8B5CF6" stroke="#1E293B" stroke-width="4"/>
  `),

  law_constitution: wrapAsDieCutStickerSvg(`
    <rect x="38" y="28" width="78" height="104" rx="10" fill="#8B5CF6" stroke="#1E293B" stroke-width="4.4"/>
    <rect x="48" y="28" width="68" height="104" rx="8" fill="#EDE9FE" stroke="#1E293B" stroke-width="4"/>
    <circle cx="82" cy="68" r="18" fill="#F59E0B" stroke="#1E293B" stroke-width="3.6"/>
    <line x1="64" y1="102" x2="100" y2="102" stroke="#1E293B" stroke-width="4" stroke-linecap="round"/>
    <line x1="68" y1="114" x2="96" y2="114" stroke="#64748B" stroke-width="3.6" stroke-linecap="round"/>
  `),

  flying_buttress: wrapAsDieCutStickerSvg(`
    <rect x="66" y="34" width="48" height="98" rx="4" fill="#FDE68A" stroke="#1E293B" stroke-width="4.2"/>
    <path d="M66 34 L90 16 L114 34 Z" fill="#F59E0B" stroke="#1E293B" stroke-width="4.2" stroke-linejoin="round"/>
    <rect x="26" y="64" width="20" height="68" rx="3" fill="#CBD5E1" stroke="#1E293B" stroke-width="4"/>
    <path d="M46 72 Q56 54 66 56 L66 68 Q54 68 46 84 Z" fill="#38BDF8" stroke="#1E293B" stroke-width="3.8"/>
    <path d="M46 100 Q56 84 66 86 L66 98 Q54 98 46 112 Z" fill="#38BDF8" stroke="#1E293B" stroke-width="3.8"/>
    <path d="M80 96 L80 68 Q90 52 100 68 L100 96 Z" fill="#8B5CF6" stroke="#1E293B" stroke-width="3.8"/>
  `),

  dome_arch_vault: wrapAsDieCutStickerSvg(`
    <path d="M36 78 C36 42, 124 42, 124 78 Z" fill="#0EA5E9" stroke="#1E293B" stroke-width="4.4"/>
    <line x1="80" y1="26" x2="80" y2="44" stroke="#F59E0B" stroke-width="5" stroke-linecap="round"/>
    <rect x="32" y="78" width="96" height="12" rx="4" fill="#FDE047" stroke="#1E293B" stroke-width="3.8"/>
    <rect x="38" y="90" width="16" height="40" fill="#F1F5F9" stroke="#1E293B" stroke-width="3.8"/>
    <rect x="106" y="90" width="16" height="40" fill="#F1F5F9" stroke="#1E293B" stroke-width="3.8"/>
    <path d="M54 130 L54 108 C54 92, 106 92, 106 108 L106 130" fill="#FB7185" stroke="#1E293B" stroke-width="3.8"/>
  `),

  architect_blueprint: wrapAsDieCutStickerSvg(`
    <rect x="28" y="34" width="104" height="88" rx="10" fill="#0284C7" stroke="#1E293B" stroke-width="4.4"/>
    <rect x="42" y="48" width="76" height="60" fill="none" stroke="#E0F2FE" stroke-width="3"/>
    <line x1="80" y1="48" x2="80" y2="108" stroke="#E0F2FE" stroke-width="2.6" stroke-dasharray="5 4"/>
    <polygon points="88,72 132,126 88,126" fill="#FBBF24" stroke="#1E293B" stroke-width="4" stroke-linejoin="round"/>
  `),

  polar_math: wrapAsDieCutStickerSvg(`
    <circle cx="80" cy="80" r="46" fill="#EEF2FF" stroke="#1E293B" stroke-width="4.2"/>
    <line x1="28" y1="80" x2="132" y2="80" stroke="#64748B" stroke-width="3" stroke-linecap="round"/>
    <line x1="80" y1="28" x2="80" y2="132" stroke="#64748B" stroke-width="3" stroke-linecap="round"/>
    <path d="M98 80 A18 18 0 0 0 92 66" fill="none" stroke="#F59E0B" stroke-width="4.5"/>
    <line x1="80" y1="80" x2="112" y2="48" stroke="#F43F5E" stroke-width="5.5" stroke-linecap="round"/>
    <circle cx="112" cy="48" r="7.5" fill="#10B981" stroke="#1E293B" stroke-width="3.5"/>
  `),

  chemistry_atom: wrapAsDieCutStickerSvg(`
    <ellipse cx="80" cy="80" rx="52" ry="20" transform="rotate(30 80 80)" fill="none" stroke="#0EA5E9" stroke-width="4.5"/>
    <ellipse cx="80" cy="80" rx="52" ry="20" transform="rotate(-30 80 80)" fill="none" stroke="#8B5CF6" stroke-width="4.5"/>
    <ellipse cx="80" cy="80" rx="52" ry="20" transform="rotate(90 80 80)" fill="none" stroke="#10B981" stroke-width="4.5"/>
    <circle cx="80" cy="80" r="13" fill="#F43F5E" stroke="#1E293B" stroke-width="4"/>
    <circle cx="122" cy="56" r="6.5" fill="#F59E0B" stroke="#1E293B" stroke-width="3"/>
    <circle cx="38" cy="104" r="6.5" fill="#38BDF8" stroke="#1E293B" stroke-width="3"/>
  `),

  ottoman_iltizam: wrapAsDieCutStickerSvg(`
    <path d="M44 34 H108 C116 34, 118 46, 110 50 L106 116 C106 126, 42 126, 42 116 Z" fill="#FEF3C7" stroke="#1E293B" stroke-width="4.2" stroke-linejoin="round"/>
    <ellipse cx="76" cy="34" rx="34" ry="8" fill="#F59E0B" stroke="#1E293B" stroke-width="3.8"/>
    <circle cx="76" cy="76" r="16" fill="#F43F5E" stroke="#1E293B" stroke-width="3.8"/>
    <circle cx="112" cy="112" r="14" fill="#FBBF24" stroke="#1E293B" stroke-width="3.8"/>
    <circle cx="94" cy="120" r="12" fill="#FDE047" stroke="#1E293B" stroke-width="3.6"/>
  `),

  economics_supply: wrapAsDieCutStickerSvg(`
    <rect x="32" y="32" width="96" height="96" rx="14" fill="#F8FAFC" stroke="#1E293B" stroke-width="4.2"/>
    <path d="M46 110 L114 48" fill="none" stroke="#10B981" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M46 48 L114 110" fill="none" stroke="#F43F5E" stroke-width="5.5" stroke-linecap="round"/>
    <circle cx="80" cy="79" r="9" fill="#F59E0B" stroke="#1E293B" stroke-width="3.8"/>
  `),

  academic_books: wrapAsDieCutStickerSvg(`
    <rect x="34" y="92" width="92" height="22" rx="6" fill="#0EA5E9" stroke="#1E293B" stroke-width="4"/>
    <rect x="40" y="68" width="84" height="22" rx="6" fill="#10B981" stroke="#1E293B" stroke-width="4"/>
    <rect x="36" y="44" width="88" height="22" rx="6" fill="#F43F5E" stroke="#1E293B" stroke-width="4"/>
    <path d="M98 44 V62 L106 56 L114 62 V44" fill="#FDE047" stroke="#1E293B" stroke-width="3"/>
  `),
};

// ============================================================================
// 2. PRECISION ACADEMIC SCHEMATICS & DIAGRAMS (`diagram` mode)
// ============================================================================

const ACADEMIC_DIAGRAMS: Record<string, string> = {
  mitral_valve_schema: wrapAsDieCutStickerSvg(`
    <rect x="24" y="24" width="112" height="112" rx="16" fill="#FFF1F2" stroke="#1E293B" stroke-width="3.5"/>
    <path d="M44 40 H76 V74 H44 Z" fill="#BAE6FD" stroke="#0284C7" stroke-width="3"/>
    <path d="M84 40 H116 V74 H84 Z" fill="#FECDD3" stroke="#E11D48" stroke-width="3"/>
    <path d="M44 84 H76 V120 H44 Z" fill="#7DD3FC" stroke="#0284C7" stroke-width="3"/>
    <path d="M84 84 H116 V120 H84 Z" fill="#FDA4AF" stroke="#E11D48" stroke-width="3"/>
    <path d="M84 79 L96 89 M116 79 L104 89" stroke="#1E293B" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M100 54 V106" stroke="#E11D48" stroke-width="3.5" stroke-dasharray="4 3"/>
    <polygon points="100,112 94,102 106,102" fill="#E11D48"/>
  `),

  opamp_inverting_schema: wrapAsDieCutStickerSvg(`
    <rect x="20" y="24" width="120" height="112" rx="14" fill="#F0F9FF" stroke="#1E293B" stroke-width="3.5"/>
    <polygon points="68,54 68,114 118,84" fill="#FFFFFF" stroke="#0F172A" stroke-width="3.6" stroke-linejoin="round"/>
    <polyline points="28,68 40,68 43,62 49,74 55,62 60,68 68,68" fill="none" stroke="#0284C7" stroke-width="3.2" stroke-linejoin="round"/>
    <polyline points="62,68 62,38 78,38 82,32 88,44 94,32 98,38 124,38 124,84" fill="none" stroke="#7C3AED" stroke-width="3.2" stroke-linejoin="round"/>
    <line x1="54" y1="98" x2="68" y2="98" stroke="#0F172A" stroke-width="3"/>
    <line x1="54" y1="98" x2="54" y2="112" stroke="#0F172A" stroke-width="3"/>
    <line x1="46" y1="112" x2="62" y2="112" stroke="#10B981" stroke-width="3.2"/>
    <line x1="50" y1="117" x2="58" y2="117" stroke="#10B981" stroke-width="3.2"/>
    <line x1="118" y1="84" x2="134" y2="84" stroke="#F59E0B" stroke-width="4"/>
  `),

  judicial_hierarchy_schema: wrapAsDieCutStickerSvg(`
    <rect x="22" y="22" width="116" height="116" rx="14" fill="#FAF5FF" stroke="#1E293B" stroke-width="3.5"/>
    <rect x="52" y="32" width="56" height="22" rx="6" fill="#F43F5E" stroke="#1E293B" stroke-width="3"/>
    <rect x="44" y="69" width="72" height="22" rx="6" fill="#8B5CF6" stroke="#1E293B" stroke-width="3"/>
    <rect x="34" y="106" width="92" height="22" rx="6" fill="#0EA5E9" stroke="#1E293B" stroke-width="3"/>
    <path d="M80 106 V94 M80 69 V57" stroke="#1E293B" stroke-width="3.5" stroke-linecap="round"/>
    <polygon points="80,91 75,98 85,98" fill="#1E293B"/>
    <polygon points="80,54 75,61 85,61" fill="#1E293B"/>
  `),

  flying_buttress_schema: wrapAsDieCutStickerSvg(`
    <rect x="22" y="22" width="116" height="116" rx="14" fill="#FFFBEB" stroke="#1E293B" stroke-width="3.5"/>
    <path d="M62 124 V52 Q90 28 118 52 V124" fill="none" stroke="#1E293B" stroke-width="3.8"/>
    <rect x="32" y="64" width="14" height="60" fill="#E2E8F0" stroke="#1E293B" stroke-width="3"/>
    <path d="M62 64 Q52 68 46 78" fill="none" stroke="#F43F5E" stroke-width="4" stroke-dasharray="4 3"/>
    <polygon points="44,82 45,72 53,77" fill="#F43F5E"/>
    <line x1="39" y1="84" x2="39" y2="118" stroke="#0EA5E9" stroke-width="4"/>
    <polygon points="39,122 34,114 44,114" fill="#0EA5E9"/>
  `),

  neuron_synapse_schema: wrapAsDieCutStickerSvg(`
    <rect x="22" y="24" width="116" height="112" rx="14" fill="#F5F3FF" stroke="#1E293B" stroke-width="3.5"/>
    <circle cx="50" cy="80" r="16" fill="#C084FC" stroke="#1E293B" stroke-width="3.2"/>
    <line x1="66" y1="80" x2="112" y2="80" stroke="#F59E0B" stroke-width="6" stroke-linecap="round"/>
    <path d="M112 80 L126 66 M112 80 L126 94 M34 80 L26 68 M34 80 L26 92" stroke="#8B5CF6" stroke-width="3.2" stroke-linecap="round"/>
  `),

  polar_complex_schema: wrapAsDieCutStickerSvg(`
    <rect x="22" y="22" width="116" height="116" rx="14" fill="#F8FAFC" stroke="#1E293B" stroke-width="3.5"/>
    <line x1="36" y1="112" x2="126" y2="112" stroke="#334155" stroke-width="3"/>
    <line x1="48" y1="124" x2="48" y2="34" stroke="#334155" stroke-width="3"/>
    <line x1="48" y1="112" x2="112" y2="52" stroke="#F43F5E" stroke-width="4.5"/>
    <line x1="112" y1="52" x2="112" y2="112" stroke="#0EA5E9" stroke-width="3" stroke-dasharray="4 4"/>
    <path d="M74 112 A26 26 0 0 0 67 94" fill="none" stroke="#F59E0B" stroke-width="3.5"/>
    <circle cx="112" cy="52" r="6" fill="#10B981" stroke="#1E293B" stroke-width="2.8"/>
  `),
};

export function getBuiltInIllustrationSticker(key: string): string {
  return HAND_DRAWN_ILLUSTRATIONS[key] ?? HAND_DRAWN_ILLUSTRATIONS.academic_books;
}

export function getBuiltInDiagramSticker(key?: string): string {
  if (key && ACADEMIC_DIAGRAMS[key]) {
    return ACADEMIC_DIAGRAMS[key];
  }
  return ACADEMIC_DIAGRAMS.polar_complex_schema;
}

export const ALL_CURATED_ILLUSTRATION_KEYS = Object.keys(HAND_DRAWN_ILLUSTRATIONS);
export const ALL_CURATED_DIAGRAM_KEYS = Object.keys(ACADEMIC_DIAGRAMS);
