import { DICCIONARIOS_MX, type Diccionarios } from './diccionarios';
import { analizarEnLinea, textoPlano } from './enlinea';
import { analizar, clasificarLineas, PREFIJO_ESCENA, type OpcionesAnalisis } from './fountain';
import type { TipoElemento } from './tipos';

/** Los tipos de párrafo que maneja el teclado del editor. */
export type TipoParrafo = 'encabezado' | 'accion' | 'personaje' | 'acotacion' | 'dialogo' | 'letra' | 'transicion' | 'plano';
export type TeclaGuion = 'Enter' | 'Tab' | 'Shift-Tab' | 'Shift-Enter';

/** El tipo que el autor eligió para la línea en curso (línea desde 0). Lo guarda el editor. */
export interface Deseado {
  linea: number;
  tipo: TipoParrafo;
}

/**
 * Lo que hay que hacer en el editor: reemplazar [desde, hasta) por `insertar` y poner el cursor en `cursor`
 * (posición en el texto ya cambiado). `deseado` es el tipo de la línea del cursor; `sugerir`, abrir el autocompletado.
 * `nada`: consumir la tecla sin tocar el texto ni la selección.
 */
export interface Edicion {
  desde: number;
  hasta: number;
  insertar: string;
  cursor: number;
  deseado?: TipoParrafo;
  sugerir?: true;
  nada?: true;
}

const PARRAFOS = new Set<string>(['encabezado', 'accion', 'personaje', 'acotacion', 'dialogo', 'letra', 'transicion', 'plano']);
const GRUPO = new Set<string>(['personaje', 'acotacion', 'dialogo', 'letra']);
const DENTRO = new Set<string>(['acotacion', 'dialogo', 'letra']);

const op = (dic: Diccionarios): OpcionesAnalisis => ({ transiciones: dic.transiciones, momentos: dic.momentos });

/** El parser cede al tipo deseado solo cuando lee acción (el tipo por omisión de Fountain). */
const cedeAlDeseado = (base: TipoElemento | null | undefined) => base === 'accion';

const aParrafo = (t: TipoElemento | null | undefined): TipoParrafo | null => (t && PARRAFOS.has(t) ? (t as TipoParrafo) : null);

/** Líneas en blanco de Fountain antes de un párrafo: ninguna dentro de un bloque de diálogo, una en lo demás. */
export function blancosAntes(anterior: TipoParrafo | null, siguiente: TipoParrafo): 0 | 1 {
  return anterior && GRUPO.has(anterior) && DENTRO.has(siguiente) ? 0 : 1;
}

type Tabla = Record<TipoParrafo, TipoParrafo>;
type TablaCambio = Record<TipoParrafo, TipoParrafo | null>;
const ENTER_FINAL: Tabla = { encabezado: 'accion', accion: 'accion', personaje: 'dialogo', acotacion: 'dialogo', dialogo: 'accion', letra: 'accion', transicion: 'encabezado', plano: 'accion' };
const TAB_FINAL: Tabla = { encabezado: 'accion', accion: 'personaje', personaje: 'acotacion', acotacion: 'dialogo', dialogo: 'acotacion', letra: 'acotacion', transicion: 'encabezado', plano: 'accion' };
const ENTER_VACIO: TablaCambio = { encabezado: null, accion: 'encabezado', personaje: 'accion', acotacion: null, dialogo: 'accion', letra: 'accion', transicion: null, plano: null };
const TAB_VACIO: TablaCambio = { encabezado: 'accion', accion: 'personaje', personaje: 'accion', acotacion: 'dialogo', dialogo: 'acotacion', letra: 'acotacion', transicion: 'accion', plano: 'accion' };
/** Shift+Tab en vacío: el ciclo al revés (diálogo → acotación → personaje → acción → encabezado → transición → plano → acción). */
const ATRAS_VACIO: Tabla = { dialogo: 'acotacion', letra: 'acotacion', acotacion: 'personaje', personaje: 'accion', accion: 'encabezado', encabezado: 'transicion', transicion: 'plano', plano: 'accion' };
/** Shift+Tab con texto: baja un nivel. */
const ATRAS_TEXTO: Partial<Tabla> = { dialogo: 'acotacion', letra: 'acotacion', acotacion: 'personaje', personaje: 'accion' };
const PARTIR: Tabla = { encabezado: 'accion', accion: 'accion', personaje: 'dialogo', acotacion: 'dialogo', dialogo: 'dialogo', letra: 'letra', transicion: 'encabezado', plano: 'accion' };
const EMPUJA = new Set<TipoParrafo>(['encabezado', 'personaje', 'transicion', 'accion']);

