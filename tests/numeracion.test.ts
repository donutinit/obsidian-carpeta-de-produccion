import { describe, expect, it } from 'vitest';
import { analizar, bloquearNumeracion, desbloquearNumeracion, numerarEscenas, type Cambio } from '../src/motor';

const u = undefined;
const aplicar = (t: string, cs: Cambio[]) => [...cs].sort((a, b) => b.desde - a.desde).reduce((s, c) => s.slice(0, c.desde) + c.texto + s.slice(c.hasta), t);

describe('numeración', () => {
  it('sin fijos numera 1…n', () => {
    expect(numerarEscenas([u, u, u])).toEqual(['1', '2', '3']);
  });
  it('tras 5 bloqueado vienen 5A y 5B', () => {
    expect(numerarEscenas(['4', '5', u, u, '6'])).toEqual(['4', '5', '5A', '5B', '6']);
  });
  it('tras 5A sigue 5B', () => {
    expect(numerarEscenas(['5', '5A', u])).toEqual(['5', '5A', '5B']);
  });
  it('pasada la Z viene A1', () => {
    const r = numerarEscenas(['5', ...new Array(27).fill(u)]);
    expect(r[26]).toBe('5Z');
    expect(r[27]).toBe('5A1');
  });
  it('antes de la primera bloqueada: A1, B1', () => {
    expect(numerarEscenas([u, u, '1', '2'])).toEqual(['A1', 'B1', '1', '2']);
  });
  it('números únicos con fijos y sin fijar mezclados', () => {
    const r = numerarEscenas(['5', u, '5A', u, u, '7', u]);
    expect(new Set(r).size).toBe(r.length);
    expect(r).toEqual(['5', 'A5A', '5A', '5B', '5C', '7', '7A']);
  });
  it('I3: una escena entre dos fijas con la misma base queda en orden', () => {
    expect(numerarEscenas([u, '5', u, '5A', u])).toEqual(['A5', '5', 'A5A', '5A', '5B']);
    expect(numerarEscenas(['5', u, u, '5B'])).toEqual(['5', 'A5B', 'B5B', '5B']);
    expect(numerarEscenas(['5', u, '5B'])).toEqual(['5', '5A', '5B']);
  });

  it('analizar numera con la regla del bloqueo', () => {
    const doc = analizar('INT. CASA - DÍA #5A#\n\nUno.\n\nINT. PATIO - DÍA\n\nDos.\n');
    expect(doc.escenas.map((e) => e.numero)).toEqual(['5A', '5B']);
  });
  it('bloquear escribe #n# y desbloquear lo quita, sin tocar lo demás', () => {
    const t = '---\ncarpeta: guion\n---\nINT. A - DÍA\n\nUno.\n\nINT. B - DÍA %%nota%%\n\nDos. #no es número#\n';
    const bloqueado = aplicar(t, bloquearNumeracion(t));
    expect(bloqueado).toBe('---\ncarpeta: guion\n---\nINT. A - DÍA#1#\n\nUno.\n\nINT. B - DÍA %%nota%%#2#\n\nDos. #no es número#\n');
    expect(analizar(bloqueado).escenas.map((e) => e.numeroFijo)).toEqual(['1', '2']);
    expect(bloquearNumeracion(bloqueado)).toEqual([]);
    expect(aplicar(bloqueado, desbloquearNumeracion(bloqueado))).toBe(t);
  });
  it('bloquear después de insertar escenas fija también sus letras', () => {
    const t = 'INT. A - DÍA #1#\n\nUno.\n\nINT. NUEVA - DÍA\n\nX.\n\nINT. B - DÍA #2#\n';
    // Pegado al encabezado: con espacio, Obsidian tomaría «#1A» como etiqueta.
    expect(aplicar(t, bloquearNumeracion(t))).toContain('INT. NUEVA - DÍA#1A#');
  });
});
