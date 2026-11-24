import type { Guion } from './index';
import { GENERICOS, nombrePropio, presentaciones } from './breakdown';
import type { Cambio } from './escenas';
import { cabezaDeTabla, filasDeTabla } from './plan';
import { celdaDeTabla, escribirCelda } from './tablas';
import { analizarEnLinea, textoPlano } from './enlinea';
import { formatearOctavos } from './octavos';
import type { Documento } from './tipos';

const plano = (t: string) => textoPlano(analizarEnLinea(t.replace(/\n/g, ' '))).trim();
const corto = (t: string, largo = 90) => (t.length > largo ? t.slice(0, largo - 1).trimEnd() + '…' : t);
const mismo = (a: string, b: string) => a.toLocaleLowerCase('es') === b.toLocaleLowerCase('es');
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** El mismo nombre sin importar mayúsculas ni acentos: «María» y «MARIA». */
const igual = (a: string, b: string) => mismo(sinAcentos(a), sinAcentos(b));

/**
 * Los personajes del guion: el reparto de cada escena en orden y, además, quien solo habla fuera de cuadro
 * (un narrador en V.O.), que el reparto deja fuera. Sin los genéricos como TODOS.
 */
export function personajesDelGuion(g: Guion): string[] {
  const out: string[] = [];
  const agregar = (n: string) => {
    // Los del reparto ya vienen escritos como nombre («Piloto y Copiloto»); los que hablan, en mayúsculas.
    if (n && !GENERICOS.has(n.toLocaleUpperCase('es')) && !out.some((x) => igual(x, n))) out.push(n === n.toLocaleUpperCase('es') ? nombrePropio(n) : n);
  };
  g.breakdown.forEach((b) => b.reparto.forEach(agregar));
  for (const e of g.doc.elementos) if (e.tipo === 'personaje' && e.nombre) agregar(e.nombre);
  return out;
}

// ---------- Parlamentos y beats ----------

/** El número de cada parlamento, contado por escena, en la línea del nombre de quien habla. */
export function numerosDeParlamento(doc: Documento): { linea: number; escena: number; numero: number }[] {
  const out: { linea: number; escena: number; numero: number }[] = [];
  const cuenta = new Map<number, number>();
  for (const e of doc.elementos) {
    if (e.tipo !== 'personaje') continue;
    const n = (cuenta.get(e.escena) ?? 0) + 1;
    cuenta.set(e.escena, n);
    out.push({ linea: e.linea, escena: e.escena, numero: n });
  }
  return out;
}

export interface Beat {
  /** El número de parlamento; `null` en las acciones. */
  numero: number | null;
  beat: string;
  /** Quien habla, en los parlamentos. */
  quien: string;
}

/** La hoja de beats de la clase para una escena: cada acción y cada parlamento, en orden. Tema y Quién los llena quien dirige. */
export function beatsDeEscena(g: Guion, k: number): Beat[] {
  const out: Beat[] = [];
  let numero = 0;
  let hablante = '';
  for (const e of g.doc.elementos) {
    if (e.escena !== k) continue;
    if (e.tipo === 'accion') out.push({ numero: null, beat: corto(plano(e.texto)), quien: '' });
    else if (e.tipo === 'personaje') {
      numero++;
      hablante = nombrePropio(e.nombre ?? e.texto);
    } else if (e.tipo === 'dialogo' || e.tipo === 'letra') {
      const previo = out[out.length - 1];
      // Un parlamento partido por una acotación sigue siendo el mismo.
      // Lo cantado lleva ♪, para que se distinga en la hoja.
      const texto = (e.tipo === 'letra' ? '♪ ' : '') + plano(e.texto);
      if (previo && previo.numero === numero) previo.beat = corto(`${previo.beat} ${texto}`);
      else out.push({ numero, beat: corto(`${hablante}: ${texto}`), quien: hablante });
    }
  }
  return out;
}

// ---------- Personajes ----------

