import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactPlugin from 'eslint-plugin-react';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import vitest from 'eslint-plugin-vitest';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
      },
      ecmaVersion: 2022,
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      sourceType: 'module',
    },
    plugins: {
      'jsx-a11y': jsxA11y,
      react: reactPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      vitest,
    },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      ...vitest.configs.recommended.rules,
      'jsx-a11y/label-has-associated-control': [
        'error',
        { controlComponents: ['FormInput'], assert: 'either', depth: 2 },
      ],
      'react/react-in-jsx-scope': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-refresh/only-export-components': 'off',
      'vitest/no-focused-tests': 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // Build scripts run in Node, not the browser. Inject Node globals (console,
  // process, etc.) and the vitest rule set used by the manifest sync test.
  {
    files: ['scripts/**/*.{ts,mjs}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/no-focused-tests': 'error',
      // Vitest officially supports `expect(value, message)` as a custom
      // failure message — distinct from Jest. The plugin's `valid-expect` rule
      // enforces Jest's one-arg shape and is incorrect for Vitest. The
      // manifest sync test relies on the two-arg form for diagnostic guidance.
      // See https://vitest.dev/api/expect.html
      'vitest/valid-expect': 'off',
    },
  },
);
