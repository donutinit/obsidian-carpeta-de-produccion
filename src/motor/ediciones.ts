import { construir } from './index';
import type { Cambio } from './escenas';
import { MARCA } from './enlinea';
import { analizar, clasificarLineas } from './fountain';

const mismo = (a: string, b: string) => a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es');
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const mismoSinAcentos = (a: string, b: string) => mismo(sinAcentos(a), sinAcentos(b));
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function inicios(fuente: string): number[] {
  const out: number[] = [];
  let p = 0;
  for (const l of fuente.split('\n')) {
    out.push(p);
    p += l.length + 1;
  }
  return out;
}

/** Escribe una marca: `{cat:texto}`, con `|nombre` si difiere del texto y `|cantidad` si pasa de 1. */
/** Un nombre que cabe en una marca: sin «{», «}», «|», «%» ni saltos, y sin espacios de más. */
export const limpiarNombre = (s: string) =>
  s
    .replace(/[{}|%\n\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function escribirMarca(cat: string, texto: string, nombre?: string, cantidad = 1): string {
  const conNombre = (nombre !== undefined && nombre !== texto) || cantidad > 1 || !texto;
  return `{${cat}:${texto}${conNombre ? '|' + (nombre ?? texto) : ''}${cantidad > 1 ? '|' + cantidad : ''}}`;
}

/** Rangos donde no se marca nada: frontmatter, comentarios, boneyard, marcas y enlaces. */
function protegidos(fuente: string): [number, number][] {
  const out: [number, number][] = [];
  const fm = fuente.match(/^---\n[\s\S]*?\n---(?=\n|$)/);
  if (fm) out.push([0, fm[0].length]);
  for (const re of [/%%[\s\S]*?(?:%%|$)/g, /\/\*[\s\S]*?(?:\*\/|$)/g, new RegExp(MARCA.source, 'g'), /\[\[[^\]]*\]\]/g]) {
    for (const m of fuente.matchAll(re)) out.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  }
  return out;
}

const ELEGIBLES = new Set(['encabezado', 'accion', 'dialogo']);

/** Marca cada aparición de `texto` como palabra completa en acción, diálogo y encabezado (fuera de marcas, enlaces y comentarios). */
export function marcarMenciones(fuente: string, cat: string, texto: string, nombre?: string): Cambio[] {
  const t = texto.trim();
  if (!t) return [];
  const tipos = clasificarLineas(fuente);
  const ini = inicios(fuente);
  const zonas = protegidos(fuente);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapar(t)}(?![\\p{L}\\p{N}])`, 'giu');
  const out: Cambio[] = [];
  fuente.split('\n').forEach((linea, k) => {
    if (!ELEGIBLES.has(tipos[k] ?? '')) return;
    for (const m of linea.matchAll(re)) {
      const a = ini[k] + (m.index ?? 0);
      const b = a + m[0].length;
      if (zonas.some(([x, y]) => a < y && b > x)) continue;
      out.push({ desde: a, hasta: b, texto: escribirMarca(cat, m[0], nombre) });
    }
  });
  return out;
}

/** [desde, hasta) de la escena k en el texto: de su encabezado al siguiente. */
function rangoEscena(fuente: string, k: number): [number, number] | null {
  const escenas = analizar(fuente).escenas;
  if (k < 0 || k >= escenas.length) return null;
  const ini = inicios(fuente);
  return [ini[escenas[k].linea], k + 1 < escenas.length ? ini[escenas[k + 1].linea] : fuente.length];
}

interface MarcaEn {
  desde: number;
  hasta: number;
  cat: string;
  texto: string;
  nombre?: string;
  cantidad: number;
  /** El comentario que la contiene, si está oculta. */
  comentario?: [number, number];
}

function marcas(fuente: string): MarcaEn[] {
  const comentarios = [...fuente.matchAll(/%%[\s\S]*?%%/g)].map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length] as [number, number]);
  return [...fuente.matchAll(new RegExp(MARCA.source, 'g'))].map((m) => {
    const desde = m.index ?? 0;
    const hasta = desde + m[0].length;
    const comentario = comentarios.find(([a, b]) => a <= desde && hasta <= b);
    return { desde, hasta, cat: m[1], texto: m[2], ...(m[3] ? { nombre: m[3] } : {}), cantidad: m[4] ? Number(m[4]) : 1, ...(comentario ? { comentario } : {}) };
  });
}

const nombreDe = (m: MarcaEn) => (m.nombre ?? m.texto).trim();

/** Quita el elemento de la escena: sus marcas dejan el texto visible y las ocultas se borran (con su comentario, si queda vacío). */
export function quitarElemento(fuente: string, escena: number, cat: string, nombre: string): Cambio[] {
  const r = rangoEscena(fuente, escena);
  if (!r) return [];
  const out: Cambio[] = [];
  const quitarComentario = new Map<string, [number, number]>();
  for (const m of marcas(fuente)) {
    if (m.desde < r[0] || m.hasta > r[1] || m.cat !== cat || !mismo(nombreDe(m), nombre)) continue;
    if (!m.comentario) {
      out.push({ desde: m.desde, hasta: m.hasta, texto: m.texto });
      continue;
    }
    const [a, b] = m.comentario;
    const resto = (fuente.slice(a + 2, m.desde) + fuente.slice(m.hasta, b - 2)).trim();
    if (resto) out.push({ desde: m.desde, hasta: m.hasta, texto: '' });
    else quitarComentario.set(`${a}`, [a, b]);
  }
  for (const [a, b] of quitarComentario.values()) {
    // Un comentario que queda vacío se va, y su línea también si no tenía nada más.
    const iniLinea = fuente.lastIndexOf('\n', a - 1) + 1;
    const finLinea = fuente.indexOf('\n', b);
    const sola = fuente.slice(iniLinea, a).trim() === '' && fuente.slice(b, finLinea < 0 ? fuente.length : finLinea).trim() === '';
    if (sola) out.push({ desde: iniLinea, hasta: finLinea < 0 ? fuente.length : finLinea + 1, texto: '' });
    else out.push({ desde: a, hasta: b, texto: '' });
  }
  return out.sort((x, y) => x.desde - y.desde);
}

/** Dónde se escriben las marcas ocultas de una escena: al final de su encabezado o de su línea de metadatos. */
function puntoBajoEncabezado(fuente: string, k: number): number | null {
  const e = analizar(fuente).escenas[k];
  if (!e) return null;
  const lineas = fuente.split('\n');
  const ini = inicios(fuente);
  const l = e.lineaMeta !== undefined && e.lineaMeta === e.linea + 1 ? e.lineaMeta : e.linea;
  return ini[l] + lineas[l].length;
}

/** Copia a la escena `hacia` los elementos de `desde` que no tenga (sin el reparto), como marcas ocultas. */
export function copiarElementos(fuente: string, desde: number, hacia: number): Cambio[] {
  const g = construir(fuente);
  const origen = g.breakdown[desde];
  const destino = g.breakdown[hacia];
  const pos = puntoBajoEncabezado(fuente, hacia);
  if (!origen || !destino || pos === null || desde === hacia) return [];
  const nuevas: string[] = [];
  for (const [cat, lista] of Object.entries(origen.elementos)) {
    if (cat === 'rep') continue;
    for (const x of lista) {
      if ((destino.elementos[cat] ?? []).some((y) => mismo(y.nombre, x.nombre))) continue;
      nuevas.push(`%%${escribirMarca(cat, '', x.nombre, x.cantidad)}%%`);
    }
  }
  return nuevas.length ? [{ desde: pos, hasta: pos, texto: nuevas.map((n) => '\n' + n).join('') }] : [];
}

/**
 * Agrega un elemento a la escena desde el breakdown: una marca oculta bajo su encabezado (o su línea de metadatos),
 * que no se imprime ni mueve los octavos. Si la escena ya lo tiene, nada.
 */
export function agregarOculto(fuente: string, escena: number, cat: string, nombre: string, cantidad = 1): Cambio[] {
  const n = limpiarNombre(nombre);
  const g = n ? construir(fuente) : undefined;
  const bd = g?.breakdown[escena];
  const pos = bd ? puntoBajoEncabezado(fuente, escena) : null;
  if (!g || !bd || pos === null) return [];
  // Una escena con `reparto=` fija su reparto: lo agregado no se vería.
  if (cat === 'rep' && g.doc.escenas[escena].meta.reparto !== undefined) return [];
  const ya = cat === 'rep' ? bd.reparto : (bd.elementos[cat] ?? []).map((x) => x.nombre);
  if (ya.some((x) => mismoSinAcentos(x, n))) return [];
  return [{ desde: pos, hasta: pos, texto: `\n%%${escribirMarca(cat, '', n, Math.max(1, Math.floor(cantidad)))}%%` }];
}

/**
 * La escena con ese número y encabezado; si el número cambió, la única con ese encabezado. Así, una hoja dibujada
 * antes de editar el guion no escribe en otra escena. Si no es seguro cuál es, `null`.
 */
export function escenaPorFirma(fuente: string, firma: { numero: string; encabezado: string }): number | null {
  const escenas = analizar(fuente).escenas;
  const enc = (s: string) => s.replace(/\s+/g, ' ').trim().toLocaleUpperCase('es');
  const num = (s: string) => s.replace(/\s+/g, '').toUpperCase();
  const ambos = escenas.findIndex((e) => num(e.numero) === num(firma.numero) && enc(e.encabezado) === enc(firma.encabezado));
  if (ambos >= 0) return ambos;
  const mismos = escenas.flatMap((e, k) => (enc(e.encabezado) === enc(firma.encabezado) ? [k] : []));
  return mismos.length === 1 ? mismos[0] : null;
}

/** Cuántas marcas tiene el elemento en la escena: las ocultas (agregadas desde el breakdown) y las de la acción. */
export function marcasDeElemento(fuente: string, escena: number, cat: string, nombre: string): { ocultas: number; visibles: number } {
  const r = rangoEscena(fuente, escena);
  const out = { ocultas: 0, visibles: 0 };
  if (!r) return out;
  for (const m of marcas(fuente)) {
    if (m.desde < r[0] || m.hasta > r[1] || m.cat !== cat || !mismo(nombreDe(m), nombre)) continue;
    if (m.comentario) out.ocultas++;
    else out.visibles++;
  }
  return out;
}

/** Quita la marca `k` de una línea de marcas ocultas (`%%{ut:|Llaves} {equipo:|Dron}%%`). `null` si era la única. */
export function quitarDeLineaOculta(linea: string, k: number): string | null {
  const m = /^(\s*%%)(.*?)(%%\s*)$/.exec(linea);
  if (!m) return linea;
  const todas = [...m[2].matchAll(new RegExp(MARCA.source, 'g'))];
  const x = todas[k];
  if (!x || x.index === undefined) return linea;
  if (todas.length === 1) return null;
  const resto = (m[2].slice(0, x.index) + m[2].slice(x.index + x[0].length)).replace(/\s+/g, ' ').trim();
  return `${m[1]}${resto}${m[3]}`;
}

/** Renombra un elemento en todo el guion; con un nombre que ya existe, los fusiona. */
export function renombrarElemento(fuente: string, cat: string, viejo: string, nuevo: string): Cambio[] {
  // Sin «{», «}» ni «|»: romperían la marca y saldrían impresos.
  const n = nuevo.replace(/[{}|]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n) return [];
  return marcas(fuente)
    .filter((m) => m.cat === cat && mismo(nombreDe(m), viejo))
    .map((m) => ({ desde: m.desde, hasta: m.hasta, texto: escribirMarca(cat, m.texto, n, m.cantidad) }));
}

/** Escribe `id=…` en los metadatos de cada escena que no lo tenga. Nunca cambia uno que ya existe. */
export function asegurarIds(fuente: string, generar: () => string): Cambio[] {
  const lineas = fuente.split('\n');
  const ini = inicios(fuente);
  const out: Cambio[] = [];
  for (const e of analizar(fuente).escenas) {
    if (e.id) continue;
    const id = generar();
    if (e.lineaMeta !== undefined) {
      // La misma regla que el parser: «%%escena:» o «%% escena:».
      const l = lineas[e.lineaMeta];
      const m = l.match(/%%\s*escena:/);
      if (m && m.index !== undefined) {
        const p = ini[e.lineaMeta] + m.index + m[0].length;
        const vacio = /^\s*%%/.test(l.slice(m.index + m[0].length));
        out.push({ desde: p, hasta: p, texto: vacio ? ` id=${id}` : ` id=${id};` });
        continue;
      }
    }
    const fin = ini[e.linea] + lineas[e.linea].length;
    out.push({ desde: fin, hasta: fin, texto: `\n%%escena: id=${id}%%` });
  }
  return out;
}
