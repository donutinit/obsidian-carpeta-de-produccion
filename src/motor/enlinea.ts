import type { Segmento } from './tipos';

/**
 * `{código:texto}`, `{código:texto|nombre}` o `{código:texto|nombre|cantidad}`. El texto puede ir vacío
 * (`{vest:|Traje azul}`) para un elemento que el guion no menciona.
 */
export const MARCA = /\{([a-z]+):([^{}|]*?)(?:\|([^{}|]+))?(?:\|(\d+))?\}/g;
const ENLACE = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;
const ENFASIS = /\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_/g;

/** Texto visible de un enlace de Obsidian: el alias, o el nombre de la nota sin carpetas ni encabezado. */
function textoEnlaces(s: string): string {
  return s.replace(ENLACE, (_m, ruta: string, alias?: string) => {
    if (alias) return alias;
    const nota = ruta.split('#')[0].split('/').pop() ?? ruta;
    return nota || ruta;
  });
}

function enfasis(salida: Segmento[], s: string): void {
  let ultimo = 0;
  for (const m of s.matchAll(ENFASIS)) {
    const idx = m.index ?? 0;
    if (idx > ultimo) salida.push({ t: s.slice(ultimo, idx) });
    if (m[1]) salida.push({ t: m[1], b: true, i: true });
    else if (m[2]) salida.push({ t: m[2], b: true });
    else if (m[3]) salida.push({ t: m[3], i: true });
    else salida.push({ t: m[4], u: true });
    ultimo = idx + m[0].length;
  }
  if (ultimo < s.length) salida.push({ t: s.slice(ultimo) });
}

/** Parte una línea en segmentos: marcas del breakdown, enlaces y énfasis. */
export function analizarEnLinea(fuente: string): Segmento[] {
  // Los enlaces se resuelven primero: su «|» de alias no debe confundirse con el de la marca.
  const texto = textoEnlaces(fuente);
  // Cada marca se vuelve un carácter reservado, para que el énfasis que la envuelve (*{ut:x}*) se reconozca entero.
  const marcas: Segmento[] = [];
  const conMarcadores = texto.replace(MARCA, (m, cat: string, t: string, nombre?: string, cantidad?: string) => {
    const item = (nombre ?? t).trim();
    if (!t && !item) return m;
    marcas.push({ t, cat, item, cantidad: cantidad ? Number(cantidad) : 1 });
    return String.fromCharCode(MARCADOR + marcas.length - 1);
  });
  const conEnfasis: Segmento[] = [];
  enfasis(conEnfasis, conMarcadores);
  const salida: Segmento[] = [];
  for (const s of conEnfasis) {
    const { t, ...estilo } = s;
    for (const parte of t.split(/([\uE000-\uF8FF])/)) {
      if (!parte) continue;
      const k = parte.length === 1 ? parte.charCodeAt(0) - MARCADOR : -1;
      if (k >= 0 && k < marcas.length) salida.push({ ...marcas[k], ...estilo });
      else salida.push({ t: parte, ...estilo });
    }
  }
  return salida;
}

/** Primer carácter de uso privado para los marcadores de marca. */
const MARCADOR = 0xe000;

export function textoPlano(segs: Segmento[]): string {
  return segs.map((s) => s.t).join('');
}
