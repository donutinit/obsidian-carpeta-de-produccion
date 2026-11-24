import { describe, expect, it } from 'vitest';
import { analizar, construir, contarPalabras, duracionEscenas, duracionTotal, formatearDuracion } from '../src/motor';

const x = (n: number) => 'x'.repeat(n);

describe('duracion', () => {
  it('por página son octavos × 7.5', () => {
    const g = construir('INT. A - DÍA\n\nUno.\n\nINT. B - DÍA\n\nDos.\n');
    expect(duracionEscenas(g)).toEqual(g.octavos.porEscena.map((o) => o * 7.5));
    expect(duracionTotal(g)).toBe(g.octavos.total * 7.5);
  });

  it('por caracteres, 1350 caracteres son un minuto', () => {
    // «INT. A - DÍA» son 12 caracteres; la acción, 1338.
    const g = construir(`INT. A - DÍA\n\n${x(1338)}\n\nINT. B - DÍA\n\n${x(663)}\n`, { cronometraje: 'caracteres' });
    expect(duracionEscenas(g)).toEqual([60, 30]);
    expect(duracionTotal(g)).toBe(90);
  });

  it('por tipo suma acción, diálogo y encabezado', () => {
    const g = construir(`INT. A - DÍA\n\n${x(50)}\n\nANA\n${x(100)}\n`, { cronometraje: 'tipo' });
    // encabezado 2 + acción 1 + 1.5 + diálogo 2 + 2·2.4; el personaje no suma.
    expect(duracionEscenas(g)[0]).toBeCloseTo(11.3, 6);
  });

  it('formatea m:ss', () => {
    expect(formatearDuracion(75)).toBe('1:15');
    expect(formatearDuracion(3600)).toBe('60:00');
    expect(formatearDuracion(0)).toBe('0:00');
    expect(formatearDuracion(59.6)).toBe('1:00');
  });
});

describe('palabras', () => {
  it('no cuenta comentarios ni códigos de marca', () => {
    const doc = analizar('INT. CASA - DÍA\n\nAna toma {ut:la taza}.\n%%comentario largo aquí%%\n\n= una sinopsis que no cuenta\n');
    expect(contarPalabras(doc)).toBe(7);
  });
});
