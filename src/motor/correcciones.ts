import type { TipoParrafo } from './teclado';

export interface OpcionesCorreccion {
  mayusculas: boolean;
  puntos: boolean;
  comillas: boolean;
  espacios: boolean;
}

export const CORRECCIONES_POR_DEFECTO: OpcionesCorreccion = { mayusculas: true, puntos: true, comillas: true, espacios: true };

const EN_MAYUSCULAS = new Set<string>(['encabezado', 'personaje', 'transicion', 'plano']);

/** ¿El cursor está escribiendo un código de marca, un enlace o un comentario? Ahí no se corrige nada. */
function protegido(antes: string): boolean {
  if (/\{[a-z]*$/.test(antes)) return true;
  if (antes.lastIndexOf('[[') > antes.lastIndexOf(']]')) return true;
  return (antes.match(/%%/g)?.length ?? 0) % 2 === 1;
}

/**
 * Lo que se corrige al teclear `tecleado` entre `antes` y `despues` (el texto de la línea).
 * Devuelve cuántos caracteres borrar antes del cursor y qué escribir en lugar de lo tecleado, o `null` si nada.
 */
export function corregir(
  antes: string,
  despues: string,
  tecleado: string,
  tipo: TipoParrafo | null,
  inicioParrafo: boolean,
  op: OpcionesCorreccion,
): { borrar: number; insertar: string } | null {
  if (!tipo || protegido(antes)) return null;
  if (tecleado === ' ' && op.espacios && (antes.trim() === '' || antes.endsWith(' '))) return { borrar: 0, insertar: '' };
  if (tecleado === '.' && op.puntos && antes.endsWith('..')) return { borrar: 2, insertar: '…' };
  if (tecleado === '"' && op.comillas) return { borrar: 0, insertar: antes === '' || /[\s([«—–-]$/.test(antes) ? '«' : '»' };
  if (EN_MAYUSCULAS.has(tipo)) {
    const u = tecleado.toUpperCase();
    return u !== tecleado ? { borrar: 0, insertar: u } : null;
  }
  if (op.mayusculas && tipo !== 'acotacion' && /^\p{Ll}$/u.test(tecleado)) {
    const alInicio = inicioParrafo && /^[\s¿¡«"—–-]*$/.test(antes);
    const trasFrase = despues.trim() === '' && /[.?!…]\s+[¿¡«"]*$/.test(antes);
    if (alInicio || trasFrase) return { borrar: 0, insertar: tecleado.toUpperCase() };
  }
  return null;
}
