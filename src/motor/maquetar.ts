import type { Config } from './config';
import { analizarEnLinea, textoPlano } from './enlinea';
import { envolver } from './envolver';
import type { Bloque, Documento, Elemento, Linea, Segmento, TipoLinea } from './tipos';

/** Columnas y anchos en caracteres de Courier 12. */
export const COLUMNAS = {
  encabezado: { columna: 0, ancho: 60 },
  accion: { columna: 0, ancho: 60 },
  plano: { columna: 0, ancho: 60 },
  personaje: { columna: 20, ancho: 40 },
  acotacion: { columna: 15, ancho: 30 },
  dialogo: { columna: 10, ancho: 35 },
  letra: { columna: 10, ancho: 35 },
} satisfies Record<string, { columna: number; ancho: number }>;

type Columnas = Record<'personaje' | 'acotacion' | 'dialogo' | 'letra', { columna: number; ancho: number }>;

/** Diálogo dual: dos medias páginas con 3 columnas de separación. */
export const COLUMNAS_DUAL: { izq: Columnas; der: Columnas } = {
  izq: { personaje: { columna: 7, ancho: 21 }, acotacion: { columna: 3, ancho: 22 }, dialogo: { columna: 0, ancho: 28 }, letra: { columna: 0, ancho: 28 } },
  der: { personaje: { columna: 38, ancho: 22 }, acotacion: { columna: 34, ancho: 22 }, dialogo: { columna: 31, ancho: 28 }, letra: { columna: 31, ancho: 28 } },
};

const ANCHO_PAGINA = 60;
/** Las transiciones terminan en esta columna. */
const FIN_TRANSICION = 55;

type TipoColumna = keyof typeof COLUMNAS;

const mayusculas = (segs: Segmento[]) => segs.map((s) => ({ ...s, t: s.t.toUpperCase() }));
const largo = (segs: Segmento[]) => textoPlano(segs).length;

function lineasDe(tipo: TipoColumna, texto: string, e: Elemento, fuente: number, mayus = false, cols: Partial<Columnas> = COLUMNAS): Linea[] {
  const { columna, ancho } = (cols as Record<string, { columna: number; ancho: number }>)[tipo] ?? COLUMNAS[tipo];
  const segs = mayus ? mayusculas(analizarEnLinea(texto)) : analizarEnLinea(texto);
  return envolver(segs, ancho).map((s) => ({ tipo, columna, segs: s, escena: e.escena, fuente }));
}

interface Dialogo {
  lineas: Linea[];
  personaje: { nombre: string; extension?: string };
  /** Índice del último elemento del bloque. */
  fin: number;
}

/** Personaje en `i` y sus acotaciones, diálogos y letras, en las columnas dadas. */
function dialogo(els: Elemento[], i: number, cols: Columnas | typeof COLUMNAS): Dialogo {
  const e = els[i];
  const lineas = lineasDe('personaje', e.texto.replace(/\s*\^$/, ''), e, e.linea, true, cols);
  let j = i;
  while (j + 1 < els.length && ['acotacion', 'dialogo', 'letra'].includes(els[j + 1].tipo)) {
    const d = els[++j];
    lineas.push(...lineasDe(d.tipo as TipoColumna, d.texto, d, d.linea, false, cols));
  }
  const personaje = { nombre: (e.nombre ?? e.texto).toUpperCase(), ...(e.extension ? { extension: e.extension.toUpperCase() } : {}) };
  for (const l of lineas) l.hablante = personaje.nombre;
  return { lineas, personaje, fin: j };
}

/** Junta dos diálogos renglón por renglón: el izquierdo manda y el derecho va en `der`. */
function juntar(izq: Linea[], der: Linea[], escena: number): Linea[] {
  const out: Linea[] = [];
  for (let k = 0; k < Math.max(izq.length, der.length); k++) {
    const l: Linea = izq[k] ? { ...izq[k] } : { tipo: 'dialogo', columna: 0, segs: [], escena };
    const d = der[k];
    if (d) l.der = { tipo: d.tipo, columna: d.columna, segs: d.segs, ...(d.fuente !== undefined ? { fuente: d.fuente } : {}), ...(d.hablante ? { hablante: d.hablante } : {}) };
    out.push(l);
  }
  return out;
}

export function maquetar(doc: Documento, cfg: Config): Bloque[] {
  const bloques: Bloque[] = [];
  const els = doc.elementos;
  for (let i = 0; i < els.length; i++) {
    const e = els[i];
    switch (e.tipo) {
      case 'seccion':
      case 'sinopsis':
        break;
      case 'salto':
        bloques.push({ tipo: 'salto', escena: e.escena, lineas: [], espacioAntes: 0 });
        break;
      case 'encabezado': {
        const lineas = lineasDe('encabezado', e.texto, e, e.linea, true);
        lineas[0].primeraDeEscena = true;
        bloques.push({ tipo: 'encabezado', escena: e.escena, lineas, espacioAntes: cfg.espacioAntesEncabezado });
        break;
      }
      case 'accion': {
        const lineas = e.texto.split('\n').flatMap((t, k) => lineasDe('accion', t, e, e.lineasFuente?.[k] ?? e.linea + k));
        bloques.push({ tipo: 'accion', escena: e.escena, lineas, espacioAntes: 1 });
        break;
      }
      case 'plano':
        bloques.push({ tipo: 'plano', escena: e.escena, lineas: lineasDe('plano', e.texto, e, e.linea, true), espacioAntes: 1 });
        break;
      case 'transicion':
      case 'centrado': {
        const segs = mayusculas(analizarEnLinea(e.texto));
        const ancho = e.tipo === 'transicion' ? FIN_TRANSICION : ANCHO_PAGINA;
        const lineas: Linea[] = envolver(segs, ancho).map((s) => ({
          tipo: e.tipo as TipoLinea,
          columna: e.tipo === 'transicion' ? Math.max(0, FIN_TRANSICION - largo(s)) : Math.max(0, Math.floor((ANCHO_PAGINA - largo(s)) / 2)),
          segs: s,
          escena: e.escena,
          fuente: e.linea,
        }));
        bloques.push({ tipo: e.tipo, escena: e.escena, lineas, espacioAntes: 1 });
        break;
      }
      case 'letra':
        bloques.push({ tipo: 'accion', escena: e.escena, lineas: lineasDe('letra', e.texto, e, e.linea), espacioAntes: 1 });
        break;
      case 'personaje': {
        const normal = dialogo(els, i, COLUMNAS);
        const sig = els[normal.fin + 1];
        if (sig?.tipo === 'personaje' && sig.dual && sig.escena === e.escena) {
          // Diálogo dual: este bloque a la izquierda y el del «^» a la derecha.
          const izq = dialogo(els, i, COLUMNAS_DUAL.izq);
          const der = dialogo(els, normal.fin + 1, COLUMNAS_DUAL.der);
          bloques.push({ tipo: 'dual', escena: e.escena, lineas: juntar(izq.lineas, der.lineas, e.escena), espacioAntes: 1, personaje: izq.personaje, personajeDer: der.personaje });
          i = der.fin;
          break;
        }
        bloques.push({ tipo: 'dialogo', escena: e.escena, lineas: normal.lineas, espacioAntes: 1, personaje: normal.personaje });
        i = normal.fin;
        break;
      }
      case 'acotacion':
      case 'dialogo':
        // Sin personaje delante (no debería pasar): se maqueta en su columna como bloque propio.
        bloques.push({ tipo: 'accion', escena: e.escena, lineas: lineasDe(e.tipo, e.texto, e, e.linea), espacioAntes: 1 });
        break;
    }
  }
  return bloques;
}
