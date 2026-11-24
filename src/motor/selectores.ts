import type { Guion } from './index';
import type { Cambio } from './escenas';
import { formatearOctavos } from './octavos';
import { celdaDeTabla, escribirCelda, esCeldaDeFecha, iniciosDeTabla, type Celda } from './tablas';

/** Qué panel abre una celda, según su columna. */
export type TipoCelda = 'fecha' | 'escena' | 'plano' | 'movimiento' | 'angulo' | 'lente' | 'tecnica';

/** Sin negritas, acentos, puntos ni mayúsculas, con los espacios juntos. */
const normal = (s: string) =>
  s
    .replace(/[*_`~.]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const COLUMNAS: [TipoCelda, RegExp][] = [
  ['escena', /^(esc|escena|sc|(n|no|num|numero) ?(de )?escena)$/],
  ['plano', /^(tipo de )?plano$/],
  ['movimiento', /^(mov|movimiento)( de camara)?$/],
  ['angulo', /^angulo( de camara)?$/],
  ['lente', /^(lente|lentes|optica)$/],
  ['tecnica', /^descripcion tecnica$/],
];

/**
 * El panel de la celda según su columna. Con `fuente` y `linea` se mira la tabla entera: la columna «Plano» de la
 * tabla de abreviaturas es una referencia, no un plano que elegir.
 */
export function tipoDeCelda(c: Celda, fuente?: string, linea?: number): TipoCelda | null {
  if (esCeldaDeFecha(c)) return 'fecha';
  const h = normal(c.encabezado);
  const tipo = COLUMNAS.find(([, re]) => re.test(h))?.[0] ?? null;
  if (tipo === 'plano' && fuente !== undefined && linea !== undefined) {
    for (let k = 0; k < c.columnas; k++) if (normal(celdaDeTabla(fuente, linea, 0, k)?.encabezado ?? '') === 'abreviatura') return null;
  }
  return tipo;
}

/** El guion de una nota: el de su carpeta o el de la carpeta de arriba más cercana. Nunca uno de una carpeta vecina. */
export function guionMasCercano(rutaNota: string, rutasGuion: string[]): string | null {
  const carpeta = (r: string) => (r.includes('/') ? r.slice(0, r.lastIndexOf('/')) : '');
  let dir = carpeta(rutaNota);
  for (;;) {
    const aqui = rutasGuion.filter((r) => carpeta(r) === dir).sort();
    if (aqui.length) return aqui[0];
    if (!dir) return null;
    dir = carpeta(dir);
  }
}

/** Filtra opciones por lo que se ve (no por el detalle). El valor exacto va primero, luego los que empiezan igual. */
export function filtrarOpciones<T extends { valor: string; etiqueta?: string }>(opciones: T[], filtro: string): T[] {
  const n = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const f = n(filtro.trim());
  if (!f) return opciones;
  const pasan = opciones.filter((o) => n(o.etiqueta ?? o.valor).includes(f) || n(o.valor).includes(f));
  const rango = (o: T) => (n(o.valor) === f ? 0 : n(o.valor).startsWith(f) ? 1 : 2);
  return pasan.map((o, i) => ({ o, i })).sort((a, b) => rango(a.o) - rango(b.o) || a.i - b.i).map((x) => x.o);
}

/**
 * Pone `valor` en una celda de una sola lista (movimiento, ángulo, lente): cambia el valor conocido que ya tenga
 * y conserva lo demás; si no tiene ninguno, lo pone al principio. `patron` reconoce además valores libres (40 mm).
 */
export function ponerValor(texto: string, valor: string, conocidos: string[], patron?: RegExp): string {
  if (vacia(texto)) return valor;
  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const opciones = [...conocidos].sort((a, b) => b.length - a.length).map(escapar);
  const fuentes = [...opciones, ...(patron ? [patron.source] : [])];
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${fuentes.join('|')})(?=$|[^\\p{L}\\p{N}])`, 'iu');
  const m = re.exec(texto);
  if (!m) return `${valor} · ${texto.trim()}`;
  const ini = m.index + m[1].length;
  return (texto.slice(0, ini) + valor + texto.slice(ini + m[2].length)).trim();
}

const vacia = (t: string) => !t.trim() || t.trim() === '—' || t.trim() === '-';

