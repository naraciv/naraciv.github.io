import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import betterTailwind from 'eslint-plugin-better-tailwindcss'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  /*
   * The plugin's correctness preset, which is the half that finds bugs rather
   * than opinions — conflicting utilities, duplicates, unknown class names.
   */
  betterTailwind.configs['correctness-error'],

  {
    files: ['**/*.{ts,tsx}'],
    /* The preset above already registers the plugin; redeclaring it errors. */
    settings: {
      'better-tailwindcss': {
        entryPoint: 'app/globals.css',
      },
    },
    rules: {
      /*
       * Two utilities setting the same property silently pick a winner by
       * stylesheet order, not by which one you wrote last. That is how
       * `border border-surface` on a card already carrying a border from
       * `.property-card-glow` ended up rendering a colour nobody chose.
       */
      'better-tailwindcss/no-conflicting-classes': 'error',

      /*
       * A class name that does not resolve generates no CSS and fails
       * silently — the same failure mode as forgetting an `@source` for a
       * shared package.
       */
      'better-tailwindcss/no-unknown-classes': [
        'error',
        {
          /* Hand-written classes from globals.css, which this rule cannot see. */
          ignore: [
            'active',
            'album-.*',
            'album-arrow',
            'big-city-image',
            'btn-outline',
            'burst-particles',
            'capital-badge',
            'city-image',
            'collection-card',
            'coords-display',
            'countdown',
            'culture-flag',
            'coord-link',
            'custom-scroll',
            'footer-copyright',
            'fullscreen-modal',
            'footer-heading',
            'footer-link',
            'gacha-.*',
            'glass-panel',
            'hero-gacha',
            'homes-portal',
            'item-icon',
            'leaflet-.*',
            'lore-icon',
            'lore-tooltip',
            'machine-.*',
            'map-container',
            'map-control-btn',
            'map-controls',
            'naran-desc',
            'naran-name',
            'naran-title',
            'nav-.*',
            'neon-panel',
            'planner-.*',
            'property-card-glow',
            'pulled',
            'quiz-.*',
            'range-pair',
            'schematic-canvas-container',
            'scrollable-panel',
            'section-title',
            'shop-marker-pill',
            'shops-view',
            'site-footer',
            'skin-render',
            'snitches-view',
            'srp-notice',
            'stars',
            'text-gacha',
            'title-beta',
            'unified-panel',
            'zillow-price-marker',
          ],
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
