import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const opciones = {
  entryPoints: ['src/plugin/main.ts'],
  bundle: true,
  format: 'cjs',
  target: 'es2020',
  platform: 'browser',
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
  outfile: 'main.js',
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
  banner: { js: '/* Carpeta de producción · MIT · https://opensource.org/license/mit */' },
};

if (watch) {
  const ctx = await esbuild.context(opciones);
  await ctx.watch();
} else {
  await esbuild.build(opciones);
}
