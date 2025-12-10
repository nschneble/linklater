import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

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
			ecmaVersion: 2022,
			sourceType: 'module',
			parser: tseslint.parser,
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
			globals: {
				window: 'readonly',
				document: 'readonly',
			},
		},
		plugins: {
			react: reactPlugin,
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
		},
		rules: {
			'react/react-in-jsx-scope': 'off',
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn',
			'react-refresh/only-export-components': 'off',
		},
		settings: {
			react: {
				version: 'detect',
			},
		},
	}
);
