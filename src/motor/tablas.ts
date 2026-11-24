import type { Cambio } from './escenas';
import { leerFecha, type Fecha } from './fechas';

/** Una celda de una tabla Markdown: su texto, dónde está en la fuente y su contexto. */
export interface Celda {
  /** Contenido sin los espacios de los bordes. */
  texto: string;
  /** Posiciones del contenido en la fuente; si la celda está vacía, las dos caen dentro de la celda. */
  desde: number;
  hasta: number;
  /** El texto del encabezado de su columna. */
  encabezado: string;
  /** El texto de la primera celda de su fila. */
  etiqueta: string;
  /** Cuántas columnas tiene el encabezado. */
  columnas: number;
  fila: number;
  columna: number;
}

interface Trozo {
  texto: string;
  /** Desde la barra que abre hasta la que cierra, sin incluirlas. */
  desde: number;
  hasta: number;
}

const esSeparador = (s: string) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(s);

/** Parte un renglón por las barras que no van escapadas. */
function trozos(linea: string): Trozo[] | null {
  if (!linea.includes('|')) return null;
  const barras: number[] = [];
  for (let i = 0; i < linea.length; i++) {
    if (linea[i] === '\\') i++;
    else if (linea[i] === '|') barras.push(i);
  }
  if (!barras.length) return null;
  const inicio = linea.trimStart().startsWith('|') ? barras.shift()! : -1;
  const cierra = linea.trimEnd().endsWith('|') && barras.length ? barras.pop()! : linea.length;
  const bordes = [inicio, ...barras, cierra];
  const out: Trozo[] = [];
  for (let k = 0; k + 1 < bordes.length; k++) {
    const desde = bordes[k] + 1;
    const hasta = bordes[k + 1];
    out.push({ texto: linea.slice(desde, hasta), desde, hasta });
  }
  return out;
}

const limpio = (s: string) => s.trim();

/**
 * La celda de la fila `fila` (0 = la primera debajo del encabezado) y la columna `columna` de la tabla
 * cuyo encabezado está en el renglón `lineaTabla` (desde 0). `null` si ahí no hay tabla o celda.
 */
export function celdaDeTabla(fuente: string, lineaTabla: number, fila: number, columna: number): Celda | null {
  const lineas = fuente.split('\n');
  const enc = lineas[lineaTabla];
  const sep = lineas[lineaTabla + 1];
  if (enc === undefined || sep === undefined || !esSeparador(sep) || fila < 0 || columna < 0) return null;
  const cab = trozos(enc);
  if (!cab || columna >= cab.length) return null;
  const L = lineaTabla + 2 + fila;
  for (let k = lineaTabla + 2; k <= L; k++) if (lineas[k] === undefined || !lineas[k].trim() || !lineas[k].includes('|')) return null;
  const celdas = trozos(lineas[L]);
  if (!celdas || columna >= celdas.length) return null;
  let inicioLinea = 0;
  for (let k = 0; k < L; k++) inicioLinea += lineas[k].length + 1;
  const t = celdas[columna];
  const izq = t.texto.length - t.texto.trimStart().length;
  const texto = limpio(t.texto);
  const desde = texto ? inicioLinea + t.desde + izq : inicioLinea + t.desde;
  return {
    texto,
    desde,
    hasta: texto ? desde + texto.length : inicioLinea + t.hasta,
    encabezado: limpio(cab[columna].texto),
    etiqueta: limpio(celdas[0].texto),
    columnas: cab.length,
    fila,
    columna,
  };
}

/** Sin negritas, acentos ni mayúsculas. */
const normal = (s: string) =>
  s
    .replace(/[*_`~]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const nombreDeFecha = (s: string) => {
  const n = normal(s);
  return n === 'inicio' || n === 'fin' || /^fecha\b/.test(n);
};

/** Columnas Inicio, Fin o Fecha…; o el valor del renglón «Fecha» en una tabla de dato y valor. */
export const esCeldaDeFecha = (c: Celda) => (c.columna === 1 && c.columnas === 2 && nombreDeFecha(c.etiqueta)) || nombreDeFecha(c.encabezado);

/** Reemplaza el contenido de la celda. Una celda vacía queda con un espacio a cada lado. */
export function escribirCelda(c: Celda, valor: string): Cambio {
  if (c.texto) return { desde: c.desde, hasta: c.hasta, texto: valor };
  return { desde: c.desde, hasta: c.hasta, texto: ` ${valor} ` };
}

/** La otra punta del periodo en la misma fila: el Inicio para una celda Fin, y al revés. `null` si no hay o no es fecha. */
export function fechaDePareja(fuente: string, lineaTabla: number, fila: number, columna: number): { encabezado: string; fecha: Fecha } | null {
  const c = celdaDeTabla(fuente, lineaTabla, fila, columna);
  if (!c) return null;
  const propia = normal(c.encabezado);
  const busca = propia === 'fin' ? 'inicio' : propia === 'inicio' ? 'fin' : null;
  if (!busca) return null;
  for (let k = 0; k < c.columnas; k++) {
    const otra = celdaDeTabla(fuente, lineaTabla, fila, k);
    if (!otra || normal(otra.encabezado) !== busca) continue;
    const fecha = leerFecha(otra.texto);
    return fecha ? { encabezado: otra.encabezado.replace(/[*_`~]/g, '').trim(), fecha } : null;
  }
  return null;
}

