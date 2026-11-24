import type { Config } from './config';
import { textoPlano } from './enlinea';
import { envolver } from './envolver';
import { COLUMNAS } from './maquetar';
import type { Bloque, Linea, Pagina, Segmento } from './tipos';

/** Tipos de línea que cuentan como texto de réplica o de acción para los mínimos de 2 y 2. */
const TEXTO_PARTIBLE = new Set(['dialogo', 'letra', 'accion']);
/** Bloques que nunca cierran página: viajan con lo que les sigue. */
const ATADOS = new Set<Bloque['tipo']>(['encabezado', 'plano']);
const PUNTUACION = new Set(['.', '!', '?', ':', ';', '…']);

/** Abreviaturas comunes en español: su punto no cierra la frase. («No.» y «etc.» sí pueden cerrarla.) */
const ABREVIATURAS = new Set(['sr', 'sra', 'srta', 'sres', 'dr', 'dra', 'lic', 'ing', 'arq', 'mtro', 'mtra', 'prof', 'profa', 'ud', 'uds', 'gral', 'cap', 'tte', 'sto', 'sta', 'av', 'col', 'núm', 'pág', 'aprox', 'tel', 'depto', 'dpto', 'cía', 'hnos']);

/**
 * Posiciones (en caracteres) justo después de un fin de frase: puntuación seguida de espacio o fin de línea.
 * Un punto después de una abreviatura o de una inicial («J.», «A.M.») no cuenta.
 */
export function finesDeFrase(texto: string): number[] {
  const out: number[] = [];
  for (let k = 0; k < texto.length; k++) {
    if (!PUNTUACION.has(texto[k]) || (k + 1 < texto.length && texto[k + 1] !== ' ')) continue;
    if (texto[k] === '.') {
      const palabra = texto.slice(0, k).match(/([A-Za-zÁÉÍÓÚÑÜáéíóúñü]+)$/)?.[1] ?? '';
      if (palabra.length === 1 || ABREVIATURAS.has(palabra.toLowerCase())) continue;
    }
    out.push(k + 1);
  }
  return out;
}

/** Corta los segmentos de una línea en la posición `pos` del texto plano. */
function partirSegs(segs: Segmento[], pos: number): [Segmento[], Segmento[]] {
  const a: Segmento[] = [];
  const b: Segmento[] = [];
  let k = 0;
  for (const s of segs) {
    const fin = k + s.t.length;
    if (fin <= pos) a.push(s);
    else if (k >= pos) b.push(s);
    else {
      a.push({ ...s, t: s.t.slice(0, pos - k) });
      b.push({ ...s, t: s.t.slice(pos - k) });
    }
    k = fin;
  }
  return [a, b];
}

/** Une las líneas de un mismo párrafo fuente en una sola tira de segmentos, con un espacio entre líneas. */
function unirLineas(lineas: Linea[]): Segmento[] {
  const out: Segmento[] = [];
  lineas.forEach((l, k) => {
    if (k > 0) out.push({ t: ' ' });
    out.push(...l.segs);
  });
  return out;
}

const mismoParrafo = (a: Linea, b: Linea) => a.tipo === b.tipo && a.fuente === b.fuente;

interface Corte {
  arriba: Linea[];
  abajo: Linea[];
}

/**
 * Busca, de abajo hacia arriba, el último fin de frase en las primeras `caben` líneas del bloque
 * que deje al menos 2 líneas de texto arriba y 2 abajo. El resto del párrafo cortado se vuelve a envolver.
 */
function buscarCorte(lineas: Linea[], caben: number): Corte | null {
  const ultima = Math.min(caben, lineas.length) - 1;
  for (let k = ultima; k >= 0; k--) {
    const l = lineas[k];
    if (!TEXTO_PARTIBLE.has(l.tipo)) continue;
    const texto = textoPlano(l.segs);
    const posiciones = finesDeFrase(texto).reverse();
    for (const pos of posiciones) {
      const [segsA, segsB] = partirSegs(l.segs, pos);
      const arriba = [...lineas.slice(0, k), { ...l, segs: segsA }];
      // El resto de la línea más las líneas siguientes del mismo párrafo se envuelven de nuevo.
      let fin = k + 1;
      while (fin < lineas.length && mismoParrafo(lineas[fin], l)) fin++;
      const restoTexto = textoPlano(segsB).trim();
      const restoParrafo: Linea[] = [];
      if (restoTexto || fin > k + 1) {
        const segsResto = unirLineas([{ ...l, segs: recortarInicio(segsB) }, ...lineas.slice(k + 1, fin)].filter((x) => textoPlano(x.segs) !== ''));
        const ancho = COLUMNAS[l.tipo as keyof typeof COLUMNAS].ancho;
        for (const s of envolver(segsResto, ancho)) if (s.length) restoParrafo.push({ ...l, segs: s, primeraDeEscena: undefined });
      }
      const abajo = [...restoParrafo, ...lineas.slice(fin)];
      const cuenta = (ls: Linea[]) => ls.filter((x) => TEXTO_PARTIBLE.has(x.tipo)).length;
      if (cuenta(arriba) >= 2 && cuenta(abajo) >= 2 && arriba[arriba.length - 1].tipo !== 'acotacion') return { arriba, abajo };
    }
  }
  return null;
}

function recortarInicio(segs: Segmento[]): Segmento[] {
  const out = segs.map((s) => ({ ...s }));
  while (out.length && out[0].t.trimStart() === '') out.shift();
  if (out.length) out[0].t = out[0].t.trimStart();
  return out;
}

