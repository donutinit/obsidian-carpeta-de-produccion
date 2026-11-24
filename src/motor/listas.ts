import { duracionEscenas } from './duracion';
import type { Guion } from './index';

const mismo = (a: string, b: string) => a.toLocaleLowerCase('es') === b.toLocaleLowerCase('es');

export interface FilaReparto {
  /** ID de tablero: 1 = protagonista. */
  id: number;
  nombre: string;
  escenas: string[];
  octavos: number;
  segundos: number;
}

/**
 * Lista de reparto. El ID de tablero sale del orden fijado en el proyecto (`orden_reparto`) y,
 * para los demás, del número de escenas (desempate: primera aparición).
 */
export function listaReparto(g: Guion, orden: string[] = []): FilaReparto[] {
  const dur = duracionEscenas(g);
  const filas: Omit<FilaReparto, 'id'>[] = [];
  g.breakdown.forEach((b, k) => {
    for (const n of b.reparto) {
      let f = filas.find((x) => mismo(x.nombre, n));
      if (!f) filas.push((f = { nombre: n, escenas: [], octavos: 0, segundos: 0 }));
      f.escenas.push(g.doc.escenas[k].numero);
      f.octavos += g.octavos.porEscena[k] ?? 0;
      f.segundos += dur[k] ?? 0;
    }
  });
  const fijo = (n: string) => {
    const i = orden.findIndex((o) => mismo(o.trim(), n));
    return i < 0 ? Infinity : i;
  };
  const primera = new Map(filas.map((f, i) => [f, i]));
  filas.sort((a, b) => fijo(a.nombre) - fijo(b.nombre) || b.escenas.length - a.escenas.length || primera.get(a)! - primera.get(b)!);
  return filas.map((f, i) => ({ id: i + 1, ...f }));
}

export interface FilaLocacion {
  /** Lo que va antes del primer « - » (CASA en «CASA - COCINA»). */
  complejo: string;
  set: string;
  intExt: string[];
  escenas: string[];
  octavos: number;
  segundos: number;
  reparto: string[];
}

export function listaLocaciones(g: Guion): FilaLocacion[] {
  const dur = duracionEscenas(g);
  const filas: FilaLocacion[] = [];
  g.doc.escenas.forEach((e, k) => {
    const set = e.locacion || e.encabezado;
    let f = filas.find((x) => x.set === set);
    if (!f) filas.push((f = { complejo: set.split(' - ')[0].trim(), set, intExt: [], escenas: [], octavos: 0, segundos: 0, reparto: [] }));
    if (e.introduccion && !f.intExt.includes(e.introduccion)) f.intExt.push(e.introduccion);
    f.escenas.push(e.numero);
    f.octavos += g.octavos.porEscena[k] ?? 0;
    f.segundos += dur[k] ?? 0;
    for (const n of g.breakdown[k].reparto) if (!f.reparto.some((x) => mismo(x, n))) f.reparto.push(n);
  });
  return filas;
}

export interface FilaElemento {
  codigo: string;
  nombre: string;
  /** La mayor cantidad que pide una sola escena: es lo que hay que conseguir. */
  cantidad: number;
  escenas: string[];
}

/** Elementos por categoría (sin el reparto, que tiene su lista), en el orden de las categorías del proyecto. */
export function listaElementos(g: Guion, codigo?: string): FilaElemento[] {
  const orden = g.config.categorias.map((c) => c.codigo);
  const filas: FilaElemento[] = [];
  g.breakdown.forEach((b, k) => {
    for (const [cat, lista] of Object.entries(b.elementos)) {
      if (codigo ? cat !== codigo : cat === 'rep') continue;
      for (const x of lista) {
        let f = filas.find((y) => y.codigo === cat && mismo(y.nombre, x.nombre));
        if (!f) filas.push((f = { codigo: cat, nombre: x.nombre, cantidad: 0, escenas: [] }));
        f.cantidad = Math.max(f.cantidad, x.cantidad);
        f.escenas.push(g.doc.escenas[k].numero);
      }
    }
  });
  const pos = (c: string) => (orden.includes(c) ? orden.indexOf(c) : orden.length);
  const primera = new Map(filas.map((f, i) => [f, i]));
  return filas.sort((a, b) => pos(a.codigo) - pos(b.codigo) || a.codigo.localeCompare(b.codigo) || primera.get(a)! - primera.get(b)!);
}