/** Una ficha de personaje: la de diseño de personaje (vida interior y exterior), la de dirección de actores y el casting. */
export function fichaPersonaje(nombre: string): string {
  const n = nombrePropio(nombre);
  const lista = (items: string[]) => items.map((x, i) => `${i + 1}. ${x}\n> `).join('\n');
  return `---
carpeta: personaje
personaje: ${JSON.stringify(nombre.toUpperCase())}
actor:
edad:
---

# ${n}

## Identificación

| Dato | Valor |
|---|---|
| Nombre completo | — |
| Edad | — |
| Actor o actriz | — |

## Foto del personaje

## Vida interior

${lista(['Género', 'Nacionalidad', 'Clase social', 'Antecedentes familiares', 'Formación académica', 'Habilidades', 'Propia familia', 'Sexualidad', 'Historia de fondo'])}

## Vida exterior

${lista(['Edad', 'Ocupación', 'Amigos y enemigos', 'Apariencia', 'Visión del mundo', 'Valores y antivalores', 'Manera de ser', 'Pasatiempos y pasiones', 'Meta', 'Temores', 'Noluntad'])}

## Biografía

## Hechos, preguntas e imágenes

### Hechos

- 

### Preguntas

| Pregunta | Respuesta |
|---|---|
| — | — |

### Imágenes

| Sentido | ${n} |
|---|---|
| Vista | — |
| Oído | — |
| Olfato | — |
| Gusto | — |
| Tacto | — |

## Análisis de escena

${['Ideas / primeras impresiones', 'Evidencia para tus ideas', 'Paráfrasis', 'Líneas misteriosas', 'Tres posibles significados', '¿Qué acaba de pasar?', 'Objetivo', 'Problema / obstáculo / lo que está en juego', 'Vida física', 'Verbos de acción', 'Ajustes'].map((x, i) => `### ${i + 1}) ${x}\n`).join('\n')}
## Casting

| Candidato | Naturalidad | Credibilidad | Dicción | Maleabilidad | Presencia | Total |
|---|---:|---:|---:|---:|---:|---:|
| — | | | | | | |

## Sus escenas

\`\`\`carpeta-personaje
\`\`\`
`;
}

export interface EscenaDePersonaje {
  escena: string;
  encabezado: string;
  octavos: string;
  parlamentos: number;
}

/** Las escenas donde está el personaje (su reparto), con cuántos parlamentos tiene en cada una. */
export function escenasDePersonaje(g: Guion, nombre: string): EscenaDePersonaje[] {
  return g.doc.escenas.flatMap((e, k) => {
    const parlamentos = g.doc.elementos.filter((x) => x.escena === k && x.tipo === 'personaje' && igual(x.nombre ?? '', nombre)).length;
    // Está en la escena si es del reparto o si habla en ella (aunque sea fuera de cuadro).
    if (!parlamentos && !(g.breakdown[k]?.reparto ?? []).some((r) => igual(r, nombre))) return [];
    return [{ escena: e.numero, encabezado: e.encabezado, octavos: formatearOctavos(g.octavos.porEscena[k] ?? 0), parlamentos }];
  });
}

// ---------- Departamentos ----------

export interface CambioVestuario {
  codigo: string;
  nombre: string;
  categoria: string;
  escenas: string[];
}

/**
 * Vestuario y maquillaje por personaje. La marca dice de quién es con el nombre «Personaje: prenda»
 * (`{vest:traje|Antonio: Traje gris}`). Cada prenda distinta es un cambio, con código por inicial: A1, A2, J1.
 */
