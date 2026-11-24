import { DICCIONARIOS_MX } from './diccionarios';
import { analizarEnLinea, MARCA, textoPlano } from './enlinea';
import { numerarEscenas } from './numeracion';
import { leerFrontmatter, portadaDePropiedades } from './propiedades';
import type { Documento, Elemento, Escena, MarcaOculta, TipoElemento } from './tipos';

export const TRANSICIONES_MX = DICCIONARIOS_MX.transiciones;
export const MOMENTOS_MX = DICCIONARIOS_MX.momentos;

/** INT, EXT, EST, INT./EXT., EXT./INT., I/E… seguidos de punto o espacio. */
export const PREFIJO_ESCENA = /^(int\.?\/ext|ext\.?\/int|i\/e|e\/i|int|ext|est)[.\s]/i;
const NUMERO_FIJO = /\s*#([^#\s][^#]*)#\s*$/;
const META_ESCENA = /%%\s*escena:([^%\n]*)%%/g;

export const CLAVES_PORTADA: Record<string, string> = {
  title: 'title', 'título': 'title', titulo: 'title',
  credit: 'credit', 'crédito': 'credit', credito: 'credit',
  author: 'author', authors: 'author', autor: 'author', autores: 'author',
  source: 'source', fuente: 'source', 'basado en': 'source',
  'draft date': 'date', fecha: 'date', borrador: 'date',
  contact: 'contact', contacto: 'contact',
  notes: 'notes', notas: 'notes',
  copyright: 'copyright',
};

const escaparRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface OpcionesAnalisis {
  transiciones?: string[];
  momentos?: string[];
}

const esMayusculas = (s: string) => s === s.toUpperCase() && /[A-ZÁÉÍÓÚÑÜ]/.test(s);

/** Borra lo que coincide con `re` pero deja sus saltos de línea, para que los números de línea no cambien. */
function borrarConservandoLineas(fuente: string, re: RegExp): string {
  return fuente.replace(re, (m) => m.replace(/[^\n]/g, ''));
}

function normalizar(fuente: string): string {
  return String(fuente).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/[\t\u00A0]/g, ' ').normalize('NFC');
}

interface Preparado {
  lineas: string[];
  /** Línea → metadatos `%%escena: …%%` encontrados en ella. */
  metas: Map<number, Record<string, string>>;
  /**
   * Líneas que solo tenían comentario (`%%…%%` o `/*…*\/`): no cuentan como línea vacía
   * ni rompen párrafos o diálogos. Así, agregar un comentario no cambia la página.
   */
  transparentes: boolean[];
  /** Marcas dentro de comentarios `%%…%%` (sin escena todavía). */
  ocultas: Omit<MarcaOculta, 'escena'>[];
}

