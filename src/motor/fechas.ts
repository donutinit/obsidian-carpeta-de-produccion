/** Una fecha de calendario, sin hora ni zona: año, mes (1–12) y día. */
export interface Fecha {
  a: number;
  m: number;
  d: number;
}

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** La semana empieza en lunes, como la ruta crítica y el plan de rodaje. */
export const DIAS_CORTOS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const bisiesto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
export const diasDelMes = (a: number, m: number) => [31, bisiesto(a) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

const valida = (a: number, m: number, d: number): Fecha | null => (m >= 1 && m <= 12 && d >= 1 && d <= diasDelMes(a, m) ? { a, m, d } : null);

/** `2027-01-04`, `04/01/2027`, `4/1/2027`, `4-1-2027` o `4/1/27` (día, mes, año). Lo demás, `null`. */
export function leerFecha(s: string): Fecha | null {
  const t = s.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (iso) return valida(+iso[1], +iso[2], +iso[3]);
  const dma = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
  if (dma) return valida(dma[3].length === 2 ? 2000 + +dma[3] : +dma[3], +dma[2], +dma[1]);
  return null;
}

const dos = (n: number) => String(n).padStart(2, '0');

/** Día/mes/año, como se escribe una fecha en México: `04/01/2027`. */
export const escribirFecha = (f: Fecha) => `${dos(f.d)}/${dos(f.m)}/${f.a}`;

/** Días desde el 1 de enero de 1970, sin zonas horarias. */
const aDias = (f: Fecha) => Date.UTC(f.a, f.m - 1, f.d) / 86_400_000;
const deDias = (n: number): Fecha => {
  const x = new Date(n * 86_400_000);
  return { a: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
};

export const sumarDias = (f: Fecha, n: number): Fecha => deDias(aDias(f) + n);

/** Mismo día en otro mes; si no existe (31 de febrero), el último del mes. */
export function sumarMeses(f: Fecha, n: number): Fecha {
  const k = f.a * 12 + (f.m - 1) + n;
  const a = Math.floor(k / 12);
  const m = (k % 12) + 1 + (k % 12 < 0 ? 12 : 0);
  return { a, m, d: Math.min(f.d, diasDelMes(a, m)) };
}

export const mismaFecha = (x: Fecha | null | undefined, y: Fecha | null | undefined) => !!x && !!y && x.a === y.a && x.m === y.m && x.d === y.d;

/** 0 = lunes … 6 = domingo. */
export const diaDeLaSemana = (f: Fecha) => (new Date(Date.UTC(f.a, f.m - 1, f.d)).getUTCDay() + 6) % 7;

/** Las semanas del mes, de lunes a domingo; `null` donde el día es de otro mes. */
export function cuadriculaMes(a: number, m: number): (number | null)[][] {
  const celdas: (number | null)[] = new Array<null>(diaDeLaSemana({ a, m, d: 1 })).fill(null);
  for (let d = 1; d <= diasDelMes(a, m); d++) celdas.push(d);
  while (celdas.length % 7) celdas.push(null);
  const semanas: (number | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}
