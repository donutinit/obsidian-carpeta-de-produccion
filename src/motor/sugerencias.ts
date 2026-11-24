import { DICCIONARIOS_MX, limpiarLista, type Diccionarios } from './diccionarios';
import { analizarEnLinea, textoPlano } from './enlinea';
import { analizar } from './fountain';
import { lineaYColumna, type TipoParrafo } from './teclado';
import type { Documento } from './tipos';

/** Una sugerencia: `texto` reemplaza lo que va de la columna `desde` al cursor. `final`: era la última parte del párrafo. */
export interface Sugerencia {
  texto: string;
  desde: number;
  final: boolean;
}

const MAX = 10;
const unir = (...listas: string[][]) => limpiarLista(listas.flat());

/** Filtra sin distinguir mayúsculas. Vacía si lo tecleado ya es una sugerencia completa. */
function filtrar(lista: string[], frag: string, modo: 'prefijo' | 'contiene'): string[] {
  const f = frag.trim().toUpperCase();
  if (f && lista.includes(f)) return [];
  const pasan = lista.filter((x) => (modo === 'prefijo' ? x.startsWith(f) : x.includes(f)));
  if (modo === 'contiene') {
    const empiezan = pasan.filter((x) => x.startsWith(f)).sort((a, b) => a.localeCompare(b, 'es'));
    const resto = pasan.filter((x) => !x.startsWith(f)).sort((a, b) => a.localeCompare(b, 'es'));
    return [...empiezan, ...resto].slice(0, MAX);
  }
  return pasan.slice(0, MAX);
}

const como = (lista: string[], desde: number, final: boolean, sufijo = ''): Sugerencia[] => lista.map((texto) => ({ texto: texto + sufijo, desde, final }));

function sugerirEncabezado(antes: string, L: number, doc: Documento, dic: Diccionarios, extra: Extra): Sugerencia[] {
  const otras = doc.escenas.filter((e) => e.linea !== L);
  const frag = antes.trimStart();
  if (!/\s/.test(frag)) return como(filtrar(unir(dic.inicios, otras.map((e) => e.introduccion)), frag, 'prefijo'), antes.length - frag.length, false, ' ');
  const resto = frag.slice(frag.search(/\s/)).trimStart();
  const desdeResto = antes.length - resto.length;
  const locaciones = unir(otras.map((e) => e.locacion), extra.locaciones ?? []);
  const sep = Math.max(resto.lastIndexOf(' - '), resto.lastIndexOf(' -- '));
  if (sep < 0) return como(filtrar(locaciones, resto, 'contiene'), desdeResto, false);
  // Sublocación: «CASA - CO» → «CASA - COCINA».
  const r = resto.toUpperCase();
  const sub = locaciones.filter((l) => l.startsWith(r) && l !== r);
  if (sub.length) return como(sub.slice(0, MAX), desdeResto, false);
  const momento = resto.slice(sep).replace(/^\s*-{1,2}\s*/, '');
  return como(filtrar(unir(dic.momentos, otras.map((e) => e.momento)), momento, 'prefijo'), antes.length - momento.length, true);
}

function sugerirPersonaje(antes: string, L: number, doc: Documento, dic: Diccionarios, extra: Extra): Sugerencia[] {
  const hablan = doc.elementos.filter((e) => e.tipo === 'personaje' && e.linea !== L);
  if (antes.lastIndexOf('(') > antes.lastIndexOf(')')) {
    const frag = antes.slice(antes.lastIndexOf('(') + 1);
    const usadas = hablan.flatMap((e) => (e.extension ? e.extension.split(') (') : []));
    return como(filtrar(unir(dic.extensiones, usadas), frag, 'prefijo'), antes.length - frag.length, true, ')');
  }
  const frag = antes.trimStart().replace(/^@/, '');
  // Quienes hablaron en la escena, de abajo hacia arriba; el segundo va al frente porque probablemente responde.
  const escena = doc.escenas.filter((e) => e.linea < L).at(-1)?.linea ?? -1;
  const enEscena: string[] = [];
  for (const e of [...hablan].reverse()) {
    if (e.linea > L || e.linea < escena) continue;
    const n = (e.nombre ?? '').toUpperCase();
    if (n && !enEscena.includes(n)) enEscena.push(n);
  }
  if (enEscena.length >= 2) [enEscena[0], enEscena[1]] = [enEscena[1], enEscena[0]];
  const lista = unir(enEscena, hablan.map((e) => e.nombre ?? ''), extra.personajes ?? []);
  return como(filtrar(lista, frag, 'prefijo'), antes.length - frag.length, true);
}

function sugerirTransicion(antes: string, L: number, doc: Documento, dic: Diccionarios): Sugerencia[] {
  const frag = antes.replace(/^\s*>?\s*/, '');
  const usadas = doc.elementos.filter((e) => e.tipo === 'transicion' && e.linea !== L).map((e) => textoPlano(analizarEnLinea(e.texto)));
  return como(filtrar(unir(dic.transiciones, usadas), frag, 'prefijo'), antes.length - frag.length, true);
}

interface Extra {
  personajes?: string[];
  locaciones?: string[];
}

/** Autocompletado del guion. Máximo 10 sugerencias. */
export function sugerir(texto: string, pos: number, tipo: TipoParrafo, dic: Diccionarios = DICCIONARIOS_MX, extra: Extra = {}): Sugerencia[] {
  const { linea: L, ch } = lineaYColumna(texto, pos);
  const linea = texto.split('\n')[L];
  const antes = linea.slice(0, ch);
  // Solo al final de la línea (o antes del «)» que cerró el autocierre en una extensión).
  const despues = linea.slice(ch).trim();
  if (despues && !(tipo === 'personaje' && despues === ')')) return [];
  const doc = analizar(texto, { transiciones: dic.transiciones, momentos: dic.momentos });
  if (tipo === 'encabezado') return sugerirEncabezado(antes, L, doc, dic, extra);
  if (tipo === 'personaje') return sugerirPersonaje(antes, L, doc, dic, extra);
  if (tipo === 'transicion') return sugerirTransicion(antes, L, doc, dic);
  return [];
}
