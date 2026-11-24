import type { Cambio } from './escenas';
import { analizar } from './fountain';

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 1 → A … 26 → Z, 27 → A1, 28 → B1 … */
function sufijo(i: number): string {
  const vuelta = Math.floor((i - 1) / 26);
  return LETRAS[(i - 1) % 26] + (vuelta ? String(vuelta) : '');
}

/** «5» → { base: '5', indice: 0 }; «5A» → { base: '5', indice: 1 }; «5B1» → { base: '5', indice: 28 }. */
function partir(n: string): { base: string; indice: number } | null {
  const m = n.match(/^(.*\d)([A-Z])(\d*)$/);
  if (m) return { base: m[1], indice: LETRAS.indexOf(m[2]) + 1 + 26 * (m[3] ? Number(m[3]) : 0) };
  return /\d$/.test(n) ? { base: n, indice: 0 } : null;
}

/**
 * Números de escena. Sin fijos, 1…n. Con fijos (numeración bloqueada), cada escena sin número toma
 * el fijo anterior más una letra (5A, 5B… 5Z, 5A1); antes del primer fijo, A1, B1… Nunca repite un número.
 */
export function numerarEscenas(fijos: (string | undefined)[]): string[] {
  const n = fijos.length;
  if (!fijos.some(Boolean)) return fijos.map((_, k) => String(k + 1));
  const usados = new Set(fijos.filter((f): f is string => !!f));
  const out = fijos.map((f) => f ?? '');
  const unico = (candidato: (j: number) => string, j0: number) => {
    let j = j0;
    while (usados.has(candidato(j))) j++;
    const x = candidato(j);
    usados.add(x);
    return { x, j };
  };
  let k = 0;
  while (k < n) {
    if (fijos[k]) {
      k++;
      continue;
    }
    // Un tramo de escenas sin número entre el fijo anterior (pa) y el siguiente (pb).
    const pa = k - 1;
    let pb = k;
    while (pb < n && !fijos[pb]) pb++;
    const cuantas = pb - k;
    const antes = pa >= 0 ? (fijos[pa] as string) : null;
    const despues = pb < n ? (fijos[pb] as string) : null;
    const P = antes ? partir(antes) : null;
    const N = despues ? partir(despues) : null;
    // Antes del siguiente (A5, B5…) cuando no hay anterior, o cuando entre los dos no caben las letras (5 … 5A).
    const caben = !P || !N || N.base !== P.base || N.indice - P.indice - 1 >= cuantas;
    const porDelante = !antes || !caben;
    let j = 1;
    for (let i = 0; i < cuantas; i++) {
      const candidato = porDelante ? (m: number) => sufijo(m) + despues : P ? (m: number) => P.base + sufijo(P.indice + m) : (m: number) => antes + sufijo(m);
      const r = unico(candidato, j);
      out[k + i] = r.x;
      j = r.j + 1;
    }
    k = pb;
  }
  return out;
}

function inicios(fuente: string): number[] {
  const out: number[] = [];
  let p = 0;
  for (const l of fuente.split('\n')) {
    out.push(p);
    p += l.length + 1;
  }
  return out;
}

/** Bloquear: escribe `#n#` al final de cada encabezado que no lo tenga, con su número actual. */
export function bloquearNumeracion(fuente: string): Cambio[] {
  const lineas = fuente.split('\n');
  const ini = inicios(fuente);
  return analizar(fuente)
    .escenas.filter((e) => !e.numeroFijo)
    .map((e) => {
      const pos = ini[e.linea] + lineas[e.linea].trimEnd().length;
      // Pegado al encabezado: con un espacio antes, Obsidian tomaría «#5A» como etiqueta de la vault.
      return { desde: pos, hasta: pos, texto: `#${e.numero}#` };
    });
}

/** Desbloquear: quita los `#n#` de los encabezados. */
export function desbloquearNumeracion(fuente: string): Cambio[] {
  const lineas = fuente.split('\n');
  const ini = inicios(fuente);
  const out: Cambio[] = [];
  for (const e of analizar(fuente).escenas) {
    if (!e.numeroFijo) continue;
    const l = lineas[e.linea];
    let ultimo: RegExpMatchArray | null = null;
    for (const m of l.matchAll(/\s*#([^#\s][^#]*)#/g)) if (m[1].trim() === e.numeroFijo) ultimo = m;
    if (!ultimo) continue;
    const a = ini[e.linea] + (ultimo.index ?? 0);
    out.push({ desde: a, hasta: a + ultimo[0].length, texto: '' });
  }
  return out;
}
