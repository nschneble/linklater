import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

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
			sourceType: 'module',
			parser: tseslint.parser,
			globals: {
				process: 'readonly',
				__dirname: 'readonly',
			},
		},
		rules: {
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
		},
	}
);
