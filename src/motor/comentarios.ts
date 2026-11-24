import type { Cambio } from './escenas';
import { escenaEnLinea } from './escenas';
import { analizarEnLinea, textoPlano } from './enlinea';
import { analizar } from './fountain';

/**
 * Un comentario del profesor: `%%>Autor: texto >>Otro: respuesta%%`, junto al fragmento comentado.
 * Resuelto si empieza con `>✓`. Todo en una línea: un salto dentro de un comentario a media línea partiría el párrafo.
 */
export interface Comentario {
  desde: number;
  hasta: number;
  linea: number;
  escena: number;
  autor: string;
  texto: string;
  respuestas: { autor: string; texto: string }[];
  resuelto: boolean;
  fragmento: string;
}

const COMENTARIO = /%%>([^%]*(?:%(?!%)[^%]*)*)%%/g;
const visible = (s: string) => textoPlano(analizarEnLinea(s.replace(/%%[\s\S]*?%%/g, ''))).trim();

export const limpiarAutor = (s: string) =>
  s
    .replace(/%/g, '')
    .replace(/[:>\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
/** Sin «%» (uno al final o «%%%» cerrarían el comentario antes de tiempo): se escribe «％». */
export const limpiarTexto = (s: string) =>
  s
    .replace(/%+/g, '％')
    .replace(/>>/g, '»')
    .replace(/\s*\n\s*/g, ' ')
    .trim();

function inicioDeLinea(fuente: string, pos: number): number {
  return fuente.lastIndexOf('\n', pos - 1) + 1;
}

export function listarComentarios(fuente: string): Comentario[] {
  const escenas = analizar(fuente).escenas;
  const out: Comentario[] = [];
  for (const m of fuente.matchAll(COMENTARIO)) {
    const desde = m.index ?? 0;
    const hasta = desde + m[0].length;
    const [primera, ...resto] = m[1].split(/\s>>/);
    const p = primera.match(/^(✓)?\s*([^:]*?):\s*([\s\S]*)$/);
    if (!p) continue;
    const linea = fuente.slice(0, desde).split('\n').length - 1;
    const ini = inicioDeLinea(fuente, desde);
    let fragmento = visible(fuente.slice(ini, desde));
    if (!fragmento) {
      const previas = fuente.slice(0, ini).split('\n').reverse();
      fragmento = previas.map(visible).find(Boolean) ?? '';
    }
    out.push({
      desde,
      hasta,
      linea,
      escena: escenaEnLinea(escenas, linea),
      autor: p[2].trim(),
      texto: p[3].trim(),
      respuestas: resto.map((r) => {
        const q = r.match(/^\s*([^:]*?):\s*([\s\S]*)$/);
        return q ? { autor: q[1].trim(), texto: q[2].trim() } : { autor: '', texto: r.trim() };
      }),
      resuelto: !!p[1],
      fragmento,
    });
  }
  return out;
}

/**
 * Escribe `%%>Autor: texto%%` en `hasta`. Nunca en una línea en blanco (el comentario la volvería «transparente» y
 * juntaría dos párrafos): ahí va al final de la línea anterior con texto. Dentro de otro comentario va después de él.
 * En el frontmatter no se puede (`null`).
 */
export function agregarComentario(fuente: string, hasta: number, autor: string, texto: string): Cambio | null {
  const nota = `%%>${limpiarAutor(autor) || 'Comentario'}: ${limpiarTexto(texto)}%%`;
  let h = Math.max(0, Math.min(hasta, fuente.length));
  const fm = fuente.match(/^\uFEFF?---\n[\s\S]*?\n---(?=\n|$)/);
  const finFm = fm ? fm[0].length : -1;
  if (h <= finFm) return null;
  for (const m of fuente.matchAll(/%%[\s\S]*?%%/g)) {
    const a = m.index ?? 0;
    const b = a + m[0].length;
    if (a < h && h < b) return { desde: b, hasta: b, texto: ' ' + nota };
  }
  const ini = inicioDeLinea(fuente, h);
  const finL = fuente.indexOf('\n', h);
  if (!fuente.slice(ini, finL < 0 ? fuente.length : finL).trim()) {
    let k = ini - 1;
    while (k > 0) {
      const i2 = inicioDeLinea(fuente, k);
      if (fuente.slice(i2, k).trim()) break;
      k = i2 - 1;
    }
    if (k > finFm && k > 0) h = k;
  }
  return { desde: h, hasta: h, texto: (fuente[h - 1] === '%' ? ' ' : '') + nota };
}

export function responderComentario(c: Comentario, autor: string, texto: string): Cambio {
  const pos = c.hasta - 2;
  return { desde: pos, hasta: pos, texto: ` >>${limpiarAutor(autor) || 'Respuesta'}: ${limpiarTexto(texto)}` };
}

export function alternarResuelto(fuente: string, c: Comentario): Cambio {
  const pos = c.desde + 3;
  return fuente[pos] === '✓' ? { desde: pos, hasta: pos + 1, texto: '' } : { desde: pos, hasta: pos, texto: '✓' };
}

/** Quita el comentario; si iba solo en su línea, quita la línea también. */
export function borrarComentario(fuente: string, c: Comentario): Cambio {
  const ini = inicioDeLinea(fuente, c.desde);
  const finLinea = fuente.indexOf('\n', c.hasta);
  const fin = finLinea < 0 ? fuente.length : finLinea;
  if (!fuente.slice(ini, c.desde).trim() && !fuente.slice(c.hasta, fin).trim()) return { desde: ini, hasta: finLinea < 0 ? fin : fin + 1, texto: '' };
  return { desde: c.desde, hasta: c.hasta, texto: '' };
}
