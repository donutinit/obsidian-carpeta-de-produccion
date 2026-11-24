import { duracionTotal, formatearDuracion } from './duracion';
import type { Guion } from './index';
import { listaLocaciones, listaReparto } from './listas';
import { formatearOctavos } from './octavos';

export interface Reglas {
  max_paginas?: number;
  min_paginas?: number;
  max_duracion?: number;
  min_duracion?: number;
  max_escenas?: number;
  max_locaciones?: number;
  max_personajes?: number;
  max_personajes_escena?: number;
  max_noches_pct?: number;
  min_escenas_por_locacion?: number;
  min_principales_pct?: number;
  locaciones_principales?: string[];
}

export interface ResultadoRegla {
  regla: keyof Reglas;
  nombre: string;
  estado: 'ok' | 'advertencia' | 'falla';
  detalle: string;
  culpables: string[];
}

const NUMERICAS: (keyof Reglas)[] = [
  'max_paginas',
  'min_paginas',
  'max_duracion',
  'min_duracion',
  'max_escenas',
  'max_locaciones',
  'max_personajes',
  'max_personajes_escena',
  'max_noches_pct',
  'min_escenas_por_locacion',
  'min_principales_pct',
];

/** Las restricciones del proyecto desde sus propiedades. Una propiedad vacía o no numérica no es regla. */
export function leerReglas(props: Record<string, unknown>): Reglas {
  const r: Reglas = {};
  for (const k of NUMERICAS) {
    const v = props[k];
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : NaN;
    if (Number.isFinite(n)) (r as Record<string, number>)[k] = n;
  }
  const p = props.locaciones_principales;
  const lista = (Array.isArray(p) ? p : typeof p === 'string' ? p.split(',') : []).map((x) => String(x).trim().toUpperCase()).filter(Boolean);
  if (lista.length) r.locaciones_principales = lista;
  return r;
}

const esPrincipal = (set: string, principales: string[]) => principales.some((p) => (p.endsWith('*') ? set.startsWith(p.slice(0, -1).trim()) : set === p));
const pct = (n: number) => `${Math.round(n)} %`;

/** Compara el guion contra las restricciones del proyecto: ok, advertencia (al 90 % de un máximo) o falla. */
export function verificarRequisitos(g: Guion, reglas: Reglas): ResultadoRegla[] {
  const out: ResultadoRegla[] = [];
  const maximo = (regla: keyof Reglas, nombre: string, valor: number, max: number, detalle: string, culpables: string[] = [], tolerancia = 0) =>
    out.push({ regla, nombre, estado: valor > max + tolerancia ? 'falla' : max > 0 && valor >= max * 0.9 ? 'advertencia' : 'ok', detalle, culpables });
  const minimo = (regla: keyof Reglas, nombre: string, valor: number, min: number, detalle: string, culpables: string[] = []) =>
    out.push({ regla, nombre, estado: valor < min ? 'falla' : 'ok', detalle, culpables });
  const escenas = g.doc.escenas;
  const n = escenas.length;
  const total = g.octavos.total;

  if (reglas.max_paginas !== undefined) {
    const lim = Math.round(reglas.max_paginas * 8);
    maximo('max_paginas', 'Páginas', total, lim, `${formatearOctavos(total)} de ${formatearOctavos(lim)} como máximo`, [], 1);
  }
  if (reglas.min_paginas !== undefined) {
    const lim = Math.round(reglas.min_paginas * 8);
    minimo('min_paginas', 'Páginas (mínimo)', total, lim, `${formatearOctavos(total)}; el mínimo es ${formatearOctavos(lim)}`);
  }
  const minutos = duracionTotal(g) / 60;
  if (reglas.max_duracion !== undefined) maximo('max_duracion', 'Duración', minutos, reglas.max_duracion, `${formatearDuracion(minutos * 60)} de ${reglas.max_duracion} min como máximo`);
  if (reglas.min_duracion !== undefined) minimo('min_duracion', 'Duración (mínimo)', minutos, reglas.min_duracion, `${formatearDuracion(minutos * 60)}; el mínimo es ${reglas.min_duracion} min`);
  if (reglas.max_escenas !== undefined) maximo('max_escenas', 'Escenas', n, reglas.max_escenas, `${n} de ${reglas.max_escenas} como máximo`);
  const locs = listaLocaciones(g);
  if (reglas.max_locaciones !== undefined)
    maximo('max_locaciones', 'Locaciones', locs.length, reglas.max_locaciones, `${locs.length} de ${reglas.max_locaciones} como máximo`, locs.length > reglas.max_locaciones ? locs.map((l) => l.set) : []);
  const reparto = listaReparto(g);
  if (reglas.max_personajes !== undefined)
    maximo('max_personajes', 'Personajes', reparto.length, reglas.max_personajes, `${reparto.length} de ${reglas.max_personajes} como máximo`, reparto.length > reglas.max_personajes ? reparto.map((r) => r.nombre) : []);
  if (reglas.max_personajes_escena !== undefined) {
    const max = reglas.max_personajes_escena;
    const llenas = escenas.filter((_, k) => g.breakdown[k].reparto.length > max).map((e) => `Esc. ${e.numero} (${g.breakdown[e.indice].reparto.length})`);
    const mayor = Math.max(0, ...g.breakdown.map((b) => b.reparto.length));
    maximo('max_personajes_escena', 'Personajes por escena', mayor, max, `hasta ${mayor} en una escena; el máximo es ${max}`, llenas);
  }
  if (reglas.max_noches_pct !== undefined) {
    const noches = escenas.filter((e) => /NOCHE/.test(e.momento));
    const p = n ? (noches.length * 100) / n : 0;
    maximo('max_noches_pct', 'Escenas de noche', p, reglas.max_noches_pct, `${pct(p)} de ${pct(reglas.max_noches_pct)} como máximo`, p > reglas.max_noches_pct ? noches.map((e) => `Esc. ${e.numero}`) : []);
  }
  if (reglas.min_escenas_por_locacion !== undefined) {
    const min = reglas.min_escenas_por_locacion;
    const pocas = locs.filter((l) => l.escenas.length < min);
    out.push({ regla: 'min_escenas_por_locacion', nombre: 'Escenas por locación', estado: pocas.length ? 'falla' : 'ok', detalle: pocas.length ? `${pocas.length} locaciones con menos de ${min} escenas` : `todas con ${min} o más`, culpables: pocas.map((l) => `${l.set} (${l.escenas.length})`) });
  }
  if (reglas.min_principales_pct !== undefined && reglas.locaciones_principales?.length) {
    const principales = reglas.locaciones_principales;
    const dentro = escenas.filter((e) => esPrincipal(e.locacion || e.encabezado, principales)).length;
    const p = n ? (dentro * 100) / n : 0;
    minimo('min_principales_pct', 'Escenas en locaciones principales', p, reglas.min_principales_pct, `${pct(p)}; el mínimo es ${pct(reglas.min_principales_pct)}`, locs.filter((l) => !esPrincipal(l.set, principales)).map((l) => l.set));
  }
  return out;
}