// ---------- Planos ----------

export interface Abreviatura {
  abreviatura: string;
  nombre: string;
}

/** Las de la plantilla del guion técnico. */
export const ABREVIATURAS_POR_DEFECTO: Abreviatura[] = [
  ['G.P.G.', 'Gran plano general'],
  ['P.G.', 'Plano general'],
  ['P.E.', 'Plano entero'],
  ['P.A.', 'Plano americano'],
  ['P.M.', 'Plano medio'],
  ['P.M.C.', 'Plano medio corto'],
  ['P.P.', 'Primer plano'],
  ['P.P.P.', 'Primerísimo primer plano'],
  ['P.D.', 'Plano detalle'],
].map(([abreviatura, nombre]) => ({ abreviatura, nombre }));

/** La tabla «Abreviatura | Plano» de la nota, si la hay: así cada clase usa las suyas. */
export function abreviaturasDeNota(fuente: string): Abreviatura[] | null {
  for (const L of iniciosDeTabla(fuente)) {
    const a = celdaDeTabla(fuente, L, 0, 0);
    const b = celdaDeTabla(fuente, L, 0, 1);
    if (!a || !b || normal(a.encabezado) !== 'abreviatura' || !/^(plano|nombre|significado)$/.test(normal(b.encabezado))) continue;
    const out: Abreviatura[] = [];
    for (let f = 0; ; f++) {
      const x = celdaDeTabla(fuente, L, f, 0);
      const y = celdaDeTabla(fuente, L, f, 1);
      if (!x) break;
      if (!vacia(x.texto)) out.push({ abreviatura: x.texto, nombre: y && !vacia(y.texto) ? y.texto : '' });
    }
    return out.length ? out : null;
  }
  return null;
}

/** Pone la abreviatura al principio de la celda: reemplaza la que haya y conserva la descripción. */
export function ponerAbreviatura(texto: string, abreviatura: string, conocidas: string[]): string {
  const t = texto.trim();
  if (vacia(t)) return abreviatura;
  const previa = [...conocidas].sort((x, y) => y.length - x.length).find((k) => t === k || t.startsWith(k + ' '));
  const resto = previa ? t.slice(previa.length).trim() : t;
  return resto ? `${abreviatura} ${resto}` : abreviatura;
}

// ---------- Descripción técnica ----------

export interface ListasTecnicas {
  lentes: string[];
  movimientos: string[];
  angulos: string[];
}

export const LISTAS_TECNICAS: ListasTecnicas = {
  lentes: ['16 mm', '24 mm', '35 mm', '50 mm', '85 mm', '135 mm'],
  movimientos: ['fija', 'paneo', 'tilt', 'travelling', 'dolly in', 'dolly out', 'zoom in', 'zoom out', 'en mano', 'gimbal', 'steadicam', 'grúa', 'dron'],
  angulos: ['normal', 'picada', 'contrapicada', 'cenital', 'nadir', 'lateral', 'holandés'],
};

const lista = (v: unknown): string[] => {
  const crudo = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,\n]/) : [];
  const out: string[] = [];
  for (const x of crudo) {
    const t = String(x ?? '').trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
};

/** `lentes`, `movimientos` y `angulos` en las propiedades del proyecto; vacías o ausentes, las de fábrica. */
export function listasDePropiedades(props: Record<string, unknown>): ListasTecnicas {
  const de = (clave: string, fabrica: string[]) => {
    const l = lista(props[clave]);
    return l.length ? l : fabrica;
  };
  return { lentes: de('lentes', LISTAS_TECNICAS.lentes), movimientos: de('movimientos', LISTAS_TECNICAS.movimientos), angulos: de('angulos', LISTAS_TECNICAS.angulos) };
}

export interface Tecnica {
  lente?: string;
  movimiento?: string;
  angulo?: string;
  /** Lo que no es lente, movimiento ni ángulo: se conserva al final. */
  resto: string[];
}

const mm = (s: string) => /^(\d+(?:[.,]\d+)?)\s*mm$/i.exec(s.trim());