export function vestuarioPorPersonaje(g: Guion): { personaje: string; cambios: CambioVestuario[] }[] {
  const out: { personaje: string; cambios: CambioVestuario[] }[] = [];
  const conocidos = personajesDelGuion(g);
  g.doc.escenas.forEach((e, k) => {
    for (const categoria of ['vest', 'maq']) {
      for (const x of g.breakdown[k]?.elementos[categoria] ?? []) {
        const m = /^([^:]{1,40}):\s*(.+)$/.exec(x.nombre);
        // Solo cuenta si lo de antes de los dos puntos es un personaje del guion («Reloj: dorado» no lo es).
        const personaje = m ? conocidos.find((c) => igual(c, m[1].trim())) : undefined;
        if (!m || !personaje) continue;
        let p = out.find((y) => mismo(y.personaje, personaje));
        if (!p) out.push((p = { personaje, cambios: [] }));
        let c = p.cambios.find((y) => mismo(y.nombre, m[2].trim()) && y.categoria === categoria);
        if (!c) p.cambios.push((c = { codigo: '', nombre: m[2].trim(), categoria, escenas: [] }));
        if (!c.escenas.includes(e.numero)) c.escenas.push(e.numero);
      }
    }
  });
  // Códigos: la inicial; si ya está tomada, la inicial con el número del nombre (Hombre 2 → H2), y luego más letras.
  const usados = new Set<string>();
  for (const p of out) {
    const base = sinAcentos(p.personaje).toUpperCase();
    const letras = base.replace(/[^A-Z]/g, '') || 'X';
    const numero = /\d+/.exec(base)?.[0] ?? '';
    const candidatos = [letras.slice(0, 1), numero && letras.slice(0, 1) + numero, ...Array.from({ length: letras.length - 1 }, (_, i) => letras.slice(0, i + 2))].filter(Boolean);
    let pre = candidatos.find((c) => !usados.has(c)) ?? letras;
    while (usados.has(pre)) pre += 'X';
    usados.add(pre);
    // Si el prefijo termina en número, un guion separa el número del cambio: H2-1.
    p.cambios.forEach((c, i) => (c.codigo = `${pre}${/\d$/.test(pre) ? '-' : ''}${i + 1}`));
  }
  return out;
}

/** El mapa de cues: cada elemento de música y sonido, en orden, con su número M1, M2… */
export function cuesMusicales(g: Guion): { cue: string; escena: string; nombre: string }[] {
  const out: { cue: string; escena: string; nombre: string }[] = [];
  g.doc.escenas.forEach((e, k) => {
    for (const x of g.breakdown[k]?.elementos.mus ?? []) out.push({ cue: `M${out.length + 1}`, escena: e.numero, nombre: x.nombre });
  });
  return out;
}

// ---------- Créditos ----------

/**
 * Los créditos: el equipo agrupado por puesto (líneas «Nombre · Matrícula · Puesto» de la ficha del proyecto) y el
 * reparto con su actor. Las líneas de ejemplo de la plantilla («Nombre · Matrícula · Rol») no cuentan.
 */