function preparar(fuente: string): Preparado {
  let src = normalizar(fuente);
  src = borrarConservandoLineas(src, /^---\n[\s\S]*?\n---(?=\n|$)/);
  const metas = new Map<number, Record<string, string>>();
  const lineaDe = (pos: number) => src.slice(0, pos).split('\n').length - 1;
  for (const m of src.matchAll(META_ESCENA)) {
    const meta: Record<string, string> = {};
    for (const par of m[1].split(';')) {
      const k = par.indexOf('=');
      if (k > 0) meta[par.slice(0, k).trim()] = par.slice(k + 1).trim();
    }
    metas.set(lineaDe(m.index ?? 0), meta);
  }
  const ocultas: Omit<MarcaOculta, 'escena'>[] = [];
  for (const c of src.matchAll(/%%[\s\S]*?%%/g)) {
    for (const m of c[0].matchAll(MARCA)) {
      const item = (m[3] ?? m[2]).trim();
      if (item) ocultas.push({ linea: lineaDe((c.index ?? 0) + (m.index ?? 0)), cat: m[1], item, cantidad: m[4] ? Number(m[4]) : 1 });
    }
  }
  const total = src.split('\n').length;
  const enComentario = new Array<boolean>(total).fill(false);
  for (const re of [/%%[\s\S]*?%%/g, /\/\*[\s\S]*?\*\//g]) {
    for (const m of src.matchAll(re)) {
      const ini = lineaDe(m.index ?? 0);
      const fin = ini + m[0].split('\n').length - 1;
      for (let k = ini; k <= fin; k++) enComentario[k] = true;
    }
    src = borrarConservandoLineas(src, re);
  }
  const lineas = src.split('\n').map((l) => l.trim());
  return { lineas, metas, ocultas, transparentes: lineas.map((l, k) => enComentario[k] && l === '') };
}

function separarEncabezado(texto: string, momentos: string[]): Pick<Escena, 'introduccion' | 'locacion' | 'momento'> {
  const t = texto.toUpperCase();
  const prefijo = t.match(PREFIJO_ESCENA);
  const introduccion = prefijo ? prefijo[0].trim() : '';
  let resto = t.slice(prefijo ? prefijo[0].length : 0).trim().replace(/^[.\s]+/, '');
  let momento = '';
  const conocido = momentos.find((m) => new RegExp(`\\s[-–—]\\s*${escaparRe(m)}$`).test(resto));
  if (conocido) {
    momento = conocido;
    resto = resto.replace(new RegExp(`\\s*[-–—]\\s*${escaparRe(conocido)}$`), '');
  } else {
    const k = resto.lastIndexOf(' - ');
    if (k >= 0) {
      momento = resto.slice(k + 3).trim();
      resto = resto.slice(0, k);
    }
  }
  return { introduccion, locacion: resto.trim(), momento };
}

/** Separa «NOMBRE (EXT) (EXT2) ^» en nombre, extensión y dual. */
function separarPersonaje(linea: string): { texto: string; nombre: string; extension?: string; dual: boolean } {
  let t = linea.replace(/^@/, '').trim();
  const dual = /\^$/.test(t);
  t = t.replace(/\s*\^$/, '').trim();
  const m = t.match(/^(.*?)\s*((?:\([^()]*\)\s*)+)$/);
  const nombre = (m ? m[1] : t).trim();
  const extensiones = m ? [...m[2].matchAll(/\(([^()]*)\)/g)].map((x) => x[1].trim()) : [];
  const limpio = (x: string) => textoPlano(analizarEnLinea(x)).trim();
  const ext = extensiones.map(limpio).filter(Boolean);
  return { texto: t, nombre: limpio(nombre), extension: ext.length ? ext.join(') (') : undefined, dual };
}

function leerPortada(L: string[], vacia: (k: number) => boolean): { portada: Record<string, string[]>; fin: number } {
  const portada: Record<string, string[]> = {};
  let i = 0;
  while (i < L.length && vacia(i)) i++;
  const clave = (l: string): [string, string] | null => {
    const m = l.match(/^([^:]{2,20}):\s*(.*)$/);
    const k = m && CLAVES_PORTADA[m[1].trim().toLowerCase()];
    return k ? [k, m[2]] : null;
  };
  if (i >= L.length || !clave(L[i])) return { portada, fin: 0 };
  let actual: string | null = null;
  for (; i < L.length && !vacia(i); i++) {
    const kv = clave(L[i]);
    if (kv) {
      actual = kv[0];
      portada[actual] = kv[1].trim() ? [kv[1].trim()] : [];
    } else if (actual) portada[actual].push(L[i]);
  }
  return { portada, fin: i };
}

/** Memoria de los últimos análisis: en el editor, una tecla consulta el mismo texto varias veces. */
const MEMORIA = 4;
const memoria = new Map<string, Documento>();
const claveDe = (fuente: string, o: OpcionesAnalisis) => `${(o.transiciones ?? []).join('\u0001')}\u0002${(o.momentos ?? []).join('\u0001')}\u0002${fuente}`;

/** El documento del guion. Se comparte entre llamadas con el mismo texto: no se debe modificar. */
export function analizar(fuente: string, opciones: OpcionesAnalisis = {}): Documento {
  const clave = claveDe(fuente, opciones);
  const previo = memoria.get(clave);
  if (previo) {
    memoria.delete(clave);
    memoria.set(clave, previo);
    return previo;
  }
  const doc = analizarSinMemoria(fuente, opciones);
  memoria.set(clave, doc);
  if (memoria.size > MEMORIA) memoria.delete(memoria.keys().next().value as string);
  return doc;
}

function analizarSinMemoria(fuente: string, opciones: OpcionesAnalisis = {}): Documento {
  const transiciones = opciones.transiciones ?? TRANSICIONES_MX;
  const momentos = opciones.momentos ?? MOMENTOS_MX;
  const { lineas: todas, metas, transparentes, ocultas: marcasOcultas } = preparar(fuente);
  // Se trabaja sobre las líneas que no son transparentes; `F[i]` es su número de línea en el texto.
  const F = todas.map((_, k) => k).filter((k) => !transparentes[k]);
  const L = F.map((k) => todas[k]);
  const vacia = (k: number) => k < 0 || k >= L.length || L[k] === '';
  const { portada: delCuerpo, fin } = leerPortada(L, vacia);
  // Las propiedades de la nota mandan sobre el bloque Title: del cuerpo, clave por clave.
  const portada = { ...delCuerpo, ...portadaDePropiedades(leerFrontmatter(fuente)) };
  const elementos: Elemento[] = [];
  const escenas: Escena[] = [];
  const finTransicion = transiciones.map((t) => t.toUpperCase());
  let escena = -1;
  const poner = (tipo: TipoElemento, texto: string, i: number, extra: Partial<Elemento> = {}) =>
    elementos.push({ tipo, texto, linea: F[i], escena, ...extra });

  for (let i = fin; i < L.length; i++) {
    const linea = L[i];
    if (!linea) continue;
    const antesVacia = vacia(i - 1);
    const plano = textoPlano(analizarEnLinea(linea));

    if (/^={3,}$/.test(linea)) { poner('salto', '', i); continue; }
    if (/^#{1,6}\s/.test(linea)) { poner('seccion', linea.replace(/^#+\s*/, ''), i); continue; }
    if (/^=[^=]/.test(linea)) { poner('sinopsis', linea.slice(1).trim(), i); continue; }

    if (antesVacia && (/^\.[^.]/.test(linea) || PREFIJO_ESCENA.test(linea))) {
      let t = linea.replace(/^\./, '');
      const nm = t.match(NUMERO_FIJO);
      const numeroFijo = nm ? nm[1].trim() : undefined;
      if (nm) t = t.slice(0, nm.index);
      // El texto conserva las marcas (las imprime maquetar); los datos de la escena van sin marcas ni enlaces.
      t = t.trim();
      const limpio = textoPlano(analizarEnLinea(t)).toUpperCase();
      escena = escenas.length;
      let meta: Record<string, string> = {};
      let lineaMeta: number | undefined;
      for (let k = F[i] + 1; k < todas.length; k++) {
        if (metas.has(k)) { meta = metas.get(k)!; lineaMeta = k; break; }
        if (!transparentes[k] && todas[k] !== '') break;
      }
      escenas.push({
        indice: escena,
        numero: '',
        ...(numeroFijo ? { numeroFijo } : {}),
        encabezado: limpio,
        ...separarEncabezado(limpio, momentos),
        linea: F[i],
        meta,
        ...(meta.id ? { id: meta.id } : {}),
        ...(lineaMeta !== undefined ? { lineaMeta } : {}),
      });
      poner('encabezado', t, i);
      continue;
    }

    if (/^>.*<$/.test(linea)) { poner('centrado', linea.slice(1, -1).trim(), i); continue; }
    if (/^!!/.test(linea)) { poner('plano', linea.slice(2).trim(), i); continue; }
    if (/^~/.test(linea)) { poner('letra', linea.slice(1).trim(), i); continue; }

    const mayus = plano.toUpperCase();
    if (/^>/.test(linea) || (antesVacia && vacia(i + 1) && esMayusculas(plano) && (/TO:$/.test(mayus) || finTransicion.some((t) => mayus.endsWith(t))))) {
      poner('transicion', linea.replace(/^>\s*/, ''), i);
      continue;
    }

    const p = separarPersonaje(linea);
    const nombrePlano = p.nombre;
    if (antesVacia && !vacia(i + 1) && !/^!/.test(linea) && (/^@/.test(linea) || (esMayusculas(nombrePlano) && !/[.!?:]$/.test(nombrePlano)))) {
      poner('personaje', p.texto, i, { nombre: p.nombre, ...(p.extension ? { extension: p.extension } : {}), ...(p.dual ? { dual: true } : {}) });
      for (i++; i < L.length && !vacia(i); i++) {
        const d = L[i];
        if (/^\(.*\)$/.test(d)) poner('acotacion', d, i);
        else if (/^~/.test(d)) poner('letra', d.slice(1).trim(), i);
        else poner('dialogo', d, i);
      }
      continue;
    }

    const parrafo = [linea.replace(/^!(?!!)/, '')];
    const inicio = i;
    while (!vacia(i + 1) && !/^={3,}$/.test(L[i + 1])) parrafo.push(L[++i]);
    poner('accion', parrafo.join('\n'), inicio, { lineasFuente: F.slice(inicio, i + 1) });
  }
  const numeros = numerarEscenas(escenas.map((e) => e.numeroFijo));
  escenas.forEach((e, k) => (e.numero = numeros[k]));
  const escenaDe = (linea: number) => escenas.filter((e) => e.linea <= linea).at(-1)?.indice ?? -1;
  const ocultas = marcasOcultas.map((o) => ({ ...o, escena: escenaDe(o.linea) }));
  return { portada, elementos, escenas, ocultas };
}

/** Un tipo por línea del texto fuente; `null` en líneas vacías, comentarios y portada. Lo usa el editor. */
export function clasificarLineas(fuente: string, opciones: OpcionesAnalisis = {}): (TipoElemento | null)[] {
  const total = normalizar(fuente).split('\n').length;
  const tipos = new Array<TipoElemento | null>(total).fill(null);
  for (const e of analizar(fuente, opciones).elementos) {
    for (const k of e.lineasFuente ?? [e.linea]) tipos[k] = e.tipo;
  }
  return tipos;
}