/** El renglón del encabezado de cada tabla (desde 0), fuera de los bloques de código. */
export function iniciosDeTabla(fuente: string): number[] {
  const lineas = fuente.split('\n');
  const out: number[] = [];
  let cerco: string | null = null;
  for (let k = 0; k < lineas.length; k++) {
    const s = lineas[k];
    const valla = /^\s*(`{3,}|~{3,})/.exec(s);
    if (valla) {
      if (cerco === null) cerco = valla[1][0];
      else if (valla[1][0] === cerco) cerco = null;
      continue;
    }
    if (cerco !== null) continue;
    if (s.includes('|') && lineas[k + 1] !== undefined && esSeparador(lineas[k + 1]) && (k === 0 || !lineas[k - 1].includes('|') || !lineas[k - 1].trim())) {
      out.push(k);
      k++;
    }
  }
  return out;
}

/** Solo letras y números, sin acentos ni mayúsculas: lo que queda igual entre el texto y la tabla dibujada. */
const visible = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

/**
 * ¿La fila dibujada (`visibles`, el texto de cada celda) es la fila `fila` del texto? `fila = -1` es el encabezado.
 * Cada celda dibujada tiene que estar contenida en la del texto (la del texto puede traer enlaces o formato).
 */
export function filaCoincide(fuente: string, lineaTabla: number, fila: number, visibles: string[]): boolean {
  const lineas = fuente.split('\n');
  if (lineas[lineaTabla + 1] === undefined || !esSeparador(lineas[lineaTabla + 1])) return false;
  const L = fila < 0 ? lineaTabla : lineaTabla + 2 + fila;
  if (fila >= 0) for (let k = lineaTabla + 2; k <= L; k++) if (lineas[k] === undefined || !lineas[k].trim() || !lineas[k].includes('|')) return false;
  const celdas = trozos(lineas[L] ?? '');
  if (!celdas) return false;
  return visibles.every((v, k) => visible(celdas[k]?.texto ?? '').includes(visible(v)));
}

/** Un renglón sin espacios, y el separador sin el largo de sus guiones: lo que Obsidian cambia al alinear una tabla. */
const forma = (l: string) => (esSeparador(l) ? l.replace(/[ \t]/g, '').replace(/-+/g, '-') : l.replace(/[ \t]/g, ''));

/** La misma nota salvo espacios y largo de los separadores. */
export const mismaNota = (a: string, b: string) => a.split('\n').map(forma).join('\n') === b.split('\n').map(forma).join('\n');

/** Encabezado, separador y filas de la tabla que empieza en `L`. */
function renglonesDeTabla(lineas: string[], L: number): string[] | null {
  if (!(lineas[L] ?? '').includes('|') || lineas[L + 1] === undefined || !esSeparador(lineas[L + 1])) return null;
  const out = [lineas[L], lineas[L + 1]];
  for (let k = L + 2; k < lineas.length && lineas[k].trim() && lineas[k].includes('|'); k++) out.push(lineas[k]);
  return out;
}

/** ¿La tabla dibujada (encabezado y cada fila, como texto de sus celdas) es entera la tabla del texto en `L`? */
export function tablaCoincide(fuente: string, L: number, visibles: string[][]): boolean {
  const r = renglonesDeTabla(fuente.split('\n'), L);
  if (!r || visibles.length !== r.length - 1) return false;
  return filaCoincide(fuente, L, -1, visibles[0]) && visibles.slice(1).every((v, k) => filaCoincide(fuente, L, k, v));
}

/** ¿Hay otra tabla igual en la nota? Entonces el dibujo no basta para saber cuál se pulsó. */
export function tablaRepetida(fuente: string, L: number): boolean {
  const lineas = fuente.split('\n');
  const firma = renglonesDeTabla(lineas, L)?.map(forma).join('\n');
  if (firma === undefined) return false;
  return iniciosDeTabla(fuente).some((k) => k !== L && renglonesDeTabla(lineas, k)?.map(forma).join('\n') === firma);
}

/** Una tabla Markdown lista para pegar; las barras dentro de una celda se escapan. */
export function tablaMarkdown(cabeza: string[], filas: string[][]): string {
  const celda = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
  const renglon = (celdas: string[]) => '|' + celdas.map((c) => (celda(c) ? ` ${celda(c)} ` : ' ')).join('|') + '|';
  return [renglon(cabeza), '|' + cabeza.map(() => '---').join('|') + '|', ...filas.map(renglon)].join('\n') + '\n';
}
