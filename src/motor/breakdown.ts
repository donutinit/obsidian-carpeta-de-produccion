import { analizarEnLinea, textoPlano } from './enlinea';
import type { Bloque, Documento } from './tipos';

export interface ElementoBreakdown {
  nombre: string;
  cantidad: number;
  /** `tecnico`: viene del movimiento de un plano del guion técnico; no está escrito en el guion. */
  origen?: 'tecnico';
}

export interface BreakdownEscena {
  /** Quien habla (sin extensión) y los marcados como reparto, sin duplicados. */
  reparto: string[];
  /** Por código de categoría, los elementos con su cantidad máxima en la escena. */
  elementos: Record<string, ElementoBreakdown[]>;
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** «HOMBRE 1» → «Hombre 1», «DON PEDRO» → «Don Pedro». */
export const nombrePropio = (s: string) =>
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
export const GENERICOS = new Set(['TODOS', 'TODAS', 'AMBOS', 'AMBAS', 'VOZ', 'VOCES', 'OTROS', 'OTRAS', 'GRUPO', 'VARIOS', 'VARIAS', 'ALGUIEN']);
const REPARTO_EN_TEXTO = new Set(['encabezado', 'accion', 'plano', 'personaje', 'acotacion', 'dialogo', 'letra', 'transicion', 'centrado']);

/** Artículos y preposiciones que pueden ir antes del nombre en mayúsculas: «EL NOTARIO (34)» es Notario. */
const ARTICULOS = new Set(['EL', 'LA', 'LOS', 'LAS', 'UN', 'UNA', 'UNOS', 'UNAS', 'A', 'Y', 'E', 'O', 'DE', 'DEL', 'AL']);
/** Títulos que llevan punto y siguen siendo parte del nombre: «DR. RAMÍREZ». */
const TITULOS = new Set(['DR', 'DRA', 'SR', 'SRA', 'SRTA', 'LIC', 'ING', 'PROF', 'MTRO', 'MTRA']);
const PALABRA = String.raw`\p{Lu}[\p{Lu}\p{N}'-]*`;
/**
 * «AURELIO (78)», «MARÍA (65 años)», «ROSA (30, cansada)», «TOÑO (40s)», «LA ESPOSA DE JOSÉ (30-35)», «MARÍA de la LUZ (40)».
 * Un año («MONTERREY (2026)») no es una edad; lo de antes de un punto se separa después.
 */
const PRESENTACION = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(${PALABRA}(?:\.?[ ]+(?:(?:de|del|la|las|los)[ ]+)*${PALABRA})*)\s*\(\s*(\d{1,3})(s?)(?:\s*(?:-|–|a)\s*(\d{1,3}))?\s*(?:años|AÑOS|Años)?\s*(?:[,;][^)]*)?\)`,
  'gu',
);
const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los']);
const llanoNombre = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Los personajes que la acción presenta en mayúsculas con su edad, como manda el formato: «AURELIO (78)». En orden de
 * aparición, la primera edad de cada uno. Si quien habla usa un nombre más corto («AURELIO MÉNDEZ (78)» y luego
 * AURELIO), es el mismo; «HIJO DE AURELIO» no.
 */
export function presentaciones(doc: Documento): { nombre: string; edad: string }[] {
  const out: { nombre: string; edad: string }[] = [];
  const hablan = [...new Set(doc.elementos.filter((e) => e.tipo === 'personaje' && e.nombre).map((e) => (e.nombre ?? '').trim().toUpperCase()))];
  for (const e of doc.elementos) {
    if (e.tipo !== 'accion') continue;
    for (const m of textoPlano(analizarEnLinea(e.texto.replace(/\n/g, ' '))).matchAll(PRESENTACION)) {
      if (Number(m[2]) > 120 || (m[4] && Number(m[4]) > 120)) continue;
      // Lo de antes de un punto es otra oración («Se oye un PORTAZO. MARÍA (65)»), salvo un título («DR. RAMÍREZ»).
      const oraciones = m[1].split(/\.\s+/);
      let crudo = oraciones.pop() ?? '';
      const previa = oraciones[oraciones.length - 1]?.trim().split(/\s+/).pop() ?? '';
      if (TITULOS.has(previa)) crudo = `${previa}. ${crudo}`;
      const palabras = crudo.trim().split(/\s+/);
      while (palabras.length > 1 && ARTICULOS.has(palabras[0])) palabras.shift();
      crudo = palabras.join(' ').replace(/[ '-]+$/, '');
      if (!crudo || GENERICOS.has(crudo)) continue;
      // El nombre con que habla, si es parte de este sin «de» de por medio: AURELIO MÉNDEZ → AURELIO.
      if (!hablan.includes(crudo.toUpperCase())) {
        const mias = crudo.split(/\s+/).map(llanoNombre);
        const corto = hablan
          .filter((h) => {
            const suyas = h.split(/\s+/).map(llanoNombre);
            const sobran = mias.filter((w) => !suyas.includes(w));
            return suyas.every((w) => mias.includes(w)) && !sobran.some((w) => CONECTORES.has(w));
          })
          .sort((a, b) => b.length - a.length)[0];
        if (corto) crudo = corto;
      }
      const nombre = nombrePropio(crudo);
      const edad = m[4] ? `${m[2]}-${m[4]}` : m[2] + m[3];
      if (!out.some((x) => mismo(x.nombre, nombre))) out.push({ nombre, edad });
    }
  }
  return out;
}

export interface OpcionesBreakdown {
  /** Personajes conocidos aunque no hablen (notas de `Personajes/`). */
  conocidos?: string[];
  /** Lo que el proyecto dice que no es personaje aunque se presente con edad (`no_son_personajes`). */
  noPersonajes?: string[];
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
  // También quien se presenta con su edad aunque no hable («Un POLICÍA (35) vigila»).
  const fuera = (opciones.noPersonajes ?? []).map(llanoNombre);
  const presentados = presentaciones(doc)
    .map((p) => p.nombre)
    .filter((n) => !fuera.includes(llanoNombre(n)));
  const conocidos = [...hablan, ...presentados, ...(opciones.conocidos ?? []).map((x) => x.trim()).filter(Boolean)].filter((n, k, a) => a.findIndex((x) => mismo(x, n)) === k);
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
