import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { construir } from '../src/motor';

const fixture = readFileSync(new URL('./fixtures/papa.md', import.meta.url), 'utf8');

describe('«PAPA (papá)»', () => {
  it('escenas 1 a 5', () => {
    expect(construir(fixture).octavos.porEscena.slice(0, 5)).toEqual([11, 7, 2, 1, 1]);
  });

  it('resto', () => {
    const g = construir(fixture);
    expect({ total: g.octavos.total, paginas: g.paginas.length, porEscena: g.octavos.porEscena }).toMatchInlineSnapshot(`
      {
        "paginas": 10,
        "porEscena": [
          11,
          7,
          2,
          1,
          1,
          1,
          1,
          1,
          5,
          1,
          4,
          1,
          6,
          3,
          2,
          5,
          4,
          2,
          4,
          1,
          2,
          2,
          4,
          3,
          1,
          1,
        ],
        "total": 76,
      }
    `);
  });

  it('construir tarda menos de 50 ms', () => {
    construir(fixture);
    const t0 = performance.now();
    construir(fixture);
    expect(performance.now() - t0).toBeLessThan(50);
  });
});

describe('guiones límite', () => {
  it('guion vacío', () => {
    const g = construir('');
    expect([g.paginas.length, g.doc.escenas.length, g.octavos.total]).toEqual([0, 0, 0]);
  });

  it('solo portada', () => {
    const g = construir('Title: X\n');
    expect(g.doc.escenas.length).toBe(0);
    expect(g.octavos.total).toBe(0);
  });

  it('texto antes de la primera escena se pagina', () => {
    const g = construir('FADE IN:\n\nINT. A - DÍA\n\nAlgo.\n');
    expect(g.paginas[0].lineas[0].escena).toBe(-1);
    expect(g.octavos.porEscena).toEqual([1]);
  });
});
