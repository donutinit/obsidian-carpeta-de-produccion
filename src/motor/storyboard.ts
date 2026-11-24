import type { Cambio } from './escenas';
import { cabezaDeTabla, COL_ESCENA, filasDeTabla } from './plan';
import { escribirTecnica, leerTecnica, ponerValor, type ListasTecnicas } from './selectores';
import { celdaDeTabla, escribirCelda, iniciosDeTabla } from './tablas';

/** Un plano del guion técnico como viñeta del storyboard. Los datos viven en el guion técnico. */
export interface Vineta {
  /** «E1 · P1». */
  id: string;
  escena: string;
  numero: string;
  plano: string;
  lente: string;
  angulo: string;
  movimiento: string;
  accion: string;
  dialogo: string;
  sonido: string;
}

export type CampoVineta = 'plano' | 'lente' | 'angulo' | 'movimiento' | 'accion' | 'dialogo' | 'sonido';

export const idVineta = (escena: string, numero: string) => `E${escena.trim()} · P${numero.trim()}`;

/** «E1 · P1», «E12A·P3», «E1 · P1.1» o «e1 p2». Escena y plano empiezan con número: «Equipo» no es una viñeta. */
export function leerId(s: string): { escena: string; numero: string } | null {
  const m = /^\s*E\s*(\d[\p{L}\p{N}.-]*?)\s*(?:·|\s)\s*P\s*(\d[\p{L}\p{N}.-]*)\s*$/iu.exec(s);
  return m ? { escena: m[1].toUpperCase(), numero: m[2].toUpperCase() } : null;
}

