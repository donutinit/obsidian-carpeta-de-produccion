import obsidianmd from 'eslint-plugin-obsidianmd';

export default [
  // Salida de la compilación, scripts de Node y pruebas: no son código del plugin.
  { ignores: ['node_modules', 'main.js', 'esbuild.config.mjs', 'eslint.config.mjs', 'vitest.config.ts', 'scripts/**', 'tests/**', 'privado/**', '.superpowers/**'] },
  ...obsidianmd.configs.recommended,
  { languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
];
