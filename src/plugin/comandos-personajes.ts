import { normalizePath, Notice, TFile, TFolder, type App, type Plugin } from 'obsidian';
import { fichaPersonaje, guionEpisodio, personajesDelGuion, propuestaSerie } from '../motor';
import { guionActivo } from './comandos-produccion';
import { ModalTitulo } from './comandos';
import { correr } from './correr';
import { construirDe } from './guion';
import { propiedades } from './proyecto';

const carpetaDe = (ruta: string) => (ruta.includes('/') ? ruta.slice(0, ruta.lastIndexOf('/')) : '');
/** Un nombre que sirve como nombre de archivo: sin los caracteres prohibidos, sin espacios dobles ni puntos en los extremos. */
const limpiar = (s: string) =>
  s
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .trim();
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

async function asegurarCarpeta(app: App, ruta: string): Promise<void> {
  if (ruta && !app.vault.getAbstractFileByPath(ruta)) await app.vault.createFolder(ruta);
}

/**
 * Una ficha por personaje del guion en `Personajes/`, junto al guion. Nunca sobrescribe una que ya existe, aunque
 * tenga otras mayúsculas o acentos (`ANA.md` es la ficha de «Ana»); en macOS y Windows el disco no los distingue.
 */
async function crearFichas(app: App, guion: TFile): Promise<void> {
  const g = await construirDe(app, guion);
  const dir = carpetaDe(guion.path);
  const existente = guion.parent?.children.find((c) => c instanceof TFolder && sinAcentos(c.name) === 'personajes');
  const carpeta = existente ? existente.path : normalizePath(`${dir ? dir + '/' : ''}Personajes`);
  await asegurarCarpeta(app, carpeta);
  const ya = new Set(
    app.vault
      .getMarkdownFiles()
      .filter((f) => carpetaDe(f.path) === carpeta)
      .map((f) => sinAcentos(f.basename)),
  );
  let nuevas = 0;
  for (const nombre of personajesDelGuion(g)) {
    const archivo = limpiar(nombre);
    if (!archivo || ya.has(sinAcentos(archivo))) continue;
    const ruta = normalizePath(`${carpeta}/${archivo}.md`);
    if (await app.vault.adapter.exists(ruta)) continue;
    await app.vault.create(ruta, fichaPersonaje(nombre));
    ya.add(sinAcentos(archivo));
    nuevas++;
  }
  new Notice(nuevas ? `${nuevas} ${nuevas === 1 ? 'ficha nueva' : 'fichas nuevas'} en «${carpeta}».` : 'Todos los personajes del reparto ya tienen ficha.');
}

/** Una serie: su propuesta y el primer episodio, cada episodio en su carpeta con su guion. */
async function nuevaSerie(app: App, tituloCrudo: string): Promise<void> {
  const titulo = limpiar(tituloCrudo);
  if (!titulo) return void new Notice('Falta el título.');
  const dir = normalizePath(`Proyectos/${titulo}`);
  if (app.vault.getAbstractFileByPath(dir)) return void new Notice(`Ya existe «${dir}».`);
  await asegurarCarpeta(app, 'Proyectos');
  await app.vault.createFolder(dir);
  const propuesta = await app.vault.create(`${dir}/00 - Propuesta.md`, propuestaSerie(titulo));
  await app.vault.createFolder(`${dir}/Episodio 1`);
  await app.vault.create(`${dir}/Episodio 1/02 - Guion.md`, guionEpisodio(titulo, 1));
  await app.workspace.getLeaf(true).openFile(propuesta);
  new Notice(`Serie «${titulo}» creada.`);
}

/** La propuesta de serie de la nota: en su carpeta o en una de arriba. */
function serieDe(app: App, nota: TFile): TFile | null {
  let dir = carpetaDe(nota.path);
  for (;;) {
    const s = app.vault.getMarkdownFiles().find((f) => carpetaDe(f.path) === dir && propiedades(app, f).carpeta === 'serie');
    if (s) return s;
    if (!dir) return null;
    dir = carpetaDe(dir);
  }
}

async function nuevoEpisodio(app: App, serie: TFile): Promise<void> {
  const dir = carpetaDe(serie.path);
  const t = propiedades(app, serie).titulo;
  const titulo = typeof t === 'string' && t.trim() ? t.trim() : (serie.parent?.name ?? 'Serie');
  const usados = app.vault
    .getAllLoadedFiles()
    .map((f) => (carpetaDe(f.path) === dir ? /^Episodio (\d+)$/.exec(f.name)?.[1] : undefined))
    .filter((x): x is string => !!x)
    .map(Number);
  const n = (usados.length ? Math.max(...usados) : 0) + 1;
  await app.vault.createFolder(`${dir}/Episodio ${n}`);
  const guion = await app.vault.create(`${dir}/Episodio ${n}/02 - Guion.md`, guionEpisodio(titulo, n));
  await app.workspace.getLeaf(true).openFile(guion);
  new Notice(`Episodio ${n} creado.`);
}

export function registrarPersonajes(plugin: Plugin): void {
  const app = plugin.app;
  plugin.addCommand({
    id: 'crear-fichas',
    name: 'Crear fichas de personaje',
    checkCallback: (checking) => {
      const g = guionActivo(app);
      if (!g) return false;
      if (!checking) correr(crearFichas(app, g));
      return true;
    },
  });
  plugin.addCommand({ id: 'nueva-serie', name: 'Nueva serie', callback: () => new ModalTitulo(app, (t) => correr(nuevaSerie(app, t)), 'Nueva serie', 'Título de la serie').open() });
  plugin.addCommand({
    id: 'nuevo-episodio',
    name: 'Nuevo episodio de la serie',
    checkCallback: (checking) => {
      const f = app.workspace.getActiveFile();
      const s = f ? serieDe(app, f) : null;
      if (!s) return false;
      if (!checking) correr(nuevoEpisodio(app, s));
      return true;
    },
  });
}
