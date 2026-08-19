import importIdentifierOrder from './eslint-rules/import-identifier-order.mjs';
import js from '@eslint/js';
import noCommentBlockInBody from './eslint-rules/no-comment-block-in-body.mjs';
import prettier from 'eslint-config-prettier';

const rootFiles = [
  'eslint-rules/**/*.mjs',
  'scripts/**/*.mjs',
  'eslint.config.mjs',
];

export default [
  {
    ignores: ['apps/**'],
  },

  { ...js.configs.recommended, files: rootFiles },
  { ...prettier, files: rootFiles },

  {
    files: rootFiles,
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
      sourceType: 'module',
    },
    plugins: {
      local: {
        rules: {
          'import-identifier-order': importIdentifierOrder,
          'no-comment-block-in-body': noCommentBlockInBody,
        },
      },
    },
    rules: {
      'local/import-identifier-order': 'error',
      'local/no-comment-block-in-body': 'error',
    },
  },
];
