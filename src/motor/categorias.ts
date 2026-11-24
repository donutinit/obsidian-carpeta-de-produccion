/** Categorías del breakdown, en el orden de la hoja de desglose. */
export interface Categoria {
  codigo: string;
  nombre: string;
  /** Cómo se marca en papel: un color o una marca no cromática. */
  marca: string;
  /** Tecla del subrayado, leída como tecla física (`event.code`). */
  tecla: string;
  /** Clase de color `cp-t-<estilo>`; si falta, el código. */
  estilo?: string;
}

export const CATEGORIAS: Categoria[] = [
  { codigo: 'rep', nombre: 'Reparto', marca: 'rojo', tecla: '1' },
  { codigo: 'stunt', nombre: 'Stunts y acción', marca: 'naranja', tecla: '2' },
  { codigo: 'silent', nombre: 'Extras con acción', marca: 'amarillo', tecla: 'Shift-1' },
  { codigo: 'extra', nombre: 'Extras de atmósfera', marca: 'verde', tecla: '3' },
  { codigo: 'efx', nombre: 'Efectos especiales', marca: 'azul', tecla: '4' },
  { codigo: 'ut', nombre: 'Utilería', marca: 'morado', tecla: '5' },
  { codigo: 'veh', nombre: 'Vehículos y animales', marca: 'rosa', tecla: '6' },
  { codigo: 'mus', nombre: 'Música y sonido', marca: 'café', tecla: '7' },
  { codigo: 'deco', nombre: 'Decoración de set', marca: 'gris', tecla: '8' },
  { codigo: 'vest', nombre: 'Vestuario', marca: 'círculo', tecla: '9' },
  { codigo: 'maq', nombre: 'Maquillaje y peinado', marca: 'asterisco', tecla: '0' },
  { codigo: 'equipo', nombre: 'Equipo especial', marca: 'recuadro', tecla: 'Shift-2' },
  { codigo: 'nota', nombre: 'Notas de producción', marca: 'N al margen', tecla: 'Shift-3' },
];

export const CATEGORIA: Record<string, Categoria> = Object.fromEntries(CATEGORIAS.map((c) => [c.codigo, c]));

export const MAX_EXTRA = 6;

/** Las de fábrica más las extra del proyecto («vfx: Efectos visuales»), con teclas ⇧4… y colores x1…x6. */
export function categoriasDe(extra: unknown): Categoria[] {
  const out = [...CATEGORIAS];
  const lista = Array.isArray(extra) ? extra : typeof extra === 'string' ? extra.split('\n') : [];
  for (const x of lista) {
    if (out.length - CATEGORIAS.length >= MAX_EXTRA) break;
    const m = String(x ?? '').trim().match(/^([a-z]+)\s*:\s*(.+)$/);
    if (!m || out.some((c) => c.codigo === m[1])) continue;
    const n = out.length - CATEGORIAS.length + 1;
    out.push({ codigo: m[1], nombre: m[2].trim(), marca: `color extra ${n}`, tecla: `Shift-${n + 3}`, estilo: `x${n}` });
  }
  return out;
}
