import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'node_modules/**',
      'vendor/**',
      'captures/**',
      '.capture-state/**',
      'js/control-dependencies.js',
      'js/control-routing.js',
      'js/video-grade.js',
      'js/lfo-engine.js',
      'js/lfo-state.js',
      'js/lfo.js',
      'js/audio/beat-clock.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.ts'],
  })),
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: false,
          allowTypedFunctionExpressions: false,
          allowHigherOrderFunctions: false,
        },
      ],
    },
  },
  {
    files: ['js/**/*.js', 'src/**/*.ts'],
    ignores: [
      'src/**/*.test.ts',
      'js/audio/tempo-worker.js',
      'js/audio/rhythm-worklet.js',
    ],
    languageOptions: { globals: globals.browser },
  },
  { files: ['sw.js'], languageOptions: { globals: globals.serviceworker } },
  {
    files: ['js/audio/tempo-worker.js'],
    languageOptions: { globals: globals.worker },
  },
  {
    files: ['js/audio/rhythm-worklet.js'],
    languageOptions: { globals: globals.audioWorklet },
  },
  {
    files: [
      'tools/**/*.{js,mjs,ts}',
      'tests/**/*.{js,mjs,ts}',
      '**/*.test.ts',
      'eslint.config.js',
    ],
    languageOptions: { globals: globals.node },
  },
  // Legacy browser automation evaluates these functions inside a page, not Node.
  {
    files: [
      'tests/**/*.mjs',
      'tests/laptop-check.js',
      'tools/capture/browser.mjs',
      'tools/capture/run.mjs',
      'tools/perf/benchmark.mjs',
    ],
    languageOptions: { globals: globals.browser },
  },
];
