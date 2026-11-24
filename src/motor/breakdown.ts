import { analizarEnLinea, textoPlano } from './enlinea';
import type { Bloque, Documento } from './tipos';

export interface BreakdownEscena {
  /** Quien habla (sin extensión) y los marcados como reparto, sin duplicados. */
  reparto: string[];
  /** Por código de categoría, los elementos con su cantidad máxima en la escena. */
  elementos: Record<string, { nombre: string; cantidad: number }[]>;
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** «HOMBRE 1» → «Hombre 1», «DON PEDRO» → «Don Pedro». */
const nombrePropio = (s: string) =>
  s
    .toLowerCase()
    .split(/(\s+)/)
    .map((w) => capitalizar(w))
    .join('');
const esMayusculas = (s: string) => s === s.toUpperCase() && /[A-ZÁÉÍÓÚÑÜ]/.test(s);
const mismo = (a: string, b: string) => a.toLocaleLowerCase('es') === b.toLocaleLowerCase('es');

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** ¿La extensión es de voz en off? Quien solo habla en V.O. no está en la escena. */
const esVozEnOff = (ext?: string) => !!ext && /(^|[\s(])V\.?\s?O\.?($|[\s)])/i.test(ext);
/** Nombres de diálogo que no son un personaje concreto: no cuentan como mención en la acción. */
const GENERICOS = new Set(['TODOS', 'TODAS', 'AMBOS', 'AMBAS', 'VOZ', 'VOCES', 'OTROS', 'OTRAS', 'GRUPO', 'VARIOS', 'VARIAS', 'ALGUIEN']);
const REPARTO_EN_TEXTO = new Set(['encabezado', 'accion', 'plano', 'personaje', 'acotacion', 'dialogo', 'letra', 'transicion', 'centrado']);

export interface OpcionesBreakdown {
  /** Personajes conocidos aunque no hablen (notas de `Personajes/`). */
  conocidos?: string[];
}

export function armarBreakdown(doc: Documento, bloques: Bloque[], opciones: OpcionesBreakdown = {}): BreakdownEscena[] {
  const escenas: BreakdownEscena[] = doc.escenas.map(() => ({ reparto: [], elementos: {} }));
  const agregarElemento = (e: BreakdownEscena, cat: string, crudo: string, cantidad: number) => {
    // El reparto escrito en MAYÚSCULAS (primera aparición del personaje) se escribe como nombre propio.
    const nombre = cat === 'rep' && esMayusculas(crudo) ? nombrePropio(crudo) : capitalizar(crudo);
    const lista = (e.elementos[cat] ??= []);
    const previo = lista.find((x) => mismo(x.nombre, nombre));
    if (previo) previo.cantidad = Math.max(previo.cantidad, cantidad);
    else lista.push({ nombre, cantidad });
    return nombre;
  };
  for (const b of bloques) {
    if (b.escena < 0 || b.escena >= escenas.length) continue;
    for (const l of b.lineas) {
      for (const s of [...l.segs, ...(l.der?.segs ?? [])]) if (s.cat && s.item) agregarElemento(escenas[b.escena], s.cat, s.item, s.cantidad ?? 1);
    }
  }
  for (const o of doc.ocultas) if (o.escena >= 0 && o.escena < escenas.length) agregarElemento(escenas[o.escena], o.cat, o.item, o.cantidad);

  // Reparto: quien habla (salvo solo en V.O.), los conocidos mencionados en la acción y los marcados,
  // en orden de primera aparición. `reparto=` en los metadatos de la escena reemplaza la lista.
  const hablan = doc.elementos.filter((e) => e.tipo === 'personaje' && e.nombre).map((e) => nombrePropio((e.nombre ?? '').trim()));
  const conocidos = [...hablan, ...(opciones.conocidos ?? []).map((x) => x.trim()).filter(Boolean)].filter((n, k, a) => a.findIndex((x) => mismo(x, n)) === k);
  // En español muchos nombres son palabras comunes (Rosa, Luz, Sol, Todos): la mención cuenta solo escrita con
  // mayúscula (Rosa o ROSA), y nunca los nombres genéricos de diálogo.
  const patrones = conocidos
    .filter((n) => !GENERICOS.has(n.toLocaleUpperCase('es')))
    .map((n) => {
      const formas = [...new Set([nombrePropio(n), n.toLocaleUpperCase('es'), n])].filter((f) => /^\p{Lu}/u.test(f)).map(escapar);
      return { n, re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${formas.join('|')})(?![\\p{L}\\p{N}])`, 'gu') };
    })
    .filter((p) => !/\(\?:\)/.test(p.re.source));
  const apariciones: { linea: number; pos: number; nombre: string }[][] = doc.escenas.map(() => []);
  for (const e of doc.elementos) {
    if (e.escena < 0 || e.escena >= escenas.length) continue;
    const ap = apariciones[e.escena];
    if (e.tipo === 'personaje' && e.nombre && !esVozEnOff(e.extension)) ap.push({ linea: e.linea, pos: -1, nombre: nombrePropio(e.nombre.trim()) });
    if (!REPARTO_EN_TEXTO.has(e.tipo)) continue;
    const segs = analizarEnLinea(e.texto.replace(/\n/g, ' '));
    let pos = 0;
    for (const s of segs) {
      if (s.cat === 'rep' && s.item) ap.push({ linea: e.linea, pos, nombre: esMayusculas(s.item) ? nombrePropio(s.item) : capitalizar(s.item) });
      pos += s.t.length;
    }
    if (e.tipo === 'accion') {
      const plano = textoPlano(segs);
      for (const { n, re } of patrones) for (const m of plano.matchAll(re)) ap.push({ linea: e.linea, pos: m.index ?? 0, nombre: n });
    }
  }
  for (const o of doc.ocultas) if (o.cat === 'rep' && o.escena >= 0 && o.escena < escenas.length) apariciones[o.escena].push({ linea: o.linea, pos: 0, nombre: esMayusculas(o.item) ? nombrePropio(o.item) : capitalizar(o.item) });
  escenas.forEach((e, k) => {
    const manual = doc.escenas[k].meta.reparto;
    if (manual !== undefined) {
      e.reparto = manual.split(',').map((x) => x.trim()).filter(Boolean);
      return;
    }
    for (const a of apariciones[k].sort((x, y) => x.linea - y.linea || x.pos - y.pos)) {
      if (a.nombre && !e.reparto.some((x) => mismo(x, a.nombre))) e.reparto.push(a.nombre);
    }
  });
  return escenas;
}
