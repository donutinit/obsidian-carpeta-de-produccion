import { describe, expect, it } from 'vitest';
import { resolverConfig } from '../src/motor/config';
import { calcularOctavos, formatearOctavos, repartir, segundosAproximados } from '../src/motor/octavos';
import type { Linea, Pagina } from '../src/motor/tipos';

const linea = (escena: number): Linea => ({ tipo: 'accion', columna: 0, segs: [{ t: 'x' }], escena });
/** Una página con `n` renglones de cada escena, en orden. */
const pagina = (...tramos: [escena: number, renglones: number][]): Pagina => ({
  lineas: tramos.flatMap(([e, n]) => Array.from({ length: n }, () => linea(e))),
});
const cfg = resolverConfig();
const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('octavos', () => {
  it('formato', () => {
    expect([1, 8, 11, 16, 0].map(formatearOctavos)).toEqual(['1/8', '1', '1 3/8', '2', '0/8']);
  });

  it('segundos aproximados: una página son 60 s', () => {
    expect(segundosAproximados(8)).toBe(60);
    expect(segundosAproximados(1)).toBe(7.5);
  });

  it('página llena suma 8', () => {
    const o = calcularOctavos([pagina([0, 20], [1, 14], [2, 20]), pagina([2, 30])], 3, cfg);
    expect(suma(o.porPagina[0].map((t) => t.octavos))).toBe(8);
    expect(o.porPagina[0].map((t) => [t.escena, t.inicio, t.fin])).toEqual([[0, 0, 20], [1, 20, 34], [2, 34, 54]]);
    expect(o.paginasPorEscena[2]).toEqual([1, 2]);
  });

  it('mínimo 1/8 gana', () => {
    const diez = pagina(...Array.from({ length: 10 }, (_, k) => [k, 2] as [number, number]));
    const o = calcularOctavos([diez, pagina([9, 30])], 10, cfg);
    expect(o.porPagina[0].map((t) => t.octavos)).toEqual(new Array(10).fill(1));
    expect(suma(o.porPagina[0].map((t) => t.octavos))).toBe(10);
  });

  it('regresión del 23 de noviembre', () => {
    expect(repartir([0.89, 1.04, 1.78, 1.19, 0.74, 1.48, 0.89], 8)).toEqual([1, 1, 2, 1, 1, 1, 1]);
  });

  it('repartir: los mínimos no rebasan el objetivo si se puede quitar a los grandes', () => {
    expect(suma(repartir([5.5, 0.1, 0.1, 0.1, 0.1, 0.1, 2], 8))).toBe(8);
  });

  it('última página', () => {
    const o = calcularOctavos([pagina([0, 54]), pagina([0, 27])], 1, cfg);
    expect(o.porPagina[1][0].octavos).toBe(4);
    expect(o.total).toBe(12);
    const completa = calcularOctavos([pagina([0, 54]), pagina([0, 27])], 1, resolverConfig({ ultimaPaginaCompleta: true }));
    expect(completa.porPagina[1][0].octavos).toBe(8);
  });

  it('texto antes de la primera escena', () => {
    const o = calcularOctavos([pagina([-1, 27], [0, 27]), pagina([0, 54]), pagina([0, 10])], 1, cfg);
    expect(o.porPagina[0].map((t) => [t.escena, t.inicio])).toEqual([[0, 27]]);
    expect(o.porPagina[0][0].octavos).toBe(4);
    expect(o.total).toBe(suma(o.porEscena));
  });

  it('sin páginas', () => {
    expect(calcularOctavos([], 0, cfg)).toEqual({ porPagina: [], porEscena: [], paginasPorEscena: [], total: 0 });
  });
});