/** Parte el texto en «·», «;» o «, » (no en la coma de un decimal), sin cortar dentro de [[enlaces]], (paréntesis) ni «comillas». */
function trozosTecnica(texto: string): { t: string; sep: string }[] {
  const out: { t: string; sep: string }[] = [];
  let hondo = 0;
  let actual = '';
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '[' || c === '(' || c === '«') hondo++;
    else if ((c === ']' || c === ')' || c === '»') && hondo > 0) hondo--;
    const sep = hondo === 0 ? /^(\s*[·;]\s*|,\s+)/.exec(texto.slice(i)) : null;
    if (sep) {
      out.push({ t: actual, sep: sep[0] });
      actual = '';
      i += sep[0].length - 1;
    } else actual += c;
  }
  out.push({ t: actual, sep: '' });
  return out.filter((x) => x.t.trim());
}

export function leerTecnica(texto: string, listas: ListasTecnicas): Tecnica {
  const t: Tecnica = { resto: [] };
  if (vacia(texto)) return t;
  const sobran: { t: string; sep: string }[] = [];
  for (const trozo of trozosTecnica(texto)) {
    const p = trozo.t.trim();
    const m = mm(p);
    const n = normal(p);
    const mov = listas.movimientos.find((x) => normal(x) === n);
    const ang = listas.angulos.find((x) => normal(x) === n);
    const len = listas.lentes.find((x) => normal(x) === n);
    if (!t.lente && (m || len)) t.lente = m ? `${m[1]} mm` : len;
    else if (!t.movimiento && mov) t.movimiento = mov;
    else if (!t.angulo && ang) t.angulo = ang;
    else sobran.push({ t: p, sep: trozo.sep });
  }
  // Lo que no se reconoce se conserva tal cual, con sus propios separadores.
  const resto = sobran.map((x, i) => x.t + (i < sobran.length - 1 ? x.sep : '')).join('').trim();
  if (resto) t.resto.push(resto);
  return t;
}

export function escribirTecnica(t: Tecnica): string {
  const partes = [t.lente, t.movimiento, t.angulo, ...t.resto].filter((x): x is string => !!x && !!x.trim());
  return partes.length ? partes.join(' · ') : '—';
}

// ---------- Escenas ----------

export interface OpcionEscena {
  numero: string;
  encabezado: string;
  intExt: string;
  locacion: string;
  momento: string;
  /** Quienes están en la escena, como los cuenta el breakdown. */
  reparto: string[];
  octavos: string;
}

export function opcionesDeEscena(g: Guion): OpcionEscena[] {
  return g.doc.escenas.map((e, k) => ({
    numero: e.numero,
    encabezado: e.encabezado,
    intExt: e.introduccion,
    locacion: e.locacion,
    momento: e.momento,
    reparto: g.breakdown[k]?.reparto ?? [],
    octavos: formatearOctavos(g.octavos.porEscena[k] ?? 0),
  }));
}

/** Columnas que se llenan solas al elegir la escena, y con qué. */
const DERIVADAS: [RegExp, (o: OpcionEscena) => string][] = [
  [/^(set|sets|locacion|locaciones|escenario)$/, (o) => o.locacion],
  [/^(int ?\/ ?ext|int ext|i ?\/ ?e)$/, (o) => o.intExt],
  [/^(dia ?\/ ?noche|d ?\/ ?n|momento|dia noche)$/, (o) => o.momento],
  [/^(talentos?|actores|personajes|reparto|cast)$/, (o) => o.reparto.join(', ')],
];

/**
 * Los cambios al elegir la escena `o` en la celda (`linea`, `fila`, `columna`): el número en esa celda y,
 * en la misma fila, las celdas vacías cuyas columnas salen del guion. Ordenados de principio a fin.
 */
export function rellenoDeFila(fuente: string, linea: number, fila: number, columna: number, o: OpcionEscena): Cambio[] {
  const propia = celdaDeTabla(fuente, linea, fila, columna);
  if (!propia) return [];
  const cambios: Cambio[] = [escribirCelda(propia, o.numero)];
  for (let k = 0; k < propia.columnas; k++) {
    if (k === columna) continue;
    const c = celdaDeTabla(fuente, linea, fila, k);
    if (!c || !vacia(c.texto)) continue;
    const valor = DERIVADAS.find(([re]) => re.test(normal(c.encabezado)))?.[1](o);
    if (valor) cambios.push(escribirCelda(c, valor));
  }
  return cambios.sort((a, b) => a.desde - b.desde);
}
