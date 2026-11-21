import tseslint from 'typescript-eslint';

// Kaynakta `eslint-disable react-hooks/exhaustive-deps` yorumları var; eklenti kurulu olmadığından
// kural tanımı bulunamaz ve bu yorumlar hata üretir. Boş bir yer tutucu kural bunu önler.
const reactHooksPlaceholder = { rules: { 'exhaustive-deps': { meta: { schema: [] }, create: () => ({}) } } };

// T-02: yalnız G-02 türü hataları (beklenmeyen/yutulan Promise) derleme anında yakalayan iki kural.
// Mevcut ihlaller bu PR'da düzeltilmez; kurallar "warn" düzeyindedir ve sayıları raporlanır.
export default [
  {
    ignores: [
      '**/node_modules/**', '**/dist/**', 'graphify-out/**', 'data/**',
      'server/data/**', 'server/uploads/**', 'server/backups/**', 'server/prisma/migrations/**',
      '**/tests/**', '**/*.test.ts', '**/*.test.tsx', 'client/src/test/**',
      'scripts/**', 'tests/**', '**/*.d.ts', '**/*.js', '**/*.cjs', '**/*.mjs',
    ],
  },
  {
    files: ['server/**/*.ts', 'client/src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    plugins: { '@typescript-eslint': tseslint.plugin, 'react-hooks': reactHooksPlaceholder },
    rules: {
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
    },
  },
];
