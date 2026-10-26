import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['node_modules', 'out', 'dist', '.dev-app', 'docs', '.sync'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // MASTER rule 4.2: no any unless a comment explains the reason.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' }
      ],
      // MASTER rule 4.15: use the logger, never console.
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // MASTER rule 4.13: real elements for interaction, no onClick on div.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='div'] > JSXAttribute[name.name='onClick']",
          message: 'Dùng button, input hoặc label thay vì gắn onClick lên div (MASTER 4.13).'
        }
      ]
    }
  },
  {
    files: [
      'src/main/**/*.ts',
      'src/preload/**/*.ts',
      'src/shared/**/*.ts',
      'tests/**/*.ts',
      'scripts/**/*.mjs',
      '*.config.{js,mjs,ts}'
    ],
    languageOptions: { globals: globals.node }
  },
  {
    // Build scripts are command line tools, so console output is their interface.
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' }
  }
)
