import { analizarEnLinea, textoPlano } from './enlinea';
import { analizar, type OpcionesAnalisis } from './fountain';
import type { Elemento } from './tipos';

/** Una observación del revisor: qué regla, dónde y el fragmento que la dispara. */
export interface Observacion {
  regla: ReglaRevisor;
  nombre: string;
  mensaje: string;
  /** Línea del texto fuente, desde 0. */
  linea: number;
  /** Índice de la escena, o -1 antes del primer encabezado. */
  escena: number;
  fragmento: string;
}

export type ReglaRevisor = 'pasado' | 'camara' | 'prosa' | 'narrado' | 'acotacion-dentro' | 'nombres' | 'sin-presentar' | 'sin-lugar';

export const REGLAS_REVISOR: Record<ReglaRevisor, { nombre: string; mensaje: string }> = {
  pasado: { nombre: 'Acción en pasado', mensaje: 'La acción se escribe en presente: lo que pasa frente a la cámara, ahora.' },
  camara: { nombre: 'La cámara no lo ve', mensaje: 'Pensamientos, recuerdos o intenciones no se filman. Escribe la acción que los muestra.' },
  prosa: { nombre: 'Prosa', mensaje: 'Comparaciones y juicios son de la prosa. Describe lo que se ve: el lugar, los objetos y lo que hace cada quien.' },
  narrado: { nombre: 'Diálogo narrado', mensaje: 'Si alguien lo dice, va como diálogo, con el nombre de quien habla.' },
  'acotacion-dentro': { nombre: 'Acción dentro del diálogo', mensaje: 'Las acciones van en su propia línea: como acotación entre el nombre y el diálogo, o como acción.' },
  nombres: { nombre: 'Un personaje, dos nombres', mensaje: 'Usa el mismo nombre en todo el guion; si no, el breakdown y las listas lo cuentan como dos personajes.' },
  'sin-presentar': { nombre: 'Personaje sin presentar', mensaje: 'La primera vez que aparece un personaje va en MAYÚSCULAS en una acción, con su edad.' },
  'sin-lugar': { nombre: 'Escena sin descripción', mensaje: 'Antes del primer diálogo describe el lugar y quién está en la escena.' },
};

const LETRA = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Verbos en pasado sin forma: imperfecto en -aba, pretérito en -ó, -aron, -ieron, y los irregulares comunes. */
const IRREGULARES = new Set(['era', 'eran', 'estaba', 'estaban', 'había', 'habían', 'hubo', 'fue', 'fueron', 'tenía', 'tenían', 'hizo', 'hicieron', 'dijo', 'dijeron', 'vio', 'vieron', 'puso', 'pusieron', 'quiso', 'pudo', 'supo', 'trajo', 'estuvo', 'tuvo']);
/** Presentes que terminan como un imperfecto y sustantivos que terminan en «ó». */
const NO_PASADO = new Set(['guayaba', 'guayabas', 'destraba', 'destraban', 'traba', 'bongó', 'popó', 'acaban', 'traban', 'alaban', 'graban', 'recaban', 'buró', 'burós', 'dominó', 'plató', 'rococó', 'landó', 'gigoló', 'yoyó', 'capó', 'jacó']);
function esPasado(palabra: string): boolean {
  if (palabra === palabra.toUpperCase()) return false; // nombres de personajes y objetos en mayúsculas
  const p = palabra.toLowerCase();
  if (IRREGULARES.has(p)) return true;
  if (NO_PASADO.has(p)) return false;
  if (p.length >= 6 && /aban?$/.test(p)) return true;
  // Una palabra con mayúscula inicial puede ser un nombre (Sharon, Miró): solo cuentan los irregulares y el «-aba».
  if (palabra[0] !== p[0]) return false;
  return (p.length >= 3 && /[^aeiouáéíóú]ó$/.test(p)) || (p.length >= 6 && /(aron|ieron)$/.test(p));
}

const CAMARA = /\b(se dan? cuenta|podemos ver|piensan?|recuerdan?|como si(?! nada)|sienten? que|saben? que|se nota que|deciden?|desean?|imaginan?)\b/i;
/** El superlativo de la prosa: «uno de los restaurantes más…», con una sola palabra en medio. */
const PROSA = /\b(un[oa]s? de (los|las|esos|esas) [^\s.,;]+ m[aá]s\b|aparentemente|evidentemente|obviamente|claramente|realmente|definitivamente|sumamente|extremadamente|incre[ií]blemente|sin duda)/i;
const NARRADO = /\b(dicen?|preguntan?|piden?|contestan?|explican?|comentan?|gritan?|responden?|aseguran?)\s+(que|si)\b|\b(le|les)\s+cuentan?\s+que\b/i;
const TITULOS = /^(DON|DOÑA|SR|SRA|SEÑOR|SEÑORA|EL|LA|TÍO|TÍA)\.?\s+/;

