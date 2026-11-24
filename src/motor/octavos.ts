import type { Config } from './config';
import type { Octavos, Pagina, Tramo } from './tipos';

/** «N/8», «P» o «P N/8». */
export function formatearOctavos(n: number): string {
  const paginas = Math.floor(n / 8);
  const resto = n % 8;
  if (!paginas) return `${resto}/8`;
  return resto ? `${paginas} ${resto}/8` : String(paginas);
}

/** Cronometraje por página: 60 s por página, 7.5 s por octavo. */
export function segundosAproximados(octavos: number): number {
  return octavos * 7.5;
}

/**
 * Reparte `objetivo` octavos enteros entre tramos con valores reales.
 * Cada tramo recibe al menos 1. El residuo va por resto mayor contra lo ya asignado
 * (el tramo que ya subió al mínimo no compite). Si los mínimos rebasan el objetivo,
 * se quita a los tramos mayores; si todos están en 1, gana el mínimo y la suma rebasa el objetivo.
 */
export function repartir(reales: number[], objetivo: number): number[] {
  const asignado = reales.map((r) => Math.max(1, Math.floor(r)));
  let suma = asignado.reduce((a, b) => a + b, 0);
  const orden = reales.map((r, k) => [r - asignado[k], k] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let i = 0; suma < objetivo && orden.length; i++) {
    asignado[orden[i % orden.length][1]]++;
    suma++;
  }
  while (suma > objetivo) {
    const mayor = Math.max(...asignado);
    if (mayor <= 1) break;
    asignado[asignado.indexOf(mayor)]--;
    suma--;
  }
  return asignado;
}

function tramosDe(p: Pagina): Omit<Tramo, 'octavos'>[] {
  const tramos: Omit<Tramo, 'octavos'>[] = [];
  p.lineas.forEach((l, k) => {
    if (l.escena < 0) return;
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo.escena === l.escena) ultimo.fin = k + 1;
    else tramos.push({ escena: l.escena, inicio: k, fin: k + 1 });
  });
  return tramos;
}

/** Octavos por página sobre la paginación real. */
export function calcularOctavos(paginas: Pagina[], numEscenas: number, cfg: Config): Octavos {
  const R = cfg.renglonesPorPagina;
  const porEscena = new Array<number>(numEscenas).fill(0);
  const paginasPorEscena: number[][] = Array.from({ length: numEscenas }, () => []);
  const porPagina = paginas.map((p, pi) => {
    const tramos = tramosDe(p);
    if (!tramos.length) return [];
    const ultima = pi === paginas.length - 1;
    const base = ultima ? p.lineas.length : R;
    // El primer tramo empieza arriba de la página, salvo que arriba haya texto previo a la primera escena.
    if (p.lineas[0].escena >= 0) tramos[0].inicio = 0;
    for (let k = 0; k < tramos.length; k++) tramos[k].fin = k < tramos.length - 1 ? tramos[k + 1].inicio : base;
    const previo = tramos[0].inicio;
    // Lo que cuenta es lo que ocupan las escenas: una página llena vale 8; la última, lo que ocupa (o 8 si se cuenta completa).
    const util = base - previo;
    const objetivo =
      ultima && !cfg.ultimaPaginaCompleta ? Math.max(1, Math.round((util / R) * 8)) : previo > 0 ? Math.max(1, Math.round((8 * util) / base)) : 8;
    const reales = tramos.map((t) => ((t.fin - t.inicio) / (base - previo)) * objetivo);
    const asignados = repartir(reales, objetivo);
    return tramos.map((t, k) => {
      if (t.escena < numEscenas) {
        porEscena[t.escena] += asignados[k];
        if (!paginasPorEscena[t.escena].includes(pi + 1)) paginasPorEscena[t.escena].push(pi + 1);
      }
      return { ...t, octavos: asignados[k] };
    });
  });
  return { porPagina, porEscena, paginasPorEscena, total: porEscena.reduce((a, b) => a + b, 0) };
}
