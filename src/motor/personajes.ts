import type { Guion } from './index';
import { GENERICOS, nombrePropio } from './breakdown';
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
