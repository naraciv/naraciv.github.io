/**
 * Correctness only — formatting is Prettier's job.
 *
 * A linter that reports two hundred cosmetic findings is a linter nobody reads,
 * so this enables just the rules that catch the bugs the old stylesheet
 * actually had.
 */
export default {
  rules: {
    /*
     * `style.css` declared `.text-primary` twice on consecutive lines, and
     * `.gacha-card` and `.collection-card` twice each hundreds of lines apart
     * with different values — so which one won depended on source order rather
     * than on anyone's intent. These two rules are the whole reason this file
     * exists.
     */
    'declaration-block-no-duplicate-properties': [
      true,
      { ignore: ['consecutive-duplicates-with-different-values'] },
    ],
    'no-duplicate-selectors': true,

    /* A typo in a property or value fails silently in CSS. */
    'property-no-unknown': true,
    'declaration-property-value-no-unknown': true,
    'unit-no-unknown': true,
    'function-no-unknown': [true, { ignoreFunctions: ['theme', '--alpha', '--spacing'] }],
    'named-grid-areas-no-invalid': true,
    'no-invalid-double-slash-comments': true,

    /* `@import` must precede other rules or the browser drops it. */
    'no-invalid-position-at-import-rule': true,

    /* Tailwind v4's at-rules are not in stylelint's dictionary. */
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'theme',
          'source',
          'utility',
          'variant',
          'custom-variant',
          'apply',
          'plugin',
          'reference',
          'config',
        ],
      },
    ],

    /* An empty block or a repeated keyframe step is always a mistake. */
    'block-no-empty': true,
    'keyframe-block-no-duplicate-selectors': true,
    'keyframe-declaration-no-important': true,
    'no-irregular-whitespace': true,
  },
  ignoreFiles: ['**/node_modules/**', '**/.next/**'],
}
