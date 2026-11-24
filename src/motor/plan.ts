import type { Guion } from './index';
import { formatearOctavos } from './octavos';
import { celdaDeTabla, iniciosDeTabla } from './tablas';
import { leerDuracion, resumenEscena } from './timing';

const normal = (s: string) =>
  s
    .replace(/[*_`~.]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const vacia = (t: string) => !t.trim() || /^[—-]$/.test(t.trim());
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const clave = (s: string) => s.replace(/\s+/g, '').toUpperCase();
export const COL_ESCENA = /^(esc|escena|sc|(n|no|num|numero) ?(de )?escena)$/;

/** `9:00`, `09:00`, `9:00 AM`, `3:45 PM`, `15:45`, `9 am`, `9`, `9h`, `9h00`, `09.00` o `9:00 hrs`, en minutos desde la medianoche; lo demás, `null`. */
export function leerHora(s: string): number | null {
  const t = s
    .trim()
    .toLowerCase()
    .replace(/\s*(h|hrs?|horas?)\.?$/, '')
    .replace(/^(\d{1,2})\s*h\s*(\d{2})$/, '$1:$2')
    .replace(/^(\d{1,2})\s*h$/, '$1')
    .replace(/^(\d{1,2})\.(\d{2})$/, '$1:$2');
  const m = /^(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*(m\.?)?$/i.exec(t);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] === undefined ? 0 : +m[2];
  if (min > 59 || h > 23) return null;
  if (m[3]) {
    if (h > 12 || h === 0) return null;
    if (m[3].toLowerCase() === 'a') h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
  }
  return h * 60 + min;
}

/** En 24 horas: `15:45`; pasada la medianoche, `1:00 (+1)`; antes, `22:30 (−1)`. */
export function horaTexto(minutos: number): string {
  if (minutos < 0) return `${horaTexto(minutos + 1440)} (−1)`;
  const m = Math.round(minutos);
  const h = Math.floor(m / 60);
  const txt = `${h % 24}:${String(m % 60).padStart(2, '0')}`;
  return h >= 24 ? `${txt} (+1)` : txt;
}

/** `45` (minutos), `1:15` (horas y minutos), `45 min`, `1 h` o `1.5 h`, en minutos; lo demás, `null`. */
export function leerMinutos(s: string): number | null {
  const t = s.trim().toLowerCase();
  const reloj = /^(\d+):(\d{1,2})$/.exec(t);
  if (reloj) return +reloj[1] * 60 + +reloj[2];
  const hm = /^(\d+)\s*h\s*(\d{1,2})$/.exec(t);
  if (hm) return +hm[1] * 60 + +hm[2];
  const min = /^(\d+(?:[.,]\d+)?)\s*(m|min|mins|minutos?)?\.?$/.exec(t);
  if (min) return Math.round(parseFloat(min[1].replace(',', '.')));
  const h = /^(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|horas?)\.?$/.exec(t);
  if (h) return Math.round(parseFloat(h[1].replace(',', '.')) * 60);
  return null;
}

/** Los encabezados de la tabla que empieza en `L`, normalizados. */
export function cabezaDeTabla(fuente: string, L: number): string[] {
  const c = celdaDeTabla(fuente, L, 0, 0);
  return c ? Array.from({ length: c.columnas }, (_, k) => normal(celdaDeTabla(fuente, L, 0, k)?.encabezado ?? '')) : [];
}

/** Las filas de la tabla, como texto de cada celda. */
export function filasDeTabla(fuente: string, L: number, columnas: number): string[][] {
  const out: string[][] = [];
  for (let f = 0; celdaDeTabla(fuente, L, f, 0); f++) out.push(Array.from({ length: columnas }, (_, k) => celdaDeTabla(fuente, L, f, k)?.texto ?? ''));
  return out;
}

export interface DiaPlan {
  dia: number;
  /** Números de escena, en el orden en que se filman. */
  escenas: string[];
}

/** Lo que la persona decide: qué escenas se filman cada día y en qué orden (tabla con «Día» y «Esc.»). Una celda puede traer varias: «3, 1». */
export function diasDelPlan(fuente: string): DiaPlan[] {
  const dias = new Map<number, string[]>();
  for (const L of iniciosDeTabla(fuente)) {
    const h = cabezaDeTabla(fuente, L);
    const cDia = h.findIndex((x) => x === 'dia');
    const cEsc = h.findIndex((x) => COL_ESCENA.test(x));
    if (cDia < 0 || cEsc < 0) continue;
    for (const fila of filasDeTabla(fuente, L, h.length)) {
      const d = parseInt(fila[cDia].replace(/[^\d]+/g, ' ').trim(), 10);
      if (!Number.isFinite(d) || vacia(fila[cEsc])) continue;
      const escenas = fila[cEsc]
        .split(/\s*(?:[,;]|\by\b)\s*/)
        .map((x) => x.trim())
        .filter((x) => x && !vacia(x));
      dias.set(d, [...(dias.get(d) ?? []), ...escenas]);
    }
  }
  return [...dias.entries()].sort((a, b) => a[0] - b[0]).map(([dia, escenas]) => ({ dia, escenas }));
}

export interface DatosDia {
  fecha?: string;
  /** Minutos desde la medianoche. */
  primeraToma?: number;
  /** El llamado de crew o general que escribió la persona. */
  llamado?: number;
}

/**
 * Fecha, primera toma y llamado de cada día: de las tablas de dos columnas («Dato | Valor») de la sección «Día N»,
 * hasta el siguiente encabezado del mismo nivel o de uno mayor (los subtítulos «###» siguen dentro).
 */
export function datosDeDias(fuente: string): Map<number, DatosDia> {
  const lineas = fuente.split('\n');
  const tablas = iniciosDeTabla(fuente);
  const out = new Map<number, DatosDia>();
  lineas.forEach((l, i) => {
    const m = /^(#{1,6})\s*d[ií]a\s+(\d+)\b/i.exec(l.trim());
    if (!m) return;
    const nivel = m[1].length;
    const sig = lineas.findIndex((x, j) => j > i && /^(#{1,6})\s/.test(x.trim()) && (/^(#{1,6})/.exec(x.trim())?.[1].length ?? 7) <= nivel);
    const datos: DatosDia = {};
    for (const L of tablas.filter((t) => t > i && (sig < 0 || t < sig))) {
      if (cabezaDeTabla(fuente, L).length !== 2) continue;
      for (const [etiqueta, valor] of filasDeTabla(fuente, L, 2)) {
        if (vacia(valor)) continue;
        const e = normal(etiqueta).replace(/:$/, '').trim();
        if (e === 'fecha') datos.fecha = valor.trim();
        else if (e === 'primera toma') {
          const h = leerHora(valor);
          if (h !== null) datos.primeraToma = h;
        } else if (e === 'llamado de crew' || e === 'llamado general' || e === 'llamado') {
          const h = leerHora(valor);
          if (h !== null) datos.llamado = h;
        }
      }
    }
    out.set(+m[2], datos);
  });
  return out;
}

export interface PlanoCompleto {
  escena: string;
  numero: string;
  plano: string;
  tecnica: string;
  acciones: string;
  sonido: string;
  /** Duración en pantalla, en segundos. */
  duracion: number | null;
  /** Tiempo para grabarlo, en minutos («Tiempo de grabación»). */
  minutos: number | null;
}

/** Los planos del guion técnico con todo lo que el plan de rodaje usa. */
export function planosCompletos(fuente: string): PlanoCompleto[] {
  const out: PlanoCompleto[] = [];
  for (const L of iniciosDeTabla(fuente)) {
    const h = cabezaDeTabla(fuente, L);
    const col = (re: RegExp) => h.findIndex((x) => re.test(x));
    const cEsc = col(COL_ESCENA);
    const cNum = col(/^((n|no|num|numero) ?(de )?)(plano|toma)$/);
    const cPlano = col(/^(tipo de )?plano$/);
    if (cEsc < 0 || (cNum < 0 && cPlano < 0)) continue;
    const cTec = col(/^descripcion tecnica$/);
    const cAcc = col(/^(acciones|accion|descripcion)$/);
    const cSon = col(/^sonido$/);
    const cDur = col(/^duracion( en pantalla)?$/);
    const cMin = col(/^(tiempo de (grabacion|rodaje)|minutos)$/);
    const de = (fila: string[], k: number) => (k < 0 || vacia(fila[k] ?? '') ? '' : fila[k].trim());
    for (const fila of filasDeTabla(fuente, L, h.length)) {
      if (vacia(fila[cEsc] ?? '')) continue;
      out.push({
        escena: fila[cEsc].trim(),
        numero: de(fila, cNum),
        plano: de(fila, cPlano),
        tecnica: de(fila, cTec),
        acciones: de(fila, cAcc),
        sonido: de(fila, cSon),
        duracion: cDur < 0 ? null : leerDuracion(fila[cDur]),
        minutos: cMin < 0 ? null : leerMinutos(fila[cMin]),
      });
    }
  }
  return out;
}

export interface OpcionesPlan {
  /** Minutos para grabar un plano sin «Tiempo de grabación». */
  minutosPorPlano: number;
  /** Para una escena sin planos en el guion técnico: minutos por octavo. */
  minutosPorOctavo: number;
  minutosComida: number;
  /** La comida entra cuando se llevan estos minutos de rodaje. */
  comidaTras: number;
}

export const OPCIONES_PLAN: OpcionesPlan = { minutosPorPlano: 30, minutosPorOctavo: 10, minutosComida: 60, comidaTras: 360 };

export interface FilaPlan {
  hora: number;
  minutos: number;
  /** Índice de la escena en el guion, o -1 en la comida. */
  indice: number;
  escena: string;
  numero: string;
  plano: string;
  tecnica: string;
  acciones: string;
  sonido: string;
  set: string;
  intExt: string;
  momento: string;
  talentos: string[];
  comida?: boolean;
  /** La duración no vino del guion técnico: es la de las propiedades del proyecto o la de los octavos. */
  estimado?: boolean;
}

export interface PlanDia {
  dia: number;
  fecha?: string;
  filas: FilaPlan[];
  primeraToma: number;
  llamadoCrew: number;
  fin: number;
  /** Escenas del día que no están en el guion. */
  faltantes: string[];
  /** Escenas que aparecen más de una vez en el día: se programan una sola vez. */
  repetidas: string[];
}

/** El plan de un día: los planos de sus escenas en el orden del día, con hora, duración, set y talento, y la comida. */
export function armarPlan(g: Guion, dia: DiaPlan, datos: DatosDia, planos: PlanoCompleto[], op: OpcionesPlan = OPCIONES_PLAN): PlanDia {
  const primeraToma = datos.primeraToma ?? 8 * 60;
  const filasDia: FilaPlan[] = [];
  const faltantes: string[] = [];
  const repetidas: string[] = [];
  const vistas = new Set<string>();
  let t = primeraToma;
  let rodado = 0;
  let comida = false;
  const agregar = (f: Omit<FilaPlan, 'hora'>) => {
    if (!comida && op.minutosComida > 0 && rodado >= op.comidaTras) {
      filasDia.push({ hora: t, minutos: op.minutosComida, indice: -1, escena: '', numero: '', plano: 'Comida', tecnica: '', acciones: '', sonido: '', set: '', intExt: '', momento: '', talentos: [], comida: true });
      t += op.minutosComida;
      comida = true;
    }
    filasDia.push({ ...f, hora: t });
    t += f.minutos;
    rodado += f.minutos;
  };
  for (const numero of dia.escenas) {
    if (vistas.has(clave(numero))) {
      if (!repetidas.includes(numero)) repetidas.push(numero);
      continue;
    }
    vistas.add(clave(numero));
    const k = g.doc.escenas.findIndex((e) => clave(e.numero) === clave(numero));
    if (k < 0) {
      faltantes.push(numero);
      continue;
    }
    const e = g.doc.escenas[k];
    const base = { indice: k, escena: e.numero, set: e.locacion, intExt: e.introduccion, momento: e.momento, talentos: g.breakdown[k]?.reparto ?? [] };
    const suyos = planos.filter((p) => clave(p.escena) === clave(e.numero));
    if (!suyos.length) {
      const minutos = Math.max(op.minutosPorPlano, (g.octavos.porEscena[k] ?? 0) * op.minutosPorOctavo);
      agregar({ ...base, minutos, numero: '', plano: 'Escena completa', tecnica: '', acciones: resumenEscena(g, k), sonido: '', estimado: true });
    } else
      for (const p of suyos)
        agregar({ ...base, minutos: p.minutos ?? op.minutosPorPlano, numero: p.numero, plano: p.plano, tecnica: p.tecnica, acciones: p.acciones, sonido: p.sonido, estimado: p.minutos === null });
  }
  return { dia: dia.dia, fecha: datos.fecha, filas: filasDia, primeraToma, llamadoCrew: datos.llamado ?? primeraToma - 120, fin: t, faltantes, repetidas };
}

export interface Llamado {
  escenas: { escena: string; set: string; momento: string; personajes: string[]; planos: number; octavos: string; horario: string }[];
  /** Cada personaje del día con su primer plano y su llamado, una hora antes. */
  reparto: { personaje: string; llamado: number; primerPlano: number }[];
  /** El equipo especial del día, en el orden del día, con las escenas que lo usan. */
  equipo: { equipo: string; escenas: string[] }[];
}

/** La hoja de llamado del día: sus escenas en orden y el llamado de cada personaje. */
export function armarLlamado(g: Guion, plan: PlanDia): Llamado {
  const escenas: Llamado['escenas'] = [];
  const reparto: Llamado['reparto'] = [];
  const equipo: Llamado['equipo'] = [];
  for (const f of plan.filas) {
    if (f.comida) continue;
    for (const x of g.breakdown[f.indice]?.elementos.equipo ?? []) {
      let q = equipo.find((y) => sinAcentos(y.equipo) === sinAcentos(x.nombre));
      if (!q) equipo.push((q = { equipo: x.nombre, escenas: [] }));
      if (!q.escenas.includes(f.escena)) q.escenas.push(f.escena);
    }
    let e = escenas.find((x) => x.escena === f.escena);
    if (!e) {
      e = { escena: f.escena, set: f.set, momento: f.momento, personajes: f.talentos, planos: 0, octavos: formatearOctavos(g.octavos.porEscena[f.indice] ?? 0), horario: '' };
      escenas.push(e);
    }
    if (f.plano !== 'Escena completa') e.planos++;
    const ultima = plan.filas.filter((x) => x.escena === f.escena && !x.comida);
    e.horario = `${horaTexto(ultima[0].hora)}–${horaTexto(ultima[ultima.length - 1].hora + ultima[ultima.length - 1].minutos)}`;
    for (const p of f.talentos) if (!reparto.some((r) => r.personaje === p)) reparto.push({ personaje: p, llamado: f.hora - 60, primerPlano: f.hora });
  }
  return { escenas, reparto, equipo };
}
