import { contarPalabras } from './duracion';
import { analizarEnLinea, textoPlano } from './enlinea';
import { analizar, clasificarLineas } from './fountain';
import type { TipoElemento } from './tipos';

const normal = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export interface ResultadoBusqueda {
  linea: number;
  tipo: TipoElemento;
  texto: string;
  escena: number;
}

/** Busca en el texto visible, sin distinguir mayúsculas ni acentos, opcionalmente solo en ciertos tipos de párrafo. */
export function buscarEnGuion(fuente: string, consulta: string, tipos?: TipoElemento[]): ResultadoBusqueda[] {
  const q = normal(consulta.trim());
  const out: ResultadoBusqueda[] = [];
  for (const e of analizar(fuente).elementos) {
    if (tipos && !tipos.includes(e.tipo)) continue;
    const lineas = e.texto.split('\n');
    lineas.forEach((l, k) => {
      const visible = textoPlano(analizarEnLinea(l)).trim();
      if (!visible || (q && !normal(visible).includes(q))) return;
      out.push({ linea: e.lineasFuente?.[k] ?? e.linea + k, tipo: e.tipo, texto: visible, escena: e.escena });
    });
  }
  return out;
}

const DIALOGO = new Set(['personaje', 'acotacion', 'dialogo', 'letra']);

/** El párrafo de la línea (desde 0), como [primera, última]: en diálogo, del personaje a su última réplica. */
export function bloqueDeLinea(fuente: string, linea: number): [number, number] {
  const tipos = clasificarLineas(fuente);
  const lineas = fuente.split('\n');
  const t = tipos[linea];
  if (!lineas[linea]?.trim() || !t) return [linea, linea];
  let ini = linea;
  let fin = linea;
  if (DIALOGO.has(t)) {
    while (ini > 0 && t !== 'personaje' && tipos[ini] !== 'personaje' && DIALOGO.has(tipos[ini - 1] ?? '')) ini--;
    while (fin + 1 < lineas.length && ['acotacion', 'dialogo', 'letra'].includes(tipos[fin + 1] ?? '')) fin++;
    return [ini, fin];
  }
  while (ini > 0 && tipos[ini - 1] === t && lineas[ini - 1].trim()) ini--;
  while (fin + 1 < lineas.length && tipos[fin + 1] === t && lineas[fin + 1].trim()) fin++;
  return [ini, fin];
}

/** Lo que creció el guion en palabras visibles (negativo si se recortó). */
export function palabrasNetas(antes: string, despues: string): number {
  return contarPalabras(analizar(despues)) - contarPalabras(analizar(antes));
}
