import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analizar, construir, exportarFountain, importarFountain } from '../src/motor';

const ORO = readFileSync('tests/fixtures/papa.md', 'utf8');
const F =
  '---\ncarpeta: guion\ntitulo: Prueba\nautor: [Ana, Beto]\n---\nINT. CASA - DÍA\n%%escena: id=a1%%\n\n' +
  'Ana toma la {ut:taza|Taza roja} de [[Personajes/Ana|Ana]].\n%%nota del profe%%\n\n!!PRIMER PLANO DE la taza\n\nANA\nHola.\n';

const resumen = (fuente: string) => {
  const g = construir(fuente);
  return {
    elementos: g.doc.elementos.map((e) => [e.tipo, e.texto]),
    escenas: g.doc.escenas.map((e) => [e.numero, e.numeroFijo ?? null, e.encabezado, e.meta]),
    octavos: g.octavos.porEscena,
    breakdown: g.breakdown,
    ocultas: g.doc.ocultas.map((o) => [o.escena, o.cat, o.item]),
    portada: g.doc.portada,
  };
};

describe('Fountain', () => {
  it('limpio quita marcas, comentarios, enlaces y planos; escribe portada y números', () => {
    expect(exportarFountain(F, 'limpio')).toBe(
      'Title: Prueba\nAuthor:\n    Ana\n    Beto\n\nINT. CASA - DÍA #1#\n\nAna toma la taza de Ana.\n\n!PRIMER PLANO DE LA TAZA\n\nANA\nHola.\n',
    );
  });

  it('limpio sin portada y con números fijos', () => {
    expect(exportarFountain('INT. A - DÍA#5A#\n\nAlgo.\n', 'limpio')).toBe('INT. A - DÍA #5A#\n\nAlgo.\n');
  });

  it('completo ida y vuelta con la nota de prueba', () => {
    const vuelta = importarFountain(exportarFountain(F, 'completo'));
    expect(resumen(vuelta)).toEqual(resumen(F));
    expect(vuelta).toContain('[[Personajes/Ana|Ana]]');
    expect(vuelta).toContain('%%nota del profe%%');
  });

  it('completo ida y vuelta con el guion de oro', () => {
    expect(resumen(importarFountain(exportarFountain(ORO, 'completo')))).toEqual(resumen(ORO));
  });

  it('completo ida y vuelta con marcas con comas, acentos, cantidad y ocultas', () => {
    const f = '---\ncarpeta: guion\n---\nINT. A - DÍA#3#\n%%{vest:|Traje «azul», de Ana}%%\n\nToma {ut:la taza, rota|Taza «roja»|3} y\n%%dos\nlíneas%%\nsigue.\n';
    const vuelta = importarFountain(exportarFountain(f, 'completo'));
    expect(resumen(vuelta)).toEqual(resumen(f));
    expect(analizar(vuelta).escenas[0].numeroFijo).toBe('3');
  });

  it('importar convierte notas ajenas en comentarios y pega los números al encabezado', () => {
    expect(importarFountain('Title: Otro\nAuthor: Ana\n\nINT. A - DÍA #2#\n\nAlgo [[nota ajena]].\n')).toBe(
      '---\ncarpeta: guion\ntitulo: "Otro"\nautor: "Ana"\n---\nINT. A - DÍA#2#\n\nAlgo %%nota ajena%%.\n',
    );
  });

  it('importar sin portada', () => {
    expect(importarFountain('INT. A - DÍA\r\n\r\nAlgo.\r\n')).toBe('---\ncarpeta: guion\n---\nINT. A - DÍA\n\nAlgo.\n');
  });
});

describe('revisión fase 3', () => {
  it('C1: el limpio del guion de oro no repite la portada en el cuerpo', () => {
    const limpio = exportarFountain(ORO, 'limpio');
    expect(limpio.match(/^Title:/gm)).toHaveLength(1);
    expect(limpio.startsWith('Title: PAPA (papá)\nCredit: Guion de\nDraft date: 24 de noviembre de 2026\n\nINT. RESTAURANTE TRES TIERRAS')).toBe(true);
  });

  it('C1: la portada escrita en el cuerpo sobrevive la ida y vuelta', () => {
    const f = '---\ncarpeta: guion\n---\nTitle: Mi corto\nAuthor: Ana\nDraft date: 1 nov\n\nINT. A - DÍA\n\nAlgo.\n';
    expect(resumen(importarFountain(exportarFountain(f, 'completo')))).toEqual(resumen(f));
    const mixta = '---\ncarpeta: guion\ntitulo: Otro\n---\nAuthor: Beto\nContact: b@x.mx\n\nINT. A - DÍA\n\nAlgo.\n';
    expect(resumen(importarFountain(exportarFountain(mixta, 'completo')))).toEqual(resumen(mixta));
  });

  it('C2: marcas con enlaces dentro: el limpio deja el texto visible y la ida y vuelta las conserva', () => {
    const f = '---\ncarpeta: guion\n---\nINT. {deco:[[Casa de Ana]]} - DÍA\n\n{rep:[[Personajes/Ana|ANA]]} entra con la {ut:taza %%ojo%%}.\n';
    const limpio = exportarFountain(f, 'limpio');
    expect(limpio).toContain('INT. Casa de Ana - DÍA #1#');
    expect(limpio).toContain('ANA entra con la taza.');
    expect(limpio).not.toMatch(/\[\[|\{|%%/);
    expect(resumen(importarFountain(exportarFountain(f, 'completo')))).toEqual(resumen(f));
  });

  it('I1: un %% o /* sin cerrar no se come el resto del guion', () => {
    const f = 'INT. A - DÍA\n\nAna dice %% algo.\n\nINT. B - NOCHE\n\nBeto corre.\n';
    expect(exportarFountain(f, 'limpio')).toContain('INT. B - NOCHE #2#');
    expect(resumen(importarFountain(exportarFountain(f, 'completo')))).toEqual(resumen(f));
  });

  it('I4: claves de portada desconocidas no se imprimen como acción', () => {
    const md = importarFountain('Title: X\nRevision: Blue draft\nNotes: hola\n\nINT. A - DÍA\n\nAlgo.\n');
    expect(construir(md).doc.elementos.map((e) => e.tipo)).toEqual(['encabezado', 'accion']);
    expect(md).toContain('%%Revision: Blue draft%%');
    expect(construir(md).doc.portada).toMatchObject({ title: ['X'], notes: ['hola'] });
  });
});
