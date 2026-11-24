import { CATEGORIAS } from './categorias';

const DE_FABRICA = new Set(CATEGORIAS.map((c) => c.codigo));

export type ResultadoMarca =
  | { tipo: 'cambio'; desde: number; hasta: number; texto: string; cursor: number }
  | { tipo: 'ignorar' }
  | { tipo: 'encimada' };

const MARCA = /\{([a-z]+):([^{}|\n]+?)(?:\|([^{}|\n]+))?(?:\|(\d+))?\}/g;

/**
 * Subrayado por teclas: con la selección [desde, hasta) de una línea, aplica la categoría `codigo`.
 * Dentro de una marca existente: el mismo código la quita y otro la cambia, conservando nombre y cantidad.
 */
export function aplicarMarca(linea: string, desde: number, hasta: number, codigo: string, codigos: Set<string> = DE_FABRICA): ResultadoMarca {
  if (!codigos.has(codigo) || hasta <= desde) return { tipo: 'ignorar' };
  for (const m of linea.matchAll(MARCA)) {
    const a = m.index ?? 0;
    const b = a + m[0].length;
    // Dentro de una marca (aunque su código no exista): el mismo código la quita y otro la cambia.
    if (desde < a || hasta > b) continue;
    const texto = m[1] === codigo ? m[2] : `{${codigo}:${m[0].slice(m[1].length + 2)}`;
    return { tipo: 'cambio', desde: a, hasta: b, texto, cursor: a + texto.length };
  }
  const sel = linea.slice(desde, hasta);
  const ini = desde + (sel.match(/^\s*/)?.[0].length ?? 0);
  const fin = hasta - (sel.match(/\s*$/)?.[0].length ?? 0);
  if (fin <= ini) return { tipo: 'ignorar' };
  const dentro = linea.slice(ini, fin);
  if (/[{}]/.test(dentro)) return { tipo: 'encimada' };
  const texto = `{${codigo}:${dentro}}`;
  return { tipo: 'cambio', desde: ini, hasta: fin, texto, cursor: ini + texto.length };
}