// ---------- Mayúsculas y normalización ----------

const PROTEGIDO = /\{([a-z]+):([^{}|]*)((?:\|[^{}]*)?)\}|\[\[[^\]]*(?:\]\]|$)|%%[\s\S]*?(?:%%|$)|\/\*[\s\S]*?(?:\*\/|$)|\{[a-z]*:?$|\{[a-z]+:/g;

/** Mayúsculas salvo el código de las marcas, su nombre y cantidad, los enlaces y los comentarios. */
export function mayusculasSeguras(s: string): string {
  let out = '';
  let k = 0;
  for (const m of s.matchAll(PROTEGIDO)) {
    const i = m.index ?? 0;
    out += s.slice(k, i).toUpperCase();
    // Dentro de una marca, el texto también protege sus enlaces.
    out += m[1] !== undefined ? `{${m[1]}:${mayusculasSeguras(m[2])}${m[3]}}` : m[0];
    k = i + m[0].length;
  }
  return out + s.slice(k).toUpperCase();
}

const esMayusculas = (s: string) => s === s.toUpperCase() && /[A-ZÁÉÍÓÚÑÜ]/.test(s);

/** El texto del párrafo sin sus marcas de tipo de Fountain. */
function contenido(s: string, tipo: TipoParrafo): string {
  const t = s.trim();
  switch (tipo) {
    case 'acotacion':
      return t.replace(/^\(/, '').replace(/\)$/, '');
    case 'letra':
      return t.replace(/^~\s*/, '');
    case 'plano':
      return t.replace(/^!!\s*/, '');
    case 'transicion':
      return t.replace(/^>\s*/, '');
    case 'encabezado':
      return t.replace(/^\.(?!\.)/, '');
    case 'personaje':
      return t.replace(/^@/, '');
    case 'accion':
      return t.replace(/^!(?!!)/, '');
    default:
      return t;
  }
}

const terminaEnTransicion = (u: string, dic: Diccionarios) => /TO:$/.test(u) || dic.transiciones.some((t) => u.endsWith(t.toUpperCase()));

/** Escribe el párrafo como Fountain válido para su tipo (mayúsculas y prefijos forzados). */
export function normalizarParrafo(linea: string, tipo: TipoParrafo, dic: Diccionarios = DICCIONARIOS_MX): string {
  const t = linea.trim();
  if (!t) return linea;
  switch (tipo) {
    case 'encabezado': {
      const u = mayusculasSeguras(t);
      return u.startsWith('.') || PREFIJO_ESCENA.test(u) ? u : '.' + u;
    }
    case 'personaje': {
      if (t.startsWith('@')) return t;
      const u = mayusculasSeguras(t);
      return /[.!?:]$/.test(textoPlano(analizarEnLinea(u)).replace(/\s*\^$/, '')) ? '@' + u : u;
    }
    case 'transicion': {
      if (t.startsWith('>')) return t;
      const u = mayusculasSeguras(t);
      return terminaEnTransicion(textoPlano(analizarEnLinea(u)), dic) ? u : '> ' + u;
    }
    case 'plano':
      return '!!' + mayusculasSeguras(contenido(t, 'plano'));
    case 'acotacion':
      return `(${contenido(t, 'acotacion')})`;
    case 'letra':
      return t.startsWith('~') ? t : '~' + t;
    case 'accion': {
      if (/^!(?!!)/.test(t)) return t;
      const plano = textoPlano(analizarEnLinea(t));
      const otroTipo =
        PREFIJO_ESCENA.test(t) ||
        /^[.>~=#@]|^!!/.test(t) ||
        (esMayusculas(plano) && (!/[.!?…]$/.test(plano) || terminaEnTransicion(plano, dic)));
      return otroTipo ? '!' + t : t;
    }
    default:
      return t;
  }
}

// ---------- Dónde está el cursor ----------

function finFrontmatter(lineas: string[]): number {
  if (lineas[0]?.trim() !== '---') return -1;
  for (let k = 1; k < lineas.length; k++) if (lineas[k].trim() === '---') return k;
  return lineas.length - 1;
}

function enComentario(texto: string, pos: number): boolean {
  for (const re of [/%%[\s\S]*?(?:%%|$)/g, /\/\*[\s\S]*?(?:\*\/|$)/g]) {
    for (const m of texto.matchAll(re)) {
      const a = m.index ?? 0;
      const b = a + m[0].length;
      const cerrado = m[0].length >= 4 && /(%%|\*\/)$/.test(m[0]);
      if (pos > a && (pos < b || (!cerrado && pos <= b))) return true;
    }
  }
  return false;
}

function posicion(lineas: string[], pos: number): { linea: number; ch: number } {
  let p = 0;
  for (let k = 0; k < lineas.length; k++) {
    if (pos <= p + lineas[k].length) return { linea: k, ch: pos - p };
    p += lineas[k].length + 1;
  }
  return { linea: lineas.length - 1, ch: lineas[lineas.length - 1].length };
}

/** Línea (desde 0) y columna de una posición del texto. */
export function lineaYColumna(texto: string, pos: number): { linea: number; ch: number } {
  return posicion(texto.split('\n'), pos);
}

/** `clasificarLineas` más el tipo deseado de la línea en curso. */
export function clasificarEditor(texto: string, deseado?: Deseado | null, dic: Diccionarios = DICCIONARIOS_MX): (TipoElemento | null)[] {
  const lineas = texto.split('\n');
  if (!deseado || deseado.linea < 0 || deseado.linea >= lineas.length) return clasificarLineas(texto, op(dic));
  let fuente = texto;
  if (lineas[deseado.linea].trim() === '' && DENTRO.has(deseado.tipo)) {
    // Un diálogo vacío recién abierto: se clasifica como si ya tuviera texto, para que el personaje lo siga siendo.
    const copia = [...lineas];
    copia[deseado.linea] = deseado.tipo === 'acotacion' ? '(x)' : deseado.tipo === 'letra' ? '~x' : 'x';
    fuente = copia.join('\n');
  }
  const tipos = clasificarLineas(fuente, op(dic));
  // El deseado solo manda en una línea vacía o en texto que el parser lee como acción: Fountain explícito gana.
  if (lineas[deseado.linea].trim() === '' || cedeAlDeseado(clasificarLineas(texto, op(dic))[deseado.linea])) tipos[deseado.linea] = deseado.tipo;
  return tipos;
}

/** ¿Una línea vacía pegada a la de arriba quedaría dentro de un diálogo si tuviera texto? */
function esBloqueDialogo(texto: string, linea: number, dic: Diccionarios): boolean {
  const copia = texto.split('\n');
  copia[linea] = 'x';
  const t = clasificarLineas(copia.join('\n'), op(dic));
  return t[linea] === 'dialogo' && GRUPO.has(t[linea - 1] ?? '');
}

/** El tipo del párrafo en `pos`, o `null` donde el teclado del guion no actúa (frontmatter, comentario, portada…). */
export function tipoEnCursor(texto: string, pos: number, deseado?: Deseado | null, dic: Diccionarios = DICCIONARIOS_MX): TipoParrafo | null {
  const lineas = texto.split('\n');
  const { linea } = posicion(lineas, pos);
  if (linea <= finFrontmatter(lineas) || enComentario(texto, pos)) return null;
  if (deseado && deseado.linea === linea) {
    if (lineas[linea].trim() === '') return deseado.tipo;
    const base = clasificarLineas(texto, op(dic))[linea];
    return cedeAlDeseado(base) ? deseado.tipo : aParrafo(base);
  }
  if (lineas[linea].trim() === '') {
    if (linea === 0 || lineas[linea - 1].trim() === '') return 'accion';
    // Pegada a un párrafo: es diálogo si, con texto, quedaría dentro de un bloque de diálogo («ANA» + vacía).
    return esBloqueDialogo(texto, linea, dic) ? 'dialogo' : 'accion';
  }
  return aParrafo(clasificarLineas(texto, op(dic))[linea]);
}

// ---------- Ediciones ----------

interface Resultado {
  lineas: string[];
  linea: number;
  ch: number;
  deseado?: TipoParrafo;
  sugerir?: true;
}

/** Convierte el texto nuevo en un solo reemplazo mínimo. */
function conDiferencia(texto: string, nuevo: string, cursor: number, extra: Pick<Edicion, 'deseado' | 'sugerir'>): Edicion {
  const max = Math.min(texto.length, nuevo.length);
  let p = 0;
  while (p < max && texto[p] === nuevo[p]) p++;
  let s = 0;
  while (s < max - p && texto[texto.length - 1 - s] === nuevo[nuevo.length - 1 - s]) s++;
  const e: Edicion = { desde: p, hasta: texto.length - s, insertar: nuevo.slice(p, nuevo.length - s), cursor };
  if (extra.deseado) e.deseado = extra.deseado;
  if (extra.sugerir) e.sugerir = true;
  return e;
}

function aEdicion(texto: string, r: Resultado): Edicion {
  let cursor = r.ch;
  for (let k = 0; k < r.linea; k++) cursor += r.lineas[k].length + 1;
  return conDiferencia(texto, r.lineas.join('\n'), cursor, r);
}

const nada = (pos: number, deseado?: TipoParrafo): Edicion => ({ desde: pos, hasta: pos, insertar: '', cursor: pos, nada: true, ...(deseado ? { deseado } : {}) });

/** Cambia el tipo del párrafo L y ajusta las líneas en blanco de arriba. */
const RELLENO: Partial<Record<TipoParrafo, string>> = { acotacion: '(x)', letra: '~x', dialogo: 'x' };

function cambiar(lineas: string[], L: number, nuevo: TipoParrafo, texto: string, dic: Diccionarios): Resultado {
  const out = [...lineas];
  const linea = nuevo === 'acotacion' && texto === '' ? '()' : texto;
  out[L] = linea;
  let k = 0;
  while (L - 1 - k >= 0 && out[L - 1 - k].trim() === '') k++;
  const p = L - 1 - k;
  const fm = finFrontmatter(lineas);
  const hayAnterior = p >= 0 && p > fm;
  let need = hayAnterior ? 1 : 0;
  if (hayAnterior && DENTRO.has(nuevo)) {
    // ¿Pegado al párrafo de arriba quedaría dentro de su diálogo? Entonces va sin línea en blanco.
    const hipotesis = [...lineas.slice(0, p + 1), RELLENO[nuevo] ?? 'x', ...lineas.slice(L + 1)];
    need = GRUPO.has(clasificarLineas(hipotesis.join('\n'), op(dic))[p] ?? '') ? 0 : 1;
  }
  let L2 = L;
  if (k < need) {
    out.splice(L, 0, '');
    L2 = L + 1;
  } else if (k > 0 && need === 0 && hayAnterior) {
    out.splice(p + 1, k);
    L2 = p + 1;
  }
  return { lineas: out, linea: L2, ch: linea === '()' ? 1 : linea.length, deseado: nuevo };
}

/** Termina el párrafo L y abre uno nuevo del tipo `nuevo` debajo. */
function saltar(lineas: string[], L: number, tipo: TipoParrafo, nuevo: TipoParrafo, tipos: (TipoElemento | null)[], dic: Diccionarios): Resultado {
  const out = [...lineas];
  if (aParrafo(tipos[L]) !== tipo) out[L] = normalizarParrafo(out[L], tipo, dic);
  const blancos = blancosAntes(tipo, nuevo);
  // Los metadatos (%%escena: …%%) y comentarios pegados al encabezado se quedan con él.
  let fin = L;
  if (tipo === 'encabezado') while (fin + 1 < out.length && /^\s*%%.*%%\s*$/.test(out[fin + 1])) fin++;
  out.splice(fin + 1, 0, ...new Array<string>(blancos).fill(''), nuevo === 'acotacion' ? '()' : '');
  return { lineas: out, linea: fin + 1 + blancos, ch: nuevo === 'acotacion' ? 1 : 0, deseado: nuevo };
}

function hablante(texto: string, L: number): string {
  let nombre = '';
  for (const e of analizar(texto).elementos) {
    if (e.linea >= L) break;
    if (e.tipo === 'personaje') nombre = e.nombre ?? '';
    if (e.tipo === 'encabezado') nombre = '';
  }
  return nombre;
}

function partir(texto: string, lineas: string[], L: number, ch: number, tipo: TipoParrafo, tipos: (TipoElemento | null)[], dic: Diccionarios): Resultado {
  const out = [...lineas];
  const s = out[L];
  let izq = s.slice(0, ch).trimEnd();
  let der = s.slice(ch).trimStart();
  if (tipo === 'acotacion') {
    if (!izq.endsWith(')')) izq += ')';
    der = der.replace(/\)\s*$/, '');
  }
  if (aParrafo(tipos[L]) !== tipo) izq = normalizarParrafo(izq, tipo, dic);
  if (tipo === 'dialogo' || tipo === 'letra') {
    const nombre = hablante(texto, L);
    if (nombre) {
      if (tipo === 'letra') der = '~' + der.replace(/^~/, '');
      out.splice(L, 1, izq, '', nombre, der);
      return { lineas: out, linea: L + 3, ch: tipo === 'letra' ? 1 : 0, deseado: tipo };
    }
  }
  const nuevo = PARTIR[tipo];
  const blancos = blancosAntes(tipo, nuevo);
  out.splice(L, 1, izq, ...new Array<string>(blancos).fill(''), der);
  return { lineas: out, linea: L + 1 + blancos, ch: 0, deseado: nuevo };
}

function personajesConocidos(texto: string, dic: Diccionarios): Set<string> {
  const out = new Set<string>();
  for (const e of analizar(texto, op(dic)).elementos) if (e.tipo === 'personaje' && e.nombre) out.add(e.nombre.toUpperCase());
  return out;
}

/**
 * Enter, Tab, Shift+Tab y Shift+Enter en el guion.
 * Devuelve `null` donde el editor debe hacer lo normal.
 */
export function pulsarTecla(
  texto: string,
  desde: number,
  hasta: number,
  tecla: TeclaGuion,
  deseado?: Deseado | null,
  dic: Diccionarios = DICCIONARIOS_MX,
): Edicion | null {
  if (desde !== hasta) {
    if (tipoEnCursor(texto, desde, deseado, dic) === null) return null;
    if (tecla === 'Tab' || tecla === 'Shift-Tab') return nada(desde);
    const sinSeleccion = texto.slice(0, desde) + texto.slice(hasta);
    const varias = texto.slice(desde, hasta).includes('\n');
    const r = pulsarTecla(sinSeleccion, desde, desde, tecla, varias ? null : deseado, dic);
    if (!r) return null;
    const final = r.nada ? sinSeleccion : sinSeleccion.slice(0, r.desde) + r.insertar + sinSeleccion.slice(r.hasta);
    return conDiferencia(texto, final, r.cursor, r);
  }
  const tipo = tipoEnCursor(texto, desde, deseado, dic);
  if (!tipo) return null;
  const lineas = texto.split('\n');
  const { linea: L, ch } = posicion(lineas, desde);
  const s = lineas[L];
  const antes = s.slice(0, ch);
  const despues = s.slice(ch);
  // El texto tal cual, para saber si el párrafo que se deja necesita normalizarse.
  const tipos = clasificarLineas(texto, op(dic));

  if (tecla === 'Shift-Enter') {
    const out = [...lineas];
    out.splice(L, 1, antes, despues);
    return aEdicion(texto, { lineas: out, linea: L + 1, ch: 0, deseado: tipo });
  }

  const vacia = s.trim() === '' || (tipo === 'acotacion' && s.trim() === '()') || (tipo === 'letra' && s.trim() === '~');
  if (vacia) {
    const nuevo = tecla === 'Enter' ? ENTER_VACIO[tipo] : tecla === 'Tab' ? TAB_VACIO[tipo] : ATRAS_VACIO[tipo];
    if (!nuevo) return nada(desde, tipo);
    return aEdicion(texto, cambiar(lineas, L, nuevo, '', dic));
  }

  if (tecla === 'Shift-Tab') {
    const nuevo = ATRAS_TEXTO[tipo];
    if (!nuevo) return nada(desde);
    return aEdicion(texto, cambiar(lineas, L, nuevo, normalizarParrafo(contenido(s, tipo), nuevo, dic), dic));
  }

  const enFinal = despues.trim() === '' || (tipo === 'acotacion' && despues.trim() === ')');
  const enInicio = antes.trim() === '';

  if (tecla === 'Enter') {
    if (enFinal) {
      const soloUnaLinea = (L === 0 || lineas[L - 1].trim() === '') && (L + 1 >= lineas.length || lineas[L + 1].trim() === '');
      if (tipo === 'accion' && soloUnaLinea && personajesConocidos(texto, dic).has(contenido(s, 'accion').toUpperCase())) {
        const out = [...lineas];
        out.splice(L, 1, mayusculasSeguras(contenido(s, 'accion')), '');
        return aEdicion(texto, { lineas: out, linea: L + 1, ch: 0, deseado: 'dialogo' });
      }
      return aEdicion(texto, saltar(lineas, L, tipo, ENTER_FINAL[tipo], tipos, dic));
    }
    if (enInicio) {
      if (!EMPUJA.has(tipo)) return nada(desde);
      const out = [...lineas];
      out.splice(L, 0, '', '');
      return aEdicion(texto, { lineas: out, linea: L, ch: 0, deseado: tipo });
    }
    return aEdicion(texto, partir(texto, lineas, L, ch, tipo, tipos, dic));
  }

  // Tab
  if (enFinal) {
    if (tipo === 'encabezado') {
      const sinPunto = s.trimEnd().replace(/^\./, '');
      const m = PREFIJO_ESCENA.exec(sinPunto);
      const resto = m ? sinPunto.slice(m[0].length) : sinPunto;
      if (!resto.trim()) return nada(desde, tipo);
      if (!/\s[-–—]+\s+\S/.test(' ' + resto)) {
        const agregado = s.endsWith(' - ') ? '' : s.endsWith(' -') ? ' ' : s.endsWith(' ') ? '- ' : ' - ';
        const out = [...lineas];
        out[L] = s + agregado;
        return aEdicion(texto, { lineas: out, linea: L, ch: out[L].length, deseado: 'encabezado', sugerir: true });
      }
    }
    return aEdicion(texto, saltar(lineas, L, tipo, TAB_FINAL[tipo], tipos, dic));
  }
  if (enInicio && tipo === 'accion') {
    const r = cambiar(lineas, L, 'personaje', normalizarParrafo(contenido(s, 'accion'), 'personaje', dic), dic);
    return aEdicion(texto, { ...r, ch: 0 });
  }
  if (!enInicio && (tipo === 'dialogo' || tipo === 'letra')) {
    const out = [...lineas];
    const der = despues.trimStart();
    out.splice(L, 1, antes.trimEnd(), '()', tipo === 'letra' ? '~' + der : der);
    return aEdicion(texto, { lineas: out, linea: L + 1, ch: 1, deseado: 'acotacion' });
  }
  return nada(desde);
}

/** ¿La columna `ch` cae dentro de un enlace `[[…]]` o una marca `{código:…}` (cerrados o no)? */
function dentroDeMarcaOEnlace(s: string, ch: number): boolean {
  for (const re of [/\[\[[^\]]*(?:\]\]|$)/g, /\{[a-z]+:[^{}]*(?:\}|$)/g]) {
    for (const m of s.matchAll(re)) {
      const a = m.index ?? 0;
      const b = a + m[0].length;
      const cerrado = m[0].endsWith(']]') || m[0].endsWith('}');
      if (a < ch && (cerrado ? ch < b : ch <= b)) return true;
    }
  }
  return false;
}

/** «(» y «)» en el diálogo y la acotación. `null` = se escriben normal. */
export function teclearParentesis(texto: string, pos: number, caracter: '(' | ')', deseado?: Deseado | null, dic: Diccionarios = DICCIONARIOS_MX): Edicion | null {
  const tipo = tipoEnCursor(texto, pos, deseado, dic);
  if (!tipo) return null;
  const lineas = texto.split('\n');
  const { linea: L, ch } = posicion(lineas, pos);
  const s = lineas[L];
  const antes = s.slice(0, ch);
  const despues = s.slice(ch);
  if (dentroDeMarcaOEnlace(s, ch)) return null;
  const out = [...lineas];
  if (caracter === '(') {
    if (tipo === 'acotacion' && s.trim() === '()') return nada(pos, 'acotacion');
    if (tipo !== 'dialogo' && tipo !== 'letra') return null;
    if (s.replace(/^\s*~?/, '').trim() === '') {
      out[L] = '()';
      return aEdicion(texto, { lineas: out, linea: L, ch: 1, deseado: 'acotacion' });
    }
    if (despues.trim() === '') {
      out.splice(L + 1, 0, '()');
    } else {
      const der = despues.trimStart();
      out.splice(L, 1, antes.trimEnd(), '()', tipo === 'letra' ? '~' + der : der);
    }
    return aEdicion(texto, { lineas: out, linea: L + 1, ch: 1, deseado: 'acotacion' });
  }
  if (tipo !== 'acotacion' || !despues.startsWith(')')) return null;
  if (s.trim() === '()') return { desde: pos, hasta: pos, insertar: '', cursor: pos + 1, deseado: 'acotacion' };
  out.splice(L + 1, 0, '');
  return aEdicion(texto, { lineas: out, linea: L + 1, ch: 0, deseado: 'dialogo' });
}

/** Convierte el párrafo del cursor al tipo `nuevo` (comandos «Párrafo: …»). En una línea vacía solo fija el tipo deseado. */
export function convertirParrafo(texto: string, pos: number, nuevo: TipoParrafo, deseado?: Deseado | null, dic: Diccionarios = DICCIONARIOS_MX): Edicion | null {
  const lineas = texto.split('\n');
  const { linea: L } = posicion(lineas, pos);
  if (L <= finFrontmatter(lineas) || enComentario(texto, pos)) return null;
  const actual = tipoEnCursor(texto, pos, deseado, dic);
  const s = lineas[L];
  const vacia = s.trim() === '' || s.trim() === '()';
  const base = vacia ? '' : actual ? contenido(s, actual) : s.trim();
  return aEdicion(texto, cambiar(lineas, L, nuevo, vacia ? '' : normalizarParrafo(base, nuevo, dic), dic));
}

/**
 * Al teclear: si la línea acaba de volverse encabezado («int.») o transición del diccionario («corte a:»),
 * la línea en mayúsculas; si no, `null`.
 */
export function conversionAlTeclear(texto: string, linea: number, dic: Diccionarios = DICCIONARIOS_MX): string | null {
  const lineas = texto.split('\n');
  const s = lineas[linea] ?? '';
  if (linea > 0 && lineas[linea - 1].trim() !== '') return null;
  const u = mayusculasSeguras(s);
  if (u === s) return null;
  if (PREFIJO_ESCENA.test(s.trimStart())) return u;
  const siguienteVacia = linea + 1 >= lineas.length || lineas[linea + 1].trim() === '';
  const plano = textoPlano(analizarEnLinea(u.trim()));
  if (siguienteVacia && dic.transiciones.some((t) => t.toUpperCase() === plano)) return u;
  return null;
}

/** ¿La línea abre párrafo? (para la mayúscula inicial): primera, tras línea en blanco o tras personaje o acotación. */
export function inicioDeParrafo(texto: string, linea: number, deseado?: Deseado | null, dic: Diccionarios = DICCIONARIOS_MX): boolean {
  const lineas = texto.split('\n');
  if (linea === 0 || lineas[linea - 1].trim() === '') return true;
  const arriba = clasificarEditor(texto, deseado, dic)[linea - 1];
  return arriba === 'personaje' || arriba === 'acotacion';
}

/**
 * Al salir el cursor de una línea con tipo deseado: la línea escrita como Fountain válido para ese tipo, o `null`
 * si no hay nada que cambiar (vacía, ya se lee así) o si está en el frontmatter o en un comentario.
 */
export function normalizarAlSalir(texto: string, linea: number, tipo: TipoParrafo, dic: Diccionarios = DICCIONARIOS_MX): string | null {
  const lineas = texto.split('\n');
  const s = lineas[linea];
  if (s === undefined || !s.trim() || linea <= finFrontmatter(lineas)) return null;
  let inicio = 0;
  for (let k = 0; k < linea; k++) inicio += lineas[k].length + 1;
  if (enComentario(texto, inicio + 1) || enComentario(texto, inicio + s.length)) return null;
  // Una acción nunca se reescribe; y si el parser ya lee otro tipo explícito (encabezado, transición, ===, #…), ese gana.
  if (tipo === 'accion' || !cedeAlDeseado(clasificarLineas(texto, op(dic))[linea])) return null;
  const nueva = normalizarParrafo(s, tipo, dic);
  return nueva === s ? null : nueva;
}
