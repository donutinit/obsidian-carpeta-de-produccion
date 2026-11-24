import { analizar } from './fountain';
import type { Escena } from './tipos';

/** Un reemplazo en el texto: de `desde` a `hasta` (desplazamientos) va `texto`. */
export interface Cambio {
  desde: number;
  hasta: number;
  texto: string;
}

/** La escena que contiene una línea fuente (desde 0), o -1 antes de la primera. */
export function escenaEnLinea(escenas: Escena[], linea: number): number {
  let k = -1;
  for (const e of escenas) {
    if (e.linea > linea) break;
    k = e.indice;
  }
  return k;
}

/**
 * Mueve la escena `desde` a la posición `hacia` del orden final. Una escena va de su encabezado
 * a la línea anterior al siguiente encabezado, con sus líneas en blanco del final; si queda en medio
 * sin ninguna, gana una. Devuelve un solo cambio, de la primera escena tocada a la última.
 */
export function moverEscena(fuente: string, desde: number, hacia: number): Cambio | null {
  const escenas = analizar(fuente).escenas;
  const n = escenas.length;
  if (desde === hacia || desde < 0 || hacia < 0 || desde >= n || hacia >= n) return null;
  const lineas = fuente.split('\n');
  const inicioLinea: number[] = [];
  let pos = 0;
  for (const l of lineas) {
    inicioLinea.push(pos);
    pos += l.length + 1;
  }
  const tramos = escenas.map((e, k) => lineas.slice(e.linea, k + 1 < n ? escenas[k + 1].linea : lineas.length));
  const a = Math.min(desde, hacia);
  const b = Math.max(desde, hacia);
  const orden = tramos.slice(a, b + 1);
  const [movida] = orden.splice(desde - a, 1);
  orden.splice(hacia - a, 0, movida);
  const tocaFinal = b === n - 1;
  const piezas = orden.map((t, k) => {
    const enMedio = k < orden.length - 1 || !tocaFinal;
    return enMedio && t[t.length - 1]?.trim() !== '' ? [...t, ''] : t;
  });
  const inicio = inicioLinea[escenas[a].linea];
  const fin = b + 1 < n ? inicioLinea[escenas[b + 1].linea] : fuente.length;
  let texto = piezas.map((t) => t.join('\n')).join('\n');
  if (b + 1 < n) texto += '\n';
  return { desde: inicio, hasta: fin, texto };
}

/** Pone o quita `^` (diálogo dual) en el personaje del bloque del cursor, o en el siguiente si el cursor está en el primero de un par. */
export function alternarDual(fuente: string, pos: number): Cambio | null {
  const lineas = fuente.split('\n');
  const ini: number[] = [];
  let p = 0;
  for (const l of lineas) {
    ini.push(p);
    p += l.length + 1;
  }
  const L = fuente.slice(0, pos).split('\n').length - 1;
  const els = analizar(fuente).elementos;
  const DENTRO = new Set(['acotacion', 'dialogo', 'letra']);
  const bloques: { k: number; desde: number; hasta: number }[] = [];
  els.forEach((e, k) => {
    if (e.tipo !== 'personaje') return;
    let j = k;
    while (j + 1 < els.length && DENTRO.has(els[j + 1].tipo)) j++;
    bloques.push({ k, desde: e.linea, hasta: els[j].linea });
  });
  const b = bloques.findIndex((x) => x.desde <= L && L <= x.hasta);
  if (b < 0) return null;
  // ¿El bloque x viene justo después de otro diálogo de la misma escena?
  const sigueDe = (x: number) => {
    const antes = els[bloques[x].k - 1];
    return !!antes && DENTRO.has(antes.tipo) && antes.escena === els[bloques[x].k].escena;
  };
  const quitarOponer = (x: number): Cambio => {
    const l = bloques[x].desde;
    const texto = lineas[l];
    const m = texto.match(/\s*\^\s*$/);
    if (m) return { desde: ini[l] + (m.index ?? 0), hasta: ini[l] + texto.length, texto: '' };
    const fin = ini[l] + texto.trimEnd().length;
    return { desde: fin, hasta: fin, texto: ' ^' };
  };
  if (els[bloques[b].k].dual || sigueDe(b)) return quitarOponer(b);
  if (b + 1 < bloques.length && sigueDe(b + 1)) return quitarOponer(b + 1);
  return null;
}