/** El número de escena o de plano como va en la viñeta: sin formato ni espacios («**3**» → 3, «2 bis» → 2BIS). */
const parteId = (s: string) => s.replace(/[*_`]/g, '').replace(/\s+/g, '').toUpperCase();

const vacia = (t: string) => !t.trim() || /^[—-]$/.test(t.trim());
/** El texto de una celda, con la barra escapada de la tabla ya limpia; «—» es vacío. */
const dato = (t: string | undefined) => (t === undefined || vacia(t) ? '' : t.trim().replace(/\\\|/g, '|'));

/** Las columnas del guion técnico que usa el storyboard; -1 si la tabla no la tiene. */
function columnas(h: string[]) {
  const col = (re: RegExp) => h.findIndex((x) => re.test(x));
  return {
    escena: col(COL_ESCENA),
    numero: col(/^((n|no|num|numero) ?(de )?)(plano|toma)$/),
    plano: col(/^(tipo de )?plano$/),
    tecnica: col(/^descripcion tecnica$/),
    lente: col(/^(lente|lentes|optica)$/),
    angulo: col(/^angulo( de camara)?$/),
    movimiento: col(/^(mov|movimiento)( de camara)?$/),
    accion: col(/^(acciones|accion|descripcion)$/),
    dialogo: col(/^dialogos?$/),
    sonido: col(/^sonido$/),
  };
}

interface Fila {
  vineta: Vineta;
  linea: number;
  fila: number;
  c: ReturnType<typeof columnas>;
}

/** Las filas de plano del guion técnico: tablas con escena y número de plano (o plano). Sin número, el orden en su escena. */
function filasDePlano(fuente: string, listas: ListasTecnicas): Fila[] {
  const out: Fila[] = [];
  for (const L of iniciosDeTabla(fuente)) {
    const h = cabezaDeTabla(fuente, L);
    const c = columnas(h);
    if (c.escena < 0 || (c.numero < 0 && c.plano < 0)) continue;
    filasDeTabla(fuente, L, h.length).forEach((f, k) => {
      const escena = parteId(dato(f[c.escena]));
      if (!escena) return;
      const numero = parteId(dato(f[c.numero])) || String(out.filter((x) => x.vineta.escena === escena).length + 1);
      const id = idVineta(escena, numero);
      if (out.some((x) => x.vineta.id === id)) return;
      const t = c.tecnica >= 0 ? leerTecnica(f[c.tecnica] ?? '', listas) : { resto: [] };
      out.push({
        linea: L,
        fila: k,
        c,
        vineta: {
          id,
          escena,
          numero,
          plano: dato(f[c.plano]),
          lente: dato(f[c.lente]) || (t.lente ?? ''),
          angulo: dato(f[c.angulo]) || (t.angulo ?? ''),
          movimiento: dato(f[c.movimiento]) || (t.movimiento ?? ''),
          accion: dato(f[c.accion]),
          dialogo: dato(f[c.dialogo]),
          sonido: dato(f[c.sonido]),
        },
      });
    });
  }
  return out;
}

/** Los planos del guion técnico como viñetas, en su orden. */
export function vinetasDeTecnico(fuente: string, listas: ListasTecnicas): Vineta[] {
  return filasDePlano(fuente, listas).map((f) => f.vineta);
}

/**
 * Escribe un dato de la viñeta en su fila del guion técnico, que se busca de nuevo por su número. Lente, ángulo y
 * movimiento van a su columna si la hay; si no, a la descripción técnica. Sin columna donde escribirlo, nada.
 */
export function cambiarVineta(fuente: string, id: string, campo: CampoVineta, valor: string, listas: ListasTecnicas): Cambio[] {
  const clave = leerId(id);
  const f = clave ? filasDePlano(fuente, listas).find((x) => x.vineta.id === idVineta(clave.escena, clave.numero)) : undefined;
  if (!f) return [];
  // En una celda no caben saltos ni barras sin escapar.
  const limpio = valor.replace(/\s*\n\s*/g, ' ').replace(/(?<!\\)\|/g, '\\|').trim();
  const celda = (k: number) => (k >= 0 ? celdaDeTabla(fuente, f.linea, f.fila, k) : null);
  const propia = celda(f.c[campo]);
  const lista = campo === 'lente' ? listas.lentes : campo === 'angulo' ? listas.angulos : campo === 'movimiento' ? listas.movimientos : null;
  if (propia && lista) {
    // En su propia columna se cambia el valor conocido y se conserva lo demás («paneo lento siguiendo a Ana»).
    const nuevo = ponerValor(propia.texto, limpio, lista, campo === 'lente' ? /\d+(?:[.,]\d+)?\s*mm/ : undefined).replace(/^\s*·\s*|\s*·\s*$/g, '');
    return [escribirCelda(propia, nuevo.trim() || '—')];
  }
  if (propia) return [escribirCelda(propia, limpio || '—')];
  if (campo !== 'lente' && campo !== 'angulo' && campo !== 'movimiento') return [];
  const tec = celda(f.c.tecnica);
  if (!tec) return [];
  const t = leerTecnica(tec.texto, listas);
  t[campo] = limpio || undefined;
  return [escribirCelda(tec, escribirTecnica(t))];
}

// ---------- La nota del storyboard ----------

/** «## Escena 3», «## Escena 01» o «## Escena 2: Casa de María». */
const ESCENA_H = /^##\s+Escena\s+([^\s:.,;–—-]+)(.*)$/i;
const ID_H = /^###\s+(.+?)\s*$/;
const HUERFANAS = '## Planos que ya no están en el guion técnico';
const PISTA = /^%%\s*Viñeta:.*%%$/;
/** «01» y «1» son la misma escena. */
const claveEscena = (s: string) => parteId(s).replace(/^0+(?=\d)/, '');

const recortar = (ls: string[]) => {
  let a = 0;
  let b = ls.length;
  while (a < b && !ls[a].trim()) a++;
  while (b > a && !ls[b - 1].trim()) b--;
  return ls.slice(a, b);
};

interface Nota {
  antes: string[];
  /** Por viñeta, lo que hay bajo su encabezado. */
  secciones: Map<string, string[]>;
  orden: string[];
  /** Por escena, lo que hay bajo «## Escena N» antes de su primera viñeta, y su encabezado si lleva título. */
  intros: Map<string, string[]>;
  titulos: Map<string, string>;
  /** Lo suelto bajo «Planos que ya no están» antes de su primera viñeta. */
  sueltasHuerfanas: string[];
  /** Otros apartados («## Notas») con su contenido, en su orden. */
  otros: string[][];
}

/** Parte la nota: lo de antes de las escenas, las secciones de viñeta, lo de cada escena y los demás apartados. */
function leerNota(nota: string): Nota {
  const lineas = nota.replace(/\n+$/, '').split('\n');
  const esId = (l: string) => {
    const m = ID_H.exec(l);
    return m ? leerId(m[1]) : null;
  };
  let ini = lineas.findIndex((l) => ESCENA_H.test(l) || !!esId(l) || l.trim() === HUERFANAS);
  if (ini < 0) ini = lineas.length;
  const n: Nota = { antes: lineas.slice(0, ini), secciones: new Map(), orden: [], intros: new Map(), titulos: new Map(), sueltasHuerfanas: [], otros: [] };
  let destino: string[] = [];
  for (const l of lineas.slice(ini)) {
    const e = ESCENA_H.exec(l);
    const id = esId(l);
    if (e) {
      const k = claveEscena(e[1]);
      if (!n.intros.has(k)) n.intros.set(k, []);
      if (e[2].trim() && !n.titulos.has(k)) n.titulos.set(k, l.trim());
      destino = n.intros.get(k)!;
    } else if (l.trim() === HUERFANAS) destino = n.sueltasHuerfanas;
    else if (id) {
      const k = idVineta(id.escena, id.numero);
      if (!n.secciones.has(k)) {
        n.secciones.set(k, []);
        n.orden.push(k);
      }
      destino = n.secciones.get(k)!;
    } else if (/^#{1,2}\s/.test(l)) {
      // Otro apartado («## Notas»): va con su contenido, sin partir el storyboard.
      destino = [l];
      n.otros.push(destino);
    } else destino.push(l);
  }
  return n;
}

const esTabla = (l: string) => l.trim().startsWith('|');
const celdasDe = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim());

/** Las tablas de datos de viñeta de una sección: si están vacías (la plantilla) o tienen algo escrito a mano. */
function tablasDeSeccion(cuerpo: string[]): { vacias: [number, number][]; conDatos: boolean } {
  const vacias: [number, number][] = [];
  let conDatos = false;
  for (let i = 0; i < cuerpo.length; i++) {
    if (!esTabla(cuerpo[i])) continue;
    let j = i;
    while (j + 1 < cuerpo.length && esTabla(cuerpo[j + 1])) j++;
    const cabeza = celdasDe(cuerpo[i]).map((x) => x.toLowerCase());
    if (cabeza.includes('plano')) {
      const datos = cuerpo.slice(i + 2, j + 1).flatMap(celdasDe);
      if (datos.every(vacia)) vacias.push([i, j]);
      else conDatos = true;
    }
    i = j;
  }
  return { vacias, conDatos };
}

/** Lo de la sección que no es de la plantilla ni del plugin: sin pistas, tablas vacías ni el bloque de su viñeta. */
function propio(cuerpo: string[], id: string): string[] {
  const { vacias } = tablasDeSeccion(cuerpo);
  const sinPlantilla = cuerpo.filter((l, i) => !PISTA.test(l.trim()) && !vacias.some(([a, b]) => i >= a && i <= b));
  const soloBloque = recortar(sinPlantilla).join('\n') === ['```carpeta-vineta', id, '```'].join('\n');
  return soloBloque ? [] : recortar(sinPlantilla);
}

const tieneBloque = (cuerpo: string[]) => cuerpo.some((l) => l.trim() === '```carpeta-vineta');
const tieneDibujo = (cuerpo: string[]) => cuerpo.some((l) => /!\[\[[^\]]+\]\]/.test(l) && !PISTA.test(l.trim()));

export interface ResultadoStoryboard {
  texto: string;
  /** Viñetas que recibieron su bloque en esta pasada. */
  nuevas: number;
  /** Secciones con su tabla escrita a mano: se dejan así. */
  aMano: number;
  /** Secciones de planos que ya no están en el guion técnico. */
  huerfanas: number;
}

/**
 * Arma el storyboard con los planos del guion técnico: una sección «### E1 · P1» por plano, en su orden y bajo su
 * escena, con el bloque que muestra sus datos. Conserva los dibujos y lo escrito; quita las tablas vacías y las pistas
 * de la plantilla. Los planos que ya no están van al final, con sus dibujos. Armarlo dos veces da lo mismo.
 */
export function armarStoryboard(nota: string, vinetas: Vineta[]): ResultadoStoryboard {
  const n = leerNota(nota);
  const out = recortar(n.antes);
  if (!nota.includes('```carpeta-storyboard')) out.push(...(out.length ? [''] : []), '```carpeta-storyboard', '```');
  out.push('');
  let nuevas = 0;
  let aMano = 0;
  const escenas = [...new Set(vinetas.map((v) => v.escena))];
  for (const e of escenas) {
    out.push(n.titulos.get(claveEscena(e)) ?? `## Escena ${e}`, '');
    const intro = recortar(n.intros.get(claveEscena(e)) ?? []);
    if (intro.length) out.push(...intro, '');
    for (const v of vinetas.filter((x) => x.escena === e)) {
      let cuerpo = (n.secciones.get(v.id) ?? []).filter((l) => !PISTA.test(l.trim()));
      const { vacias, conDatos } = tablasDeSeccion(cuerpo);
      cuerpo = cuerpo.filter((_, i) => !vacias.some(([a, b]) => i >= a && i <= b));
      cuerpo = recortar(cuerpo.filter((l, i, a) => l.trim() || (i > 0 && a[i - 1].trim())));
      if (conDatos) aMano++;
      else if (!tieneBloque(cuerpo)) {
        cuerpo.push(...(cuerpo.length ? [''] : []), '```carpeta-vineta', v.id, '```');
        nuevas++;
      }
      out.push(`### ${v.id}`, '', ...cuerpo, '');
    }
  }
  const ids = new Set(vinetas.map((v) => v.id));
  const claves = new Set(escenas.map(claveEscena));
  // De un plano que ya no está se guarda solo lo que alguien hizo: dibujos, notas, una tabla llena. La plantilla y su
  // bloque no.
  const huerfanas = n.orden
    .filter((k) => !ids.has(k))
    .map((k) => ({ k, cuerpo: propio(n.secciones.get(k) ?? [], k) }))
    .filter((x) => x.cuerpo.length);
  // Lo escrito bajo una escena que ya no está tampoco se pierde: va con los planos que ya no están.
  const notas = [...n.intros.entries()]
    .filter(([k, intro]) => !claves.has(k) && recortar(intro).length)
    .flatMap(([k, intro]) => [`#### Notas de la escena ${k}`, '', ...recortar(intro), '']);
  const sueltas = recortar(n.sueltasHuerfanas);
  if (huerfanas.length || notas.length || sueltas.length) {
    out.push(HUERFANAS, '');
    if (sueltas.length) out.push(...sueltas, '');
    out.push(...notas);
    for (const { k, cuerpo } of huerfanas) out.push(`### ${k}`, '', ...cuerpo, '');
  }
  for (const otro of n.otros) {
    const [cabeza, ...resto] = otro;
    const cuerpo = recortar(resto);
    out.push(cabeza, '', ...cuerpo, ...(cuerpo.length ? [''] : []));
  }
  return { texto: out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '\n'), nuevas, aMano, huerfanas: huerfanas.length };
}