export function creditos(equipo: string[], reparto: { personaje: string; actor: string }[]): { equipo: { puesto: string; nombres: string[] }[]; reparto: { personaje: string; actor: string }[] } {
  const grupos: { puesto: string; nombres: string[] }[] = [];
  for (const linea of equipo) {
    // «·» separa con o sin espacios; la raya, solo con espacios. El guion corto no: es de apellidos («Pérez - García»).
    const partes = linea
      .split(/\s*·\s*|\s+[—–]\s+/)
      .map((x) => x.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (partes.length < 2) continue;
    const nombre = partes[0];
    const ultimo = partes[partes.length - 1];
    // Si lo último es un número (la matrícula), no hay puesto.
    const puesto = /^\d+$/.test(ultimo) ? 'Equipo' : ultimo;
    if (/^nombre$/i.test(nombre) || /^rol$/i.test(puesto)) continue;
    const g = grupos.find((x) => mismo(x.puesto, puesto));
    if (g) g.nombres.push(nombre);
    else grupos.push({ puesto, nombres: [nombre] });
  }
  return { equipo: grupos, reparto: reparto.filter((r) => r.actor.trim()) };
}

// ---------- Serie ----------

/** La propuesta de una serie: las partes de la presentación de una propuesta televisiva. */
export function propuestaSerie(titulo: string): string {
  return `---
carpeta: serie
titulo: ${JSON.stringify(titulo)}
---

# ${titulo}

## Datos de la serie

| Dato | Valor |
|---|---|
| Género | — |
| Formato | — |
| Episodios | — |
| Duración por episodio | — |
| Público | — |

## Argumento

## Arco de la temporada

| Episodio | Qué pasa | Acto |
|---:|---|---|
| 1 | — | 1 · disparador |

## Personajes

| Personaje | Descripción |
|---|---|
| — | — |

## Episodios

**Episodio 1 · Título**

### Apertura en frío

### Acto 1

### Acto 2

### Acto 3

### Remate

## Esencia de la serie

## Propuesta de intro

| Dato | Valor |
|---|---|
| Duración | — |
| Música | — |
| Qué se ve | — |
| Cómo aparece el título | — |
`;
}

/** El guion de un episodio de la serie. */
export function guionEpisodio(serie: string, n: number): string {
  return `---
carpeta: guion
proyecto: ${JSON.stringify(serie)}
episodio: ${n}
---
Title: ${serie} · Episodio ${n}
Credit: Guion de
Author:
Draft date:

INT. LUGAR - DÍA

Escribe aquí la primera acción.
`;
}

// ---------- Propuesta de talento ----------

/** «1, 3, 4, 5, 6, 9, 10» → «1, 3–6, 9, 10»: tres o más escenas seguidas se juntan. */
export function rangosDeEscenas(numeros: string[]): string {
  const out: string[] = [];
  const entero = (s: string) => /^\d+$/.test(s);
  for (let i = 0; i < numeros.length; ) {
    let j = i;
    if (entero(numeros[i])) while (j + 1 < numeros.length && entero(numeros[j + 1]) && Number(numeros[j + 1]) === Number(numeros[j]) + 1) j++;
    if (j - i >= 2) out.push(`${numeros[i]}–${numeros[j]}`);
    else out.push(...numeros.slice(i, j + 1));
    i = j + 1;
  }
  return out.join(', ');
}

export interface OpcionPersonaje {
  nombre: string;
  /** La del guion («AURELIO (78)»); si no la trae, la de su ficha; si no, vacía. */
  edad: string;
  /** Sus escenas, en rangos. */
  escenas: string;
}

/**
 * Los personajes para la propuesta de talento, con su edad y sus escenas. Primero los de `orden` (orden_reparto),
 * luego los demás en orden de aparición. `edades` son las de las fichas, por nombre.
 */
export function opcionesDePersonaje(g: Guion, o: { edades?: Record<string, string>; orden?: string[] } = {}): OpcionPersonaje[] {
  const nombres = personajesDelGuion(g);
  const orden = (o.orden ?? []).map((x) => nombres.find((n) => igual(n, x))).filter((x): x is string => !!x);
  const resto = nombres.filter((n) => !orden.some((x) => igual(x, n)));
  const presentados = presentaciones(g.doc);
  const deFicha = Object.entries(o.edades ?? {});
  return [...orden, ...resto].map((nombre) => ({
    nombre,
    edad: presentados.find((p) => igual(p.nombre, nombre))?.edad ?? deFicha.find(([k]) => igual(k, nombre))?.[1]?.trim() ?? '',
    escenas: rangosDeEscenas(escenasDePersonaje(g, nombre).map((e) => e.escena)),
  }));
}

const encabezado = (s: string) =>
  s
    .replace(/[*_`~.]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const celdaVacia = (t: string) => !t.trim() || /^[—-]$/.test(t.trim());
/** Lo que se lee de una celda: «[[María]]», «[[María|Mari]]» o «**María**» son María. */
const visible = (t: string) =>
  t
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, a: string, b?: string) => b ?? a)
    .replace(/[*_`]/g, '')
    .trim();
/** Lo que se llena solo al elegir un personaje, según la columna (o la fila, en un «Dato | Valor»). */
const derivado = (h: string, o: OpcionPersonaje) => (h === 'edad del personaje' ? o.edad : h === 'escenas' ? o.escenas : '');

/** Al elegir el personaje `o` en una celda: su nombre ahí y, en la misma fila (o tabla «Dato | Valor»), su edad y sus escenas. */
export function rellenoDePersonaje(fuente: string, linea: number, fila: number, columna: number, o: OpcionPersonaje): Cambio[] {
  const propia = celdaDeTabla(fuente, linea, fila, columna);
  if (!propia) return [];
  const cambios: Cambio[] = [escribirCelda(propia, o.nombre)];
  // Con otro personaje, lo que no se sabe de él queda en «—»: no se hereda la edad del anterior.
  const otro = !igual(visible(propia.texto), o.nombre);
  const valorDe = (h: string) => derivado(h, o) || (otro && (h === 'edad del personaje' || h === 'escenas') ? '—' : '');
  if (propia.columnas === 2 && propia.columna === 1 && encabezado(propia.etiqueta) === 'personaje') {
    for (let f = 0; ; f++) {
      const et = celdaDeTabla(fuente, linea, f, 0);
      if (!et) break;
      const valor = f === fila ? '' : valorDe(encabezado(et.texto));
      const c = valor ? celdaDeTabla(fuente, linea, f, 1) : null;
      if (c) cambios.push(escribirCelda(c, valor));
    }
  } else {
    for (let k = 0; k < propia.columnas; k++) {
      const c = k === columna ? null : celdaDeTabla(fuente, linea, fila, k);
      const valor = c ? valorDe(encabezado(c.encabezado)) : '';
      // El mismo personaje sin edad conocida conserva la que ya tenía.
      if (c && valor) cambios.push(escribirCelda(c, valor));
    }
  }
  return cambios.sort((a, b) => a.desde - b.desde);
}

/**
 * «Llenar toda la tabla»: una fila por personaje, con su edad y sus escenas. Conserva lo escrito en las demás columnas
 * (el actor), deja al final las filas de quien no está en el guion y quita las filas vacías.
 */
export function llenarTablaDePersonajes(fuente: string, linea: number, opciones: OpcionPersonaje[]): Cambio[] {
  const h = cabezaDeTabla(fuente, linea);
  const cP = h.indexOf('personaje');
  if (cP < 0) return [];
  const viejas = filasDeTabla(fuente, linea, h.length).map((f) => f.map((x) => x.trim()));
  const usadas = new Set<number>();
  const nuevas: string[][] = [];
  for (const o of opciones) {
    // Todas sus filas (dos candidatos para un personaje), juntas y en su orden; si no tiene, una nueva.
    const suyas = viejas.flatMap((f, i) => (!usadas.has(i) && igual(visible(f[cP] ?? ''), o.nombre) ? [i] : []));
    suyas.forEach((i) => usadas.add(i));
    for (const base of suyas.length ? suyas.map((i) => viejas[i]) : [h.map(() => '')])
      nuevas.push(
        h.map((col, c) => {
          const previo = celdaVacia(base[c] ?? '') ? '—' : base[c];
          // El nombre como ya estaba escrito (con su enlace o sus negritas).
          return c === cP ? (suyas.length ? base[c] : o.nombre) : derivado(col, o) || previo;
        }),
      );
  }
  viejas.forEach((f, i) => {
    if (!usadas.has(i) && !f.every(celdaVacia)) nuevas.push(f.map((x) => (celdaVacia(x) ? '—' : x)));
  });
  const lineas = fuente.split('\n');
  const inicio = (n: number) => lineas.slice(0, n).reduce((s, l) => s + l.length + 1, 0);
  const texto = nuevas.map((f) => `| ${f.join(' | ')} |`).join('\n');
  if (!viejas.length) {
    const fin = inicio(linea + 2) - 1;
    return [{ desde: fin, hasta: fin, texto: '\n' + texto }];
  }
  const desde = inicio(linea + 2);
  const hasta = inicio(linea + 1 + viejas.length) + lineas[linea + 1 + viejas.length].length;
  return [{ desde, hasta, texto }];
}
