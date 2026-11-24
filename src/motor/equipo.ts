import type { Guion } from './index';
import { limpiarNombre } from './ediciones';
import { personajesDelGuion } from './personajes';
import { cabezaDeTabla, COL_ESCENA, filasDeTabla } from './plan';
import { partesTecnica } from './selectores';
import { iniciosDeTabla } from './tablas';

/** Lo que se sugiere al agregar equipo especial, además de lo que el proyecto ya usa. */
export const EQUIPO_ESPECIAL = ['Steadicam', 'Gimbal', 'Dolly', 'Slider', 'Grúa', 'Dron', 'Rig de auto', 'Cámara de alta velocidad', 'Easyrig'];

/** Para comparar nombres: sin formato, acentos, mayúsculas, puntuación en los extremos ni espacios de más. */
const llano = (s: string) =>
  s
    .replace(/[*_`]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.,;:]+|[.,;:]+$/g, '')
    .toLowerCase();
const vacia = (t: string) => !t.trim() || /^[—-]$/.test(t.trim());
const mayuscula = (s: string) => s.charAt(0).toLocaleUpperCase('es') + s.slice(1);

/**
 * El equipo especial que se reconoce en el guion técnico, con su nombre de siempre. Solo lo conocido: un movimiento
 * cualquiera («paneo lento», «cámara baja») no es equipo.
 */
const CONOCIDO: Record<string, string> = {
  steadicam: 'Steadicam',
  gimbal: 'Gimbal',
  estabilizador: 'Gimbal',
  grua: 'Grúa',
  jib: 'Grúa',
  crane: 'Grúa',
  pluma: 'Grúa',
  dron: 'Dron',
  drone: 'Dron',
  dolly: 'Dolly',
  'dolly in': 'Dolly',
  'dolly out': 'Dolly',
  travelling: 'Dolly',
  traveling: 'Dolly',
  slider: 'Slider',
  easyrig: 'Easyrig',
  'rig de auto': 'Rig de auto',
  'car mount': 'Rig de auto',
  'camara de alta velocidad': 'Cámara de alta velocidad',
  'alta velocidad': 'Cámara de alta velocidad',
  'high speed': 'Cámara de alta velocidad',
};

/** El equipo especial que pide un movimiento de cámara: «steadicam» → «Steadicam», «travelling» → «Dolly», «paneo» → nada. */
export function equipoDeMovimiento(movimiento: string): string | null {
  return CONOCIDO[llano(movimiento)] ?? null;
}

export interface EquipoDePlano {
  escena: string;
  equipo: string;
}

/**
 * El equipo especial de cada escena según el guion técnico: lo que se reconoce en las columnas «Movimiento» y
 * «Descripción técnica» de cada plano («24 mm · steadicam», «Steadicam, grúa»). Sin repetir equipo en la escena.
 */
export function equipoDeTecnico(fuente: string): EquipoDePlano[] {
  const out: EquipoDePlano[] = [];
  for (const L of iniciosDeTabla(fuente)) {
    const h = cabezaDeTabla(fuente, L);
    const cEsc = h.findIndex((x) => COL_ESCENA.test(x));
    const columnas = h.flatMap((x, k) => (/^(mov|movimiento)( de camara)?$/.test(x) || x === 'descripcion tecnica' ? [k] : []));
    if (cEsc < 0 || !columnas.length) continue;
    for (const fila of filasDeTabla(fuente, L, h.length)) {
      const escena = (fila[cEsc] ?? '').trim();
      if (vacia(escena)) continue;
      for (const c of columnas)
        for (const parte of partesTecnica(fila[c] ?? '')) {
          const equipo = equipoDeMovimiento(parte);
          if (equipo && !out.some((x) => x.escena === escena && x.equipo === equipo)) out.push({ escena, equipo });
        }
    }
  }
  return out;
}

const claveEscena = (s: string) => s.replace(/\s+/g, '').toUpperCase();

/** Suma al breakdown el equipo del guion técnico, marcado como `tecnico`. Lo que ya está escrito en el guion manda. */
export function sumarEquipoTecnico(g: Guion, filas: EquipoDePlano[]): void {
  for (const f of filas) {
    const k = g.doc.escenas.findIndex((e) => claveEscena(e.numero) === claveEscena(f.escena));
    const bd = g.breakdown[k];
    if (!bd) continue;
    const lista = (bd.elementos.equipo ??= []);
    if (lista.some((x) => llano(x.nombre) === llano(f.equipo))) continue;
    lista.push({ nombre: mayuscula(f.equipo.trim()), cantidad: 1, origen: 'tecnico' });
  }
}

/** «Extras ×6», «Extras×6» o «Extras x 6» llevan cantidad; «Camioneta 4x4» es un nombre. */
export function leerCantidad(texto: string): { nombre: string; cantidad: number } {
  const limpio = limpiarNombre(texto);
  const m = /^(.*?\S)\s*(?:×|\s[xX])\s*(\d+)$/.exec(limpio);
  if (!m) return { nombre: limpio, cantidad: 1 };
  return { nombre: m[1].trim(), cantidad: Math.max(1, Number(m[2])) };
}

/**
 * Qué sugerir al agregar a la escena `k`: lo que ya se usó en otras escenas para esa categoría (lo más usado
 * primero) y, en equipo especial, la lista de fábrica; en reparto, los personajes. Sin lo que la escena ya tiene.
 */
export function sugerenciasDeElemento(g: Guion, cat: string, k: number): string[] {
  const nombres = (j: number) => (cat === 'rep' ? (g.breakdown[j]?.reparto ?? []) : (g.breakdown[j]?.elementos[cat] ?? []).map((x) => x.nombre));
  const cuenta = new Map<string, { nombre: string; n: number; orden: number }>();
  g.breakdown.forEach((_, j) => {
    for (const nombre of nombres(j)) {
      const c = llano(nombre);
      const x = cuenta.get(c);
      if (x) x.n++;
      else cuenta.set(c, { nombre, n: 1, orden: cuenta.size });
    }
  });
  const usados = [...cuenta.values()].sort((a, b) => b.n - a.n || a.orden - b.orden).map((x) => x.nombre);
  const extra = cat === 'equipo' ? EQUIPO_ESPECIAL : cat === 'rep' ? personajesDelGuion(g) : [];
  const ya = nombres(k).map(llano);
  const out: string[] = [];
  for (const n of [...usados, ...extra]) if (!ya.includes(llano(n)) && !out.some((x) => llano(x) === llano(n))) out.push(n);
  return out;
}
