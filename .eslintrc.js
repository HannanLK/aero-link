module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'no-console': 'error',
  },
  overrides: [
    {
      // Prevent cross-service coupling: services/* must NOT import from other services/*
      files: ['services/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['../../*-service*', '../../../*-service*'],
                message: 'Cross-service imports are forbidden. Use Kafka events or HTTP APIs instead.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['**/*.spec.ts', '**/*.test.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', '*.js'],
};
