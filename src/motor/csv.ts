import { duracionEscenas } from './duracion';
import type { Guion } from './index';
import { listaElementos, listaLocaciones, listaReparto } from './listas';
import { formatearOctavos } from './octavos';

type Celda = string | number;

/** CSV para Excel y Hojas de cálculo: UTF-8 con BOM, comas, comillas dobles cuando hace falta, CRLF. */
export function aCSV(filas: Celda[][]): string {
  const celda = (v: Celda) => {
    // Nada que la hoja de cálculo lea como fórmula.
    const s = typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + filas.map((f) => f.map(celda).join(',') + '\r\n').join('');
}

const lista = (xs: string[]) => xs.join(', ');
/** «2/8 pág.» y «1 min 30 s»: sin sufijo, Excel lee «2/8» como fecha y «1:30» como hora. */
const largo = (octavos: number) => `${formatearOctavos(octavos)} pág.`;
const duracion = (s: number) => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)} min ${t % 60} s`;
};
const nombreCategoria = (g: Guion, codigo: string) => g.config.categorias.find((c) => c.codigo === codigo)?.nombre ?? codigo;

/** Hoja «Desglose»: una fila por escena. */
export function csvDesglose(g: Guion, orden: string[] = []): string {
  const ids = new Map(listaReparto(g, orden).map((r) => [r.nombre.toLocaleLowerCase('es'), r.id]));
  const dur = duracionEscenas(g);
  const cats = g.config.categorias.filter((c) => c.codigo !== 'rep');
  const filas: Celda[][] = [
    ['Orden', 'Escena', 'INT./EXT.', 'Locación', 'Set', 'Complejo', 'Momento', 'Día de la historia', 'Largo (pág.)', 'Octavos', 'Duración', 'Segundos', 'En páginas', 'Reparto', 'Reparto (ID)', ...cats.map((c) => c.nombre)],
  ];
  g.doc.escenas.forEach((e, k) => {
    const b = g.breakdown[k];
    filas.push([
      k + 1,
      e.numero,
      e.introduccion,
      e.locacion,
      e.locacion,
      e.locacion.split(' - ')[0].trim(),
      e.momento,
      e.meta.dia_historia ?? '',
      largo(g.octavos.porEscena[k] ?? 0),
      g.octavos.porEscena[k] ?? 0,
      duracion(dur[k] ?? 0),
      Math.round(dur[k] ?? 0),
      lista((g.octavos.paginasPorEscena[k] ?? []).map(String)),
      lista(b.reparto),
      lista(b.reparto.map((n) => String(ids.get(n.toLocaleLowerCase('es')) ?? ''))),
      ...cats.map((c) => lista((b.elementos[c.codigo] ?? []).map((x) => (x.cantidad > 1 ? `${x.nombre} (×${x.cantidad})` : x.nombre)))),
    ]);
  });
  return aCSV(filas);
}

export function csvReparto(g: Guion, orden: string[] = []): string {
  return aCSV([
    ['ID', 'Personaje', 'Número de escenas', 'Escenas', 'Largo (pág.)', 'Octavos', 'Duración', 'Segundos'],
    ...listaReparto(g, orden).map((r) => [r.id, r.nombre, r.escenas.length, lista(r.escenas), largo(r.octavos), r.octavos, duracion(r.segundos), Math.round(r.segundos)]),
  ]);
}

export function csvLocaciones(g: Guion): string {
  return aCSV([
    ['Complejo', 'Set', 'INT./EXT.', 'Número de escenas', 'Escenas', 'Largo (pág.)', 'Octavos', 'Duración', 'Segundos', 'Reparto'],
    ...listaLocaciones(g).map((l) => [l.complejo, l.set, lista(l.intExt), l.escenas.length, lista(l.escenas), largo(l.octavos), l.octavos, duracion(l.segundos), Math.round(l.segundos), lista(l.reparto)]),
  ]);
}

export function csvElementos(g: Guion): string {
  return aCSV([
    ['Categoría', 'Elemento', 'Cantidad máxima', 'Número de escenas', 'Escenas'],
    ...listaElementos(g).map((x) => [nombreCategoria(g, x.codigo), x.nombre, x.cantidad, x.escenas.length, lista(x.escenas)]),
  ]);
}
