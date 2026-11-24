/** Listas que alimentan el reconocimiento y el autocompletado. Son del proyecto. */
export interface Diccionarios {
  inicios: string[];
  momentos: string[];
  extensiones: string[];
  transiciones: string[];
}

/** Las de fábrica, revisadas para México. */
export const DICCIONARIOS_MX: Diccionarios = {
  inicios: ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.'],
  momentos: ['DÍA', 'NOCHE', 'MAÑANA', 'TARDE', 'ATARDECER', 'AMANECER', 'CONTINUO', 'MÁS TARDE', 'MOMENTOS DESPUÉS', 'AL DÍA SIGUIENTE'],
  extensiones: ['V.O.', 'O.S.', 'O.C.', 'F.C.', "CONT'D", 'CONT.'],
  transiciones: [
    'CORTE A:',
    'CORTE DIRECTO A:',
    'CORTE A NEGRO.',
    'CORTE PARALELO A:',
    'DISOLVENCIA A:',
    'FUNDIDO A:',
    'FUNDIDO A NEGRO.',
    'FUNDIDO DE ENTRADA:',
    'FUNDIDO DE SALIDA.',
    'ENTRA EN FUNDIDO:',
    'SALE EN FUNDIDO.',
    'BARRIDO A:',
  ],
};

/** En mayúsculas, sin vacíos ni repetidos, en el orden dado. */
export function limpiarLista(lista: unknown): string[] {
  const fuente = Array.isArray(lista) ? lista : typeof lista === 'string' ? lista.split('\n') : [];
  const out: string[] = [];
  for (const x of fuente) {
    const t = String(x ?? '').trim().toUpperCase();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}
