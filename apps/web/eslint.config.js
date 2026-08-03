import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactPlugin from 'eslint-plugin-react';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import typeImportsAfterValue from '../../eslint-rules/type-imports-after-value.mjs';
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
      local: {
        rules: {
          'type-imports-after-value': typeImportsAfterValue,
        },
      },
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
      'local/type-imports-after-value': 'error',
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

  // Node globals + Vitest rules; build scripts run in Node, not browser
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
      local: {
        rules: {
          'type-imports-after-value': typeImportsAfterValue,
        },
      },
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
      'local/type-imports-after-value': 'error',
      'vitest/no-focused-tests': 'error',
      // valid-expect enforces Jest's 1-arg; the manifest test uses 2-arg
      // see https://vitest.dev/api/expect.html
      'vitest/valid-expect': 'off',
    },
  },
);
