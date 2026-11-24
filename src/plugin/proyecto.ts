import { TFile, type App } from 'obsidian';
import { categoriasDe, DICCIONARIOS_MX, guionMasCercano, limpiarLista, type Config, type Diccionarios } from '../motor';

const carpetaDe = (ruta: string) => (ruta.includes('/') ? ruta.slice(0, ruta.lastIndexOf('/')) : '');

export function propiedades(app: App, f: TFile): Record<string, unknown> {
  return app.metadataCache.getFileCache(f)?.frontmatter ?? {};
}

export const esGuion = (app: App, f: TFile) => propiedades(app, f).carpeta === 'guion';

/** La nota con `carpeta: guion` del proyecto de la nota: ella misma, la de su carpeta o la de la carpeta de arriba más cercana. */
export function buscarGuion(app: App, rutaNota: string): TFile | null {
  const propia = app.vault.getAbstractFileByPath(rutaNota);
  if (propia instanceof TFile && esGuion(app, propia)) return propia;
  const ruta = guionMasCercano(
    rutaNota,
    app.vault.getMarkdownFiles().filter((f) => esGuion(app, f)).map((f) => f.path),
  );
  const f = ruta ? app.vault.getAbstractFileByPath(ruta) : null;
  return f instanceof TFile ? f : null;
}

/** Las notas de la carpeta del guion con `carpeta: <valor>` (por ejemplo, el guion técnico). */
export function notasDelProyecto(app: App, guion: TFile, valor: string): TFile[] {
  const dir = carpetaDe(guion.path);
  return app.vault.getMarkdownFiles().filter((f) => carpetaDe(f.path) === dir && propiedades(app, f).carpeta === valor);
}

/** La nota con `carpeta: proyecto` en la carpeta del guion. */
export function buscarProyecto(app: App, guion: TFile): TFile | null {
  const dir = carpetaDe(guion.path);
  return app.vault.getMarkdownFiles().find((f) => carpetaDe(f.path) === dir && propiedades(app, f).carpeta === 'proyecto') ?? null;
}

const numero = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const booleano = (v: unknown) => (typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : undefined);

/** Lo que cambia los resultados vive en el proyecto: propiedades de la nota `carpeta: proyecto`. */
/** Nombres de las notas de `Personajes/` y `Locaciones/` en la carpeta del guion. */
export function fichasDelProyecto(app: App, rutaNota: string): { personajes: string[]; locaciones: string[] } {
  const guion = buscarGuion(app, rutaNota);
  const dir = guion ? carpetaDe(guion.path) : '';
  const de = (carpeta: string) =>
    app.vault
      .getMarkdownFiles()
      .filter((f) => f.path.startsWith((dir ? dir + '/' : '') + carpeta + '/'))
      .map((f) => f.basename);
  return { personajes: de('Personajes'), locaciones: de('Locaciones') };
}

export function leerConfigProyecto(app: App, rutaNota: string): Partial<Config> {
  const guion = buscarGuion(app, rutaNota);
  const proyecto = guion && buscarProyecto(app, guion);
  const fichas = guion ? fichasDelProyecto(app, guion.path).personajes : [];
  if (!proyecto) return fichas.length ? { personajesConocidos: fichas } : {};
  const p = propiedades(app, proyecto);
  const cfg: Partial<Config> = {};
  if (fichas.length) cfg.personajesConocidos = fichas;
  if (p.categorias_extra !== undefined && p.categorias_extra !== null) cfg.categorias = categoriasDe(p.categorias_extra);
  const r = numero(p.renglones_por_pagina);
  if (Number.isFinite(r)) cfg.renglonesPorPagina = Math.min(56, Math.max(54, Math.round(r)));
  const e = numero(p.espacio_antes_encabezado);
  if (e === 1 || e === 2) cfg.espacioAntesEncabezado = e;
  if (typeof p.texto_mas === 'string' && p.texto_mas.trim()) cfg.textoMas = p.texto_mas.trim();
  if (typeof p.texto_continua === 'string' && p.texto_continua.trim()) cfg.textoContinua = p.texto_continua.trim();
  const ce = booleano(p.conservar_extension);
  if (ce !== undefined) cfg.conservarExtension = ce;
  const up = booleano(p.ultima_pagina_completa);
  if (up !== undefined) cfg.ultimaPaginaCompleta = up;
  if (p.cronometraje === 'pagina' || p.cronometraje === 'caracteres' || p.cronometraje === 'tipo') cfg.cronometraje = p.cronometraje;
  const dic = leerDiccionarios(p);
  if (dic) cfg.diccionarios = dic;
  return cfg;
}

const CLAVES_DIC: (keyof Diccionarios)[] = ['inicios', 'momentos', 'extensiones', 'transiciones'];

/** `dic_inicios`, `dic_momentos`… en las propiedades del proyecto. Una lista presente reemplaza a la de fábrica. */
export function leerDiccionarios(p: Record<string, unknown>): Diccionarios | null {
  let alguno = false;
  const dic = { ...DICCIONARIOS_MX };
  for (const k of CLAVES_DIC) {
    const v = p['dic_' + k];
    if (v === undefined || v === null) continue;
    alguno = true;
    dic[k] = limpiarLista(v);
  }
  return alguno ? dic : null;
}
