import { analizarEnLinea, textoPlano } from './enlinea';
import type { Guion } from './index';
import type { Documento, Elemento } from './tipos';

const plano = (e: Elemento) => textoPlano(analizarEnLinea(e.texto.replace(/\n/g, ' ')));

const IMPRESOS = new Set(['encabezado', 'accion', 'plano', 'personaje', 'acotacion', 'dialogo', 'letra', 'transicion', 'centrado']);

/** Segundos por escena según el modo de cronometraje del proyecto. */
export function duracionEscenas(g: Guion): number[] {
  const n = g.doc.escenas.length;
  if (g.config.cronometraje === 'pagina') return g.octavos.porEscena.slice(0, n).map((o) => o * 7.5);
  const out = new Array<number>(n).fill(0);
  for (const e of g.doc.elementos) {
    if (e.escena < 0 || !IMPRESOS.has(e.tipo)) continue;
    const c = plano(e).length;
    if (g.config.cronometraje === 'caracteres') out[e.escena] += (c * 60) / 1350;
    else if (e.tipo === 'accion') out[e.escena] += 1 + (1.5 * c) / 50;
    else if (e.tipo === 'dialogo' || e.tipo === 'letra') out[e.escena] += 2 + (2.4 * c) / 50;
    else if (e.tipo === 'encabezado') out[e.escena] += 2;
  }
  return out;
}

export function duracionTotal(g: Guion): number {
  if (g.config.cronometraje === 'pagina') return g.octavos.total * 7.5;
  return duracionEscenas(g).reduce((a, b) => a + b, 0);
}

/** «m:ss», redondeando al segundo. */
export function formatearDuracion(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const PALABRA = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/** Palabras impresas: sin secciones, sinopsis, comentarios ni códigos de marca. */
export function contarPalabras(doc: Documento): number {
  let n = 0;
  for (const e of doc.elementos) if (IMPRESOS.has(e.tipo)) n += plano(e).match(PALABRA)?.length ?? 0;
  return n;
}
