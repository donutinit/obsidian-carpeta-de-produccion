import { describe, expect, it } from 'vitest';
import { analizar, escenaEnLinea, moverEscena, type Cambio } from '../src/motor';

const FUENTE = 'Title: X\n\nINT. A - DÍA\n%%escena: id=a%%\n\nUno.\n\nINT. B - DÍA\n\nDos.\n\nINT. C - DÍA\n\nTres.';
const aplicar = (t: string, c: Cambio | null) => (c ? t.slice(0, c.desde) + c.texto + t.slice(c.hasta) : t);

describe('escenas', () => {
  it('mover la 3 al principio conserva todo el texto', () => {
    expect(aplicar(FUENTE, moverEscena(FUENTE, 2, 0))).toBe(
      'Title: X\n\nINT. C - DÍA\n\nTres.\n\nINT. A - DÍA\n%%escena: id=a%%\n\nUno.\n\nINT. B - DÍA\n\nDos.\n',
    );
  });

  it('mover la última (sin salto final) a la mitad deja una línea en blanco entre escenas', () => {
    expect(aplicar(FUENTE, moverEscena(FUENTE, 2, 1))).toBe(
      'Title: X\n\nINT. A - DÍA\n%%escena: id=a%%\n\nUno.\n\nINT. C - DÍA\n\nTres.\n\nINT. B - DÍA\n\nDos.\n',
    );
  });

  it('el metadato %%escena%% viaja con su escena', () => {
    const t = aplicar(FUENTE, moverEscena(FUENTE, 0, 2));
    expect(t).toBe('Title: X\n\nINT. B - DÍA\n\nDos.\n\nINT. C - DÍA\n\nTres.\n\nINT. A - DÍA\n%%escena: id=a%%\n\nUno.\n');
    expect(analizar(t).escenas[2].meta).toEqual({ id: 'a' });
  });

  it('el texto antes de la primera escena no se mueve', () => {
    const c = moverEscena(FUENTE, 1, 0)!;
    expect(c.desde).toBe(FUENTE.indexOf('INT. A'));
  });

  it('mover a la misma posición o fuera de rango devuelve null', () => {
    expect(moverEscena(FUENTE, 1, 1)).toBeNull();
    expect(moverEscena(FUENTE, 5, 0)).toBeNull();
    expect(moverEscena(FUENTE, 0, -1)).toBeNull();
  });

  it('escenaEnLinea da la escena de una línea fuente', () => {
    const { escenas } = analizar(FUENTE);
    expect([0, 2, 5, 7, 13].map((l) => escenaEnLinea(escenas, l))).toEqual([-1, 0, 0, 1, 2]);
  });
});
