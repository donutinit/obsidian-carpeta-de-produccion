import { normalizePath, Notice, TFile, TFolder, type App } from 'obsidian';
import {
  asegurarIds,
  csvDesglose,
  csvElementos,
  csvLocaciones,
  csvReparto,
  duracionEscenas,
  formatearDuracion,
  formatearOctavos,
  listaReparto,
  type Guion,
} from '../motor';
import { aplicarCambios, textoDe } from './cambios';
import { buscarProyecto, propiedades } from './proyecto';
import { construirDe } from './guion';

const LETRAS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Un generador de identificadores de 6 caracteres que no choca con los que ya hay en el texto. */
export function generadorIds(texto: string): () => string {
  const usados = new Set([...texto.matchAll(/\bid=([^;%\s]+)/g)].map((m) => m[1]));
  return () => {
    let id = '';
    do id = Array.from({ length: 6 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');
    while (usados.has(id));
    usados.add(id);
    return id;
  };
}

export async function asignarIds(app: App, guion: TFile): Promise<number> {
  return aplicarCambios(app, guion, (t) => asegurarIds(t, generadorIds(t)));
}

/** `orden_reparto` del proyecto: el orden fijado para los ID de tablero. */
export function ordenReparto(app: App, guion: TFile): string[] {
  const p = buscarProyecto(app, guion);
  const v = p ? propiedades(app, p).orden_reparto : undefined;
  return Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(',').map((x) => x.trim()) : [];
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

type Valor = string | number | boolean | (string | number)[];

function yaml(props: Record<string, Valor>): string {
  const v = (x: string | number | boolean) => (typeof x === 'string' ? JSON.stringify(x) : String(x));
  return Object.entries(props)
    .map(([k, x]) => (Array.isArray(x) ? (x.length ? `${k}:\n${x.map((y) => `  - ${v(y)}`).join('\n')}` : `${k}: []`) : `${k}: ${v(x)}`))
    .join('\n');
}

/** «5» → «05», «5A» → «05A». */
const nombreEscena = (numero: string) => numero.replace(/^\d+/, (d) => d.padStart(2, '0'));

function propsEscena(g: Guion, k: number, guion: TFile, ids: Map<string, number>, dur: number[]): Record<string, Valor> {
  const e = g.doc.escenas[k];
  const b = g.breakdown[k];
  const props: Record<string, Valor> = {
    generado: true,
    carpeta: 'escena',
    guion: `[[${guion.basename}]]`,
    id: e.id ?? '',
    orden: k + 1,
    escena: e.numero,
    int_ext: e.introduccion,
    locacion: e.locacion,
    complejo: e.locacion.split(' - ')[0].trim(),
    momento: e.momento,
    dia_historia: e.meta.dia_historia ?? '',
    octavos: formatearOctavos(g.octavos.porEscena[k] ?? 0),
    octavos_n: g.octavos.porEscena[k] ?? 0,
    paginas: g.octavos.paginasPorEscena[k] ?? [],
    duracion: formatearDuracion(dur[k] ?? 0),
    segundos: Math.round(dur[k] ?? 0),
    reparto: b.reparto,
    reparto_id: b.reparto.map((n) => ids.get(n.toLocaleLowerCase('es')) ?? 0),
  };
  for (const c of g.config.categorias) {
    if (c.codigo === 'rep') continue;
    props[slug(c.nombre)] = (b.elementos[c.codigo] ?? []).map((x) => (x.cantidad > 1 ? `${x.nombre} (×${x.cantidad})` : x.nombre));
  }
  return props;
}

async function asegurarCarpeta(app: App, ruta: string): Promise<void> {
  if (!(app.vault.getAbstractFileByPath(ruta) instanceof TFolder)) await app.vault.createFolder(ruta);
}

/**
 * Una nota por escena en `<proyecto>/Escenas/` con propiedades para Bases. Solo sobrescribe o borra
 * notas con `generado: true`; una nota que el usuario hizo suya (sin esa marca) no se toca.
 */
export async function generarNotasEscena(app: App, guion: TFile): Promise<void> {
  await asignarIds(app, guion);
  const g = await construirDe(app, guion, await textoDe(app, guion));
  const dir = guion.parent && guion.parent.path !== '/' ? guion.parent.path : '';
  const carpeta = normalizePath(`${dir ? dir + '/' : ''}Escenas`);
  await asegurarCarpeta(app, carpeta);
  const ids = new Map(listaReparto(g, ordenReparto(app, guion)).map((r) => [r.nombre.toLocaleLowerCase('es'), r.id]));
  const dur = duracionEscenas(g);
  const escritas = new Set<string>();
  let saltadas = 0;
  for (let k = 0; k < g.doc.escenas.length; k++) {
    const e = g.doc.escenas[k];
    const ruta = normalizePath(`${carpeta}/Escena ${nombreEscena(e.numero)}.md`);
    const texto = `---\n${yaml(propsEscena(g, k, guion, ids, dur))}\n---\n# ${e.numero}. ${e.encabezado}\n\nGenerada desde [[${guion.basename}]]. No la edites: se vuelve a escribir con «Generar notas por escena».\n`;
    const previa = app.vault.getAbstractFileByPath(ruta);
    if (previa instanceof TFile) {
      if (propiedades(app, previa).generado !== true) {
        saltadas++;
        continue;
      }
      await app.vault.modify(previa, texto);
    } else await app.vault.create(ruta, texto);
    escritas.add(ruta);
  }
  // Las generadas de escenas que ya no existen se van a la papelera.
  let borradas = 0;
  const f = app.vault.getAbstractFileByPath(carpeta);
  if (f instanceof TFolder) {
    for (const h of [...f.children]) {
      if (h instanceof TFile && h.extension === 'md' && !escritas.has(h.path) && propiedades(app, h).generado === true) {
        await app.fileManager.trashFile(h);
        borradas++;
      }
    }
  }
  const base = normalizePath(`${dir ? dir + '/' : ''}Escenas.base`);
  if (!app.vault.getAbstractFileByPath(base)) {
    await app.vault.create(
      base,
      `filters:\n  and:\n    - file.inFolder(${JSON.stringify(carpeta)})\n    - generado == true\nviews:\n  - type: table\n    name: Desglose\n    order:\n      - escena\n      - int_ext\n      - locacion\n      - momento\n      - octavos\n      - paginas\n      - duracion\n      - reparto\n    sort:\n      - property: orden\n        direction: ASC\n`,
    );
  }
  const partes = [`${escritas.size} notas de escena`];
  if (borradas) partes.push(`${borradas} a la papelera`);
  if (saltadas) partes.push(`${saltadas} sin tocar porque no tienen «generado: true»`);
  new Notice(partes.join(' · ') + '.');
}

/** Los cuatro CSV del breakdown en `<proyecto>/Exportación/`. */
export async function exportarCSV(app: App, guion: TFile): Promise<void> {
  const g = await construirDe(app, guion, await textoDe(app, guion));
  const dir = guion.parent && guion.parent.path !== '/' ? guion.parent.path : '';
  const carpeta = normalizePath(`${dir ? dir + '/' : ''}Exportación`);
  await asegurarCarpeta(app, carpeta);
  const orden = ordenReparto(app, guion);
  const archivos: [string, string][] = [
    ['desglose.csv', csvDesglose(g, orden)],
    ['reparto.csv', csvReparto(g, orden)],
    ['locaciones.csv', csvLocaciones(g)],
    ['elementos.csv', csvElementos(g)],
  ];
  for (const [nombre, texto] of archivos) {
    const ruta = normalizePath(`${carpeta}/${nombre}`);
    const previo = app.vault.getAbstractFileByPath(ruta);
    if (previo instanceof TFile) await app.vault.modify(previo, texto);
    else await app.vault.create(ruta, texto);
  }
  new Notice(`Breakdown exportado a «${carpeta}» (4 archivos CSV).`);
}
