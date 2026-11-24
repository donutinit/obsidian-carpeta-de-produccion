import type { Guion } from './index';
import { duracionEscenas } from './duracion';
import { analizarEnLinea, textoPlano } from './enlinea';
import { formatearOctavos } from './octavos';
import { celdaDeTabla, iniciosDeTabla } from './tablas';

/** La sinopsis «=» de la escena o, si no hay, el inicio de su primera acción. */
export function resumenEscena(g: Guion, k: number, largo = 90): string {
  const de = g.doc.elementos.filter((e) => e.escena === k);
  const e = de.find((x) => x.tipo === 'sinopsis') ?? de.find((x) => x.tipo === 'accion');
  if (!e) return '';
  const t = textoPlano(analizarEnLinea(e.texto.replace(/\n/g, ' '))).trim();
  return t.length > largo ? t.slice(0, largo - 1).trimEnd() + '…' : t;
}

/** `0:06`, `1:05`, `1:02:03`, `6`, `6 s` o `2 min`, en segundos; lo demás, `null`. */
export function leerDuracion(s: string): number | null {
  const t = s.trim().toLowerCase();
  const reloj = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(t);
  if (reloj) return reloj[3] !== undefined ? +reloj[1] * 3600 + +reloj[2] * 60 + +reloj[3] : +reloj[1] * 60 + +reloj[2];
  const comillas = /^(\d+)'\s*(?:(\d+)\s*(?:"|'')?)?$/.exec(t);
  if (comillas) return +comillas[1] * 60 + (comillas[2] ? +comillas[2] : 0);
  const solo = /^(\d+)\s*(?:"|'')$/.exec(t);
  if (solo) return +solo[1];
  const seg = /^(\d+(?:[.,]\d+)?)\s*(s|seg|segs|segundos?)?\.?$/.exec(t);
  if (seg) return Math.round(parseFloat(seg[1].replace(',', '.')));
  const min = /^(\d+(?:[.,]\d+)?)\s*(m|min|minutos?)$/.exec(t);
  if (min) return Math.round(parseFloat(min[1].replace(',', '.')) * 60);
  return null;
}

/** Minutos y segundos: `5:14`. */
export const formatearMinutos = (segundos: number) => {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const normal = (s: string) =>
  s
    .replace(/[*_`~.]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const vacia = (t: string) => !t.trim() || /^[—-]$/.test(t.trim());

export interface PlanoTecnico {
  escena: string;
  /** En segundos; `null` si la celda no tiene una duración. */
  duracion: number | null;
}

/**
 * Los planos del guion técnico: las filas de las tablas que tienen columna de escena, de duración y de plano o toma
 * (así no cuenta la tabla de resumen, que dice «Planos»). Las filas sin escena no cuentan.
 */
export function planosDeTecnico(fuente: string): PlanoTecnico[] {
  const out: PlanoTecnico[] = [];
  for (const L of iniciosDeTabla(fuente)) {
    const enc = celdaDeTabla(fuente, L, 0, 0);
    if (!enc) continue;
    const cabeza = Array.from({ length: enc.columnas }, (_, k) => normal(celdaDeTabla(fuente, L, 0, k)?.encabezado ?? ''));
    const cEsc = cabeza.findIndex((h) => /^(esc|escena|sc|(n|no|num|numero) ?(de )?escena)$/.test(h));
    const cDur = cabeza.findIndex((h) => /^duracion( en pantalla)?$/.test(h));
    const conPlano = cabeza.some((h) => /^((n|no|num|numero) ?(de )?)?(plano|toma)$/.test(h));
    if (cEsc < 0 || cDur < 0 || !conPlano) continue;
    for (let f = 0; ; f++) {
      const e = celdaDeTabla(fuente, L, f, cEsc);
      if (!e) break;
      if (vacia(e.texto)) continue;
      const d = celdaDeTabla(fuente, L, f, cDur);
      out.push({ escena: e.texto.trim(), duracion: d ? leerDuracion(d.texto) : null });
    }
  }
  return out;
}

export interface FilaTiming {
  escena: string;
  set: string;
  acciones: string;
  paginas: string;
  octavos: string;
  /** `null` si el proyecto no tiene guion técnico. */
  planos: number | null;
  segundos: number;
  /** El tiempo sale del texto del guion, no de las duraciones del guion técnico. */
  estimado: boolean;
  acumulado: number;
}

export interface Timing {
  filas: FilaTiming[];
  total: { escenas: number; paginas: number; octavos: number; planos: number | null; segundos: number };
}

/** El timing del guion. Con guion técnico, los planos y su duración salen de ahí; si no, el tiempo se estima. */
export function armarTiming(g: Guion, planos: PlanoTecnico[] | null): Timing {
  const estimados = duracionEscenas(g);
  const clave = (s: string) => s.trim().toUpperCase();
  let acumulado = 0;
  const filas = g.doc.escenas.map((e, k): FilaTiming => {
    const suyos = planos?.filter((p) => clave(p.escena) === clave(e.numero)) ?? [];
    const conDuracion = suyos.filter((p) => p.duracion !== null);
    // Si a algún plano le falta la duración, el tiempo es estimado: lo que sí se sabe más la parte proporcional del texto.
    const estimado = !conDuracion.length || conDuracion.length < suyos.length;
    const sabido = conDuracion.reduce((s, p) => s + (p.duracion ?? 0), 0);
    const texto = estimados[k] ?? 0;
    const segundos = !conDuracion.length ? Math.round(texto) : Math.round(sabido + (estimado ? (texto * (suyos.length - conDuracion.length)) / suyos.length : 0));
    acumulado += segundos;
    const pags = g.octavos.paginasPorEscena[k] ?? [];
    return {
      escena: e.numero,
      set: e.encabezado,
      acciones: resumenEscena(g, k),
      paginas: !pags.length ? '' : pags.length === 1 ? String(pags[0]) : `${pags[0]}–${pags[pags.length - 1]}`,
      octavos: formatearOctavos(g.octavos.porEscena[k] ?? 0),
      planos: planos ? suyos.length : null,
      segundos,
      estimado,
      acumulado,
    };
  });
  return {
    filas,
    total: { escenas: filas.length, paginas: g.paginas.length, octavos: g.octavos.total, planos: planos ? filas.reduce((s, f) => s + (f.planos ?? 0), 0) : null, segundos: acumulado },
  };
}

const celda = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const renglon = (celdas: string[]) => '|' + celdas.map((c) => (c ? ` ${celda(c)} ` : ' ')).join('|') + '|';

/** La tabla de la plantilla «04 - Timing», lista para pegar, con el renglón de total. */
export function timingMarkdown(t: Timing): string {
  const out = [renglon(['Esc.', 'Set', 'Acciones', 'Pág.', 'Octavos', 'Planos', 'Tiempo aprox.', 'Acumulado']), '|---:|---|---|---|---:|---:|---:|---:|'];
  for (const f of t.filas)
    out.push(renglon([f.escena, f.set, f.acciones, f.paginas, f.octavos, f.planos === null ? '—' : String(f.planos), (f.estimado ? '≈ ' : '') + formatearMinutos(f.segundos), formatearMinutos(f.acumulado)]));
  const minutos = (t.total.segundos / 60).toFixed(1);
  out.push(renglon([`${t.total.escenas} escenas`, '**Total**', '', String(t.total.paginas), `${t.total.octavos}/8`, t.total.planos === null ? '—' : String(t.total.planos), formatearMinutos(t.total.segundos), `${minutos} min`]));
  return out.join('\n') + '\n';
}
