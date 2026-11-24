// Copia el plugin compilado a una vault de prueba y lo recarga con el CLI de Obsidian.
// La vault se indica con la variable CARPETA_VAULT o en un archivo `.vault` (una ruta), que git ignora.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const raiz = new URL('..', import.meta.url).pathname;
const manifiesto = JSON.parse(readFileSync(join(raiz, 'manifest.json'), 'utf8'));
const archivoVault = join(raiz, '.vault');
const vault = process.env.CARPETA_VAULT ?? (existsSync(archivoVault) ? readFileSync(archivoVault, 'utf8').trim() : '');
if (!vault) {
  console.error('Indica la vault de prueba: CARPETA_VAULT=/ruta/a/la/vault npm run deploy, o escribe la ruta en .vault');
  process.exit(1);
}
const destino = join(vault, '.obsidian/plugins', manifiesto.id);
mkdirSync(destino, { recursive: true });
for (const archivo of ['main.js', 'manifest.json', 'styles.css']) copyFileSync(join(raiz, archivo), join(destino, archivo));
console.log(`Copiado a ${destino}`);

try {
  const salida = execFileSync('obsidian', [`vault=${basename(vault)}`, 'plugin:reload', `id=${manifiesto.id}`], { encoding: 'utf8' });
  console.log(salida.trim());
} catch (e) {
  console.error('No se pudo recargar con el CLI de Obsidian (¿está abierto?):', e.message);
  process.exit(1);
}
