import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import importIdentifierOrder from '../../eslint-rules/import-identifier-order.mjs';
import noCommentBlockInBody from '../../eslint-rules/no-comment-block-in-body.mjs';
import typeImportsAfterValue from '../../eslint-rules/type-imports-after-value.mjs';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,

  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
      },
      parser: tseslint.parser,
      sourceType: 'module',
    },
    plugins: {
      local: {
        rules: {
          'import-identifier-order': importIdentifierOrder,
          'no-comment-block-in-body': noCommentBlockInBody,
          'type-imports-after-value': typeImportsAfterValue,
        },
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'local/import-identifier-order': 'error',
      'local/no-comment-block-in-body': 'error',
      'local/type-imports-after-value': 'error',
    },
  },
);