/** Cuántos planos hay, cuántos tienen su sección armada y su dibujo, cuántos faltan y cuántas secciones sobran. */
export function estadoStoryboard(nota: string, vinetas: Vineta[]): { planos: number; armadas: number; conDibujo: number; faltan: number; huerfanas: number } {
  const n = leerNota(nota);
  const cuerpos = vinetas.map((v) => n.secciones.get(v.id));
  return {
    planos: vinetas.length,
    armadas: cuerpos.filter((c) => c && (tieneBloque(c) || tablasDeSeccion(c).conDatos)).length,
    conDibujo: cuerpos.filter((c) => c && tieneDibujo(c)).length,
    faltan: cuerpos.filter((c) => !c).length,
    huerfanas: n.orden.filter((k) => !vinetas.some((v) => v.id === k) && propio(n.secciones.get(k) ?? [], k).length).length,
  };
}

/** ¿La sección de la viñeta ya tiene un dibujo pegado? */
export function vinetaConDibujo(nota: string, id: string): boolean {
  const c = leerId(id);
  const cuerpo = c ? leerNota(nota).secciones.get(idVineta(c.escena, c.numero)) : undefined;
  return !!cuerpo && tieneDibujo(cuerpo);
}

/** Pega `![[enlace]]` justo arriba del bloque de la viñeta. */
export function insertarDibujo(nota: string, id: string, enlace: string): Cambio[] {
  const lineas = nota.split('\n');
  for (let i = 0; i + 1 < lineas.length; i++) {
    if (lineas[i].trim() !== '```carpeta-vineta') continue;
    const c = leerId(lineas[i + 1]);
    const buscado = leerId(id);
    if (!c || !buscado || c.escena !== buscado.escena || c.numero !== buscado.numero) continue;
    const pos = lineas.slice(0, i).reduce((s, l) => s + l.length + 1, 0);
    return [{ desde: pos, hasta: pos, texto: `![[${enlace}]]\n\n` }];
  }
  return [];
}