/** La oración (del renglón) que contiene `i`, recortada. */
function oracion(t: string, i: number): string {
  const ini = Math.max(t.lastIndexOf('.', i - 1), t.lastIndexOf('!', i - 1), t.lastIndexOf('?', i - 1)) + 1;
  const fin = t.slice(i).search(/[.!?]/);
  const o = t.slice(ini, fin < 0 ? t.length : i + fin + 1).trim();
  return o.length > 90 ? o.slice(0, 89).trimEnd() + '…' : o;
}

/** Lo que va entre comillas (un mensaje en pantalla, un letrero) se cambia por espacios: no se revisa. */
const sinCitas = (t: string) => t.replace(/«[^»]*»|"[^"]*"|“[^”]*”/g, (m) => ' '.repeat(m.length));

/** Cada renglón de una acción con su línea fuente y su texto visible. */
function renglones(e: Elemento): { linea: number; texto: string }[] {
  return e.texto.split('\n').map((t, i) => ({ linea: e.lineasFuente?.[i] ?? e.linea + i, texto: sinCitas(textoPlano(analizarEnLinea(t))) }));
}

/** Revisa el formato del guion con las reglas de la clase y devuelve las observaciones en orden. */
export function revisarGuion(fuente: string, opciones?: OpcionesAnalisis): Observacion[] {
  const doc = analizar(fuente, opciones);
  const out: Observacion[] = [];
  const nota = (regla: ReglaRevisor, linea: number, escena: number, fragmento: string) => out.push({ regla, ...REGLAS_REVISOR[regla], linea, escena, fragmento });

  // Reglas de la acción: una observación por regla y renglón.
  for (const e of doc.elementos) {
    if (e.tipo !== 'accion') continue;
    for (const r of renglones(e)) {
      const palabras = [...r.texto.matchAll(new RegExp(`[${LETRA}]+`, 'g'))];
      const p = palabras.find((m) => esPasado(m[0]));
      if (p) nota('pasado', r.linea, e.escena, oracion(r.texto, p.index ?? 0));
      for (const [regla, re] of [['camara', CAMARA], ['prosa', PROSA], ['narrado', NARRADO]] as const) {
        const m = re.exec(r.texto);
        if (m) nota(regla, r.linea, e.escena, oracion(r.texto, m.index));
      }
    }
  }

  // Acotaciones a media réplica.
  // Una acción entre paréntesis: varias palabras y sin números («(de 1999)» es parte de lo que se dice).
  for (const e of doc.elementos) {
    if (e.tipo !== 'dialogo') continue;
    const m = [...e.texto.matchAll(/\(([^()]{3,})\)/g)].find((x) => !/\d/.test(x[1]) && /\s/.test(x[1].trim()));
    if (m) nota('acotacion-dentro', e.linea, e.escena, m[0]);
  }

  // Personajes: dos nombres para el mismo, y quien habla sin haber sido presentado.
  const primeros = new Map<string, Elemento>();
  for (const e of doc.elementos) if (e.tipo === 'personaje' && e.nombre && !primeros.has(e.nombre)) primeros.set(e.nombre, e);
  const nombres = [...primeros.keys()];
  const clave = (n: string) => sinAcentos(n.replace(TITULOS, ''));
  const SINONIMOS: Record<string, string> = { SR: 'SEÑOR', SRA: 'SEÑORA' };
  const titulo = (n: string) => {
    const t = TITULOS.exec(n)?.[1];
    return t ? sinAcentos(SINONIMOS[t] ?? t) : null;
  };
  nombres.forEach((a, i) =>
    nombres.slice(i + 1).forEach((b) => {
      if (clave(a) !== clave(b)) return;
      // Títulos distintos son personas distintas: SEÑOR LÓPEZ y SEÑORA LÓPEZ.
      const ta = titulo(a);
      const tb = titulo(b);
      if (ta && tb && ta !== tb) return;
      const [x, y] = [a, b].sort((m, n) => m.length - n.length || m.localeCompare(n, 'es'));
      const despues = primeros.get(b)!;
      nota('nombres', despues.linea, despues.escena, `${x} / ${y}`);
    }),
  );
  const fueraDeCuadro = (n: string) => doc.elementos.filter((x) => x.tipo === 'personaje' && x.nombre === n).every((x) => /^(V\.?O\.?|O\.?S\.?|O\.?C\.?)$/i.test(x.extension ?? ''));
  for (const [nombre, e] of primeros) {
    // Quien solo habla fuera de cuadro (un narrador, una voz al teléfono) no se presenta en pantalla.
    if (fueraDeCuadro(nombre)) continue;
    const re = new RegExp(`(^|[^${LETRA}])${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^${LETRA}]|$)`);
    const presentado = doc.elementos.some((x) => x.tipo === 'accion' && x.linea < e.linea && re.test(x.texto));
    if (!presentado) nota('sin-presentar', e.linea, e.escena, nombre);
  }

  // Escenas que empiezan con diálogo.
  doc.escenas.forEach((s, k) => {
    const primero = doc.elementos.find((x) => x.escena === k && x.tipo !== 'encabezado' && x.tipo !== 'sinopsis' && x.tipo !== 'seccion');
    if (primero?.tipo === 'personaje') nota('sin-lugar', s.linea, k, s.encabezado);
  });

  return out.sort((a, b) => a.linea - b.linea);
}
