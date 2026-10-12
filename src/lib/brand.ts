// @polsia:user-owned — brand identity. Edit freely. `site.ts` re-exports
// siteName/siteDescription; `manifest.ts` + `opengraph-image.tsx` read `brandVisual`.

export const siteName = 'Eje en Calma';
export const siteDescription =
  'Propuesta educativa híbrida de 12 semanas sobre salud digestiva, alimentación y regulación emocional.';

// PWA + social-share colors. HEX only (CSS variables aren't readable here) — set
// them to match the theme you define in src/app/brand-theme.css. The starter
// values are achromatic placeholders, not a palette.
export const brandVisual = {
  /** PWA browser-UI / status-bar color — usually your background or primary. */
  themeColor: '#315e4b',
  /** PWA splash + install background. */
  backgroundColor: '#f5f6ef',
  /** Social-share (OG/Twitter) image. */
  og: {
    background: '#f5f6ef',
    foreground: '#20352b',
    /** Second line under the site name; '' hides it. */
    tagline: 'Propuesta educativa · nombre de trabajo',
    /** Optional https PNG/JPEG background photo; '' keeps the plain-color card. */
    image: '',
  },
} as const;
