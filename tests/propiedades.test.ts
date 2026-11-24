import { describe, expect, it } from 'vitest';
import { analizar, leerFrontmatter, portadaDePropiedades } from '../src/motor';

describe('propiedades', () => {
  it('lee claves sueltas, entre comillas, listas en línea y en bloque', () => {
    const p = leerFrontmatter('---\ncarpeta: guion\ntitulo: "Mi corto"\ncredito: \'Guion de\'\nautor:\n  - Ana\n  - "Beto"\nnotas: [uno, "dos"]\nvacio:\n---\nINT. A - DÍA\n');
    expect(p).toEqual({ carpeta: 'guion', titulo: 'Mi corto', credito: 'Guion de', autor: ['Ana', 'Beto'], notas: ['uno', 'dos'], vacio: '' });
    expect(leerFrontmatter('INT. A - DÍA\n')).toEqual({});
  });

  it('la portada sale de titulo, credito, autor, basado_en, borrador y contacto', () => {
    expect(
      portadaDePropiedades({ titulo: 'T', credito: 'Guion de', autor: ['Ana', 'Beto'], basado_en: 'Un cuento', borrador: '23/11/2026', contacto: 'a@b.mx\n81 1234', otro: 'x', vacio: '' }),
    ).toEqual({ title: ['T'], credit: ['Guion de'], author: ['Ana', 'Beto'], source: ['Un cuento'], date: ['23/11/2026'], contact: ['a@b.mx', '81 1234'] });
  });

  it('las propiedades mandan sobre el bloque Title: del cuerpo, clave por clave', () => {
    const doc = analizar('---\ncarpeta: guion\ntitulo: C\n---\nTitle: A\nAuthor: B\n\nINT. CASA - DÍA\n\nAlgo.\n');
    expect(doc.portada.title).toEqual(['C']);
    expect(doc.portada.author).toEqual(['B']);
    expect(doc.escenas).toHaveLength(1);
  });

  it('sin bloque Title: la portada sale solo de las propiedades', () => {
    const doc = analizar('---\ncarpeta: guion\ntitulo: Solo\nautor: Ana\n---\nINT. CASA - DÍA\n\nAlgo.\n');
    expect(doc.portada).toEqual({ title: ['Solo'], author: ['Ana'] });
  });
});
