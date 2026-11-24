import { describe, expect, it } from 'vitest';
import { analizar, bloqueDeLinea, buscarEnGuion, construir, fuenteSides, palabrasNetas } from '../src/motor';

const F =
  '---\ncarpeta: guion\ntitulo: Prueba\n---\nINT. CASA - DÍA\n\nAna entra.\nSe sienta.\n\nANA\n(bajito)\nHola, ¿qué tal?\nBien.\n\n' +
  'EXT. CALLE - NOCHE\n\nBETO\nNo sé.\n\nINT. CASA - DÍA\n\nANA\nHOLA otra vez.\n';

describe('búsqueda por tipo de párrafo', () => {
  it('por texto y tipo, sin acentos ni mayúsculas', () => {
    expect(buscarEnGuion(F, 'hola', ['dialogo']).map((r) => [r.linea, r.texto, r.escena])).toEqual([
      [11, 'Hola, ¿qué tal?', 0],
      [22, 'HOLA otra vez.', 2],
    ]);
    expect(buscarEnGuion(F, 'que')).toHaveLength(1);
    expect(buscarEnGuion(F, '', ['personaje']).map((r) => r.texto)).toEqual(['ANA', 'BETO', 'ANA']);
    expect(buscarEnGuion(F, 'sienta').map((r) => [r.linea, r.tipo])).toEqual([[7, 'accion']]);
  });
});

describe('bloque del cursor', () => {
  it('un diálogo es el bloque entero y una acción su párrafo', () => {
    expect(bloqueDeLinea(F, 11)).toEqual([9, 12]);
    expect(bloqueDeLinea(F, 9)).toEqual([9, 12]);
    expect(bloqueDeLinea(F, 7)).toEqual([6, 7]);
    expect(bloqueDeLinea(F, 5)).toEqual([5, 5]);
  });
});

describe('palabras netas', () => {
  it('lo que creció el guion en palabras', () => {
    expect(palabrasNetas('INT. A - DÍA\n\nUno.\n', 'INT. A - DÍA\n\nUno dos tres.\n%%comentario largo%%\n')).toBe(2);
    expect(palabrasNetas('INT. A - DÍA\n\nUno dos.\n', 'INT. A - DÍA\n\nUno.\n')).toBe(-1);
  });
});

describe('hablante', () => {
  it('en cada renglón del bloque y en la columna dual', () => {
    const b = construir('INT. A - DÍA\n\nANA\n(bajito)\nHola.\n').bloques[1];
    expect(b.lineas.map((l) => l.hablante)).toEqual(['ANA', 'ANA', 'ANA']);
    const d = construir('INT. A - DÍA\n\nANA\nHola.\n\nBETO ^\nQué tal.\n').bloques[1];
    expect(d.lineas.map((l) => [l.hablante, l.der?.hablante])).toEqual([
      ['ANA', 'BETO'],
      ['ANA', 'BETO'],
    ]);
  });
});

describe('sides', () => {
  it('solo las escenas del personaje, con sus números originales', () => {
    const s = fuenteSides(F, 'Ana');
    const doc = analizar(s);
    expect(doc.escenas.map((e) => [e.numero, e.numeroFijo])).toEqual([
      ['1', '1'],
      ['3', '3'],
    ]);
    expect(s).not.toContain('No sé.');
    expect(doc.portada.title).toEqual(['Prueba']);
    expect(fuenteSides(F, 'nadie')).not.toMatch(/INT\.|EXT\./);
  });

  it('sides: conserva la portada escrita en el cuerpo (Title:)', () => {
    const s = fuenteSides('Title: Un corto\nAuthor: Ana\n\nINT. A - DÍA\n\nANA\nHola.\n', 'Ana');
    expect(analizar(s).portada).toMatchObject({ title: ['Un corto'], author: ['Ana'] });
    expect(analizar(s).escenas.map((e) => e.numero)).toEqual(['1']);
  });
});
