import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { construir, iniciosDePagina } from '../src/motor';

describe('cortes de página en el editor', () => {
  it('cada página desde la 2 empieza en la línea fuente de su primer renglón', () => {
    const g = construir('INT. A - DÍA\n\nUno.\n\nDos.\n\nTres.\n\nCuatro.\n\nCinco.\n', { renglonesPorPagina: 8 });
    expect(g.paginas).toHaveLength(2);
    expect(iniciosDePagina(g.paginas)).toEqual([{ pagina: 2, linea: 8 }]);
  });

  it('un diálogo partido marca la línea del diálogo que sigue, no el (CONT\'D)', () => {
    const largo = Array.from({ length: 12 }, (_, k) => `Frase número ${k + 1}.`).join(' ');
    const g = construir(`INT. A - DÍA\n\nANA\n${largo}\n`, { renglonesPorPagina: 8 });
    const [c] = iniciosDePagina(g.paginas);
    expect(c.pagina).toBe(2);
    expect(c.linea).toBe(3);
  });

  it('el guion de oro marca el inicio de cada página desde la 2 en las líneas fuente de esas páginas', () => {
    const fuente = readFileSync('tests/fixtures/papa.md', 'utf8');
    const g = construir(fuente);
    const cortes = iniciosDePagina(g.paginas);
    expect(cortes.map((c) => c.pagina)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const lineas = fuente.split('\n');
    for (const c of cortes) {
      expect(lineas[c.linea].trim()).not.toBe('');
      expect(g.paginas[c.pagina - 1].lineas.find((l) => l.fuente !== undefined)?.fuente).toBe(c.linea);
      expect(g.paginas[c.pagina - 2].lineas.every((l) => l.fuente === undefined || l.fuente <= c.linea)).toBe(true);
    }
  });
});