function continuacion(b: Bloque, cfg: Config): string {
  const p = b.personaje!;
  const extensiones = cfg.conservarExtension && p.extension ? p.extension.split(') (').filter((e) => !/^CONT/i.test(e.trim())) : [];
  return [p.nombre, ...extensiones.map((e) => `(${e})`), cfg.textoContinua].join(' ');
}

const lineaSuelta = (tipo: Linea['tipo'], texto: string, escena: number): Linea => ({
  tipo,
  columna: COLUMNAS.personaje.columna,
  segs: [{ t: texto }],
  escena,
});

interface Colocado {
  bloque: Bloque;
  /** Índice de la página donde empieza su espacio antes. */
  desde: number;
}

export function paginar(bloques: Bloque[], cfg: Config): Pagina[] {
  const R = cfg.renglonesPorPagina;
  const paginas: Pagina[] = [];
  let actual: Linea[] = [];
  let colocados: Colocado[] = [];
  const cola = [...bloques];

  const cerrar = () => {
    if (actual.length) paginas.push({ lineas: actual });
    actual = [];
    colocados = [];
  };
  const espacioDe = (b: Bloque) => (actual.length ? b.espacioAntes : 0);
  const poner = (b: Bloque, lineas: Linea[]) => {
    const desde = actual.length;
    const escenaBlanco = actual.length ? actual[actual.length - 1].escena : b.escena;
    for (let k = 0; k < espacioDe(b); k++) actual.push({ tipo: 'blanco', columna: 0, segs: [], escena: escenaBlanco });
    actual.push(...lineas);
    colocados.push({ bloque: b, desde });
  };
  /**
   * Lo que necesita un encabezado o plano después de sí: los encabezados y planos que le siguen enteros,
   * y el espacio y 2 líneas del primer bloque que no lo sea.
   */
  const necesitaDespues = (i: number) => {
    let total = 0;
    for (let k = i; k < cola.length; k++) {
      const sig = cola[k];
      if (sig.tipo === 'salto') return total;
      if (!ATADOS.has(sig.tipo)) return total + sig.espacioAntes + Math.min(2, sig.lineas.length);
      total += sig.espacioAntes + sig.lineas.length;
    }
    return total;
  };

  /** Coloca lo que quepa a la fuerza, en límite de línea, para avanzar cuando no hay corte válido ni adónde mover. */
  const forzar = (b: Bloque) => {
    const libres = R - actual.length - espacioDe(b);
    const esDialogo = b.tipo === 'dialogo';
    const caben = Math.max(1, esDialogo ? libres - 1 : libres);
    if (b.lineas.length <= libres) {
      poner(b, b.lineas);
      return;
    }
    const arriba = b.lineas.slice(0, caben);
    const abajo = b.lineas.slice(caben);
    poner(b, esDialogo ? [...arriba, lineaSuelta('mas', cfg.textoMas, b.escena)] : arriba);
    cerrar();
    cola.unshift(resto(b, abajo));
  };
  const resto = (b: Bloque, abajo: Linea[]): Bloque =>
    b.tipo === 'dialogo'
      ? { ...b, espacioAntes: 0, lineas: [lineaSuelta('continua', continuacion(b, cfg), b.escena), ...abajo] }
      : { ...b, espacioAntes: 0, lineas: abajo };

  while (cola.length) {
    const b = cola.shift()!;
    if (b.tipo === 'salto') {
      cerrar();
      continue;
    }
    const libres = R - actual.length - espacioDe(b);
    const alto = b.lineas.length;
    const atado = ATADOS.has(b.tipo);

    if (alto <= libres && (!atado || !actual.length || alto + necesitaDespues(0) <= libres)) {
      poner(b, b.lineas);
      continue;
    }
    if (!actual.length && alto <= R) {
      // Página vacía: cabe entero aunque no quepa lo que sigue.
      poner(b, b.lineas);
      continue;
    }

    if (b.tipo === 'dialogo' || b.tipo === 'accion') {
      const esDialogo = b.tipo === 'dialogo';
      const corte = buscarCorte(b.lineas, esDialogo ? libres - 1 : libres);
      if (corte) {
        poner(b, esDialogo ? [...corte.arriba, lineaSuelta('mas', cfg.textoMas, b.escena)] : corte.arriba);
        cerrar();
        cola.unshift(resto(b, corte.abajo));
        continue;
      }
    }

    if (!actual.length) {
      forzar(b);
      continue;
    }
    // Se mueve completo y arrastra los encabezados y planos que lo preceden en esta página.
    let k = colocados.length;
    while (k > 0 && ATADOS.has(colocados[k - 1].bloque.tipo)) k--;
    if (k === 0) {
      // En la página solo está su cadena: moverla dejaría la página vacía.
      if (atado && alto <= libres) poner(b, b.lineas);
      else if (atado) {
        cerrar();
        cola.unshift(b);
      } else forzar(b);
      continue;
    }
    const arrastrados = colocados.slice(k).map((c) => c.bloque);
    actual = actual.slice(0, colocados[k]?.desde ?? actual.length);
    colocados = colocados.slice(0, k);
    cerrar();
    cola.unshift(...arrastrados, b);
  }
  cerrar();
  return paginas;
}

/** Dónde empieza cada página desde la 2 en el texto fuente: la línea del primer renglón que sale de él. */
export function iniciosDePagina(paginas: Pagina[]): { pagina: number; linea: number }[] {
  const out: { pagina: number; linea: number }[] = [];
  paginas.forEach((p, k) => {
    if (k === 0) return;
    const l = p.lineas.find((x) => x.fuente !== undefined && x.tipo !== 'blanco');
    if (l?.fuente !== undefined) out.push({ pagina: k + 1, linea: l.fuente });
  });
  return out;
}
