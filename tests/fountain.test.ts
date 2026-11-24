import { describe, expect, it } from 'vitest';
import { analizar, clasificarLineas } from '../src/motor/fountain';

const tipos = (fuente: string) => analizar(fuente).elementos.map((e) => e.tipo);

describe('analizar', () => {
  it('números de línea se conservan', () => {
    const fuente = ['---', 'carpeta: guion', 'titulo: X', '---', '%%', 'una guía', '%%', '', 'INT. CASA - DÍA', '', 'Ana entra.'].join('\n');
    const doc = analizar(fuente);
    expect(doc.escenas[0].linea).toBe(8);
    expect(doc.elementos.find((e) => e.tipo === 'accion')?.linea).toBe(10);
  });

  it('portada', () => {
    const doc = analizar('Title: Mi corto\nAuthor: Ana\n\nINT. CASA - DÍA\n');
    expect(doc.portada.title[0]).toBe('Mi corto');
    expect(doc.portada.author[0]).toBe('Ana');
    const es = analizar('Título: Otro\nAutor: Ana\n\nEXT. CALLE - NOCHE\n');
    expect(es.portada.title[0]).toBe('Otro');
    expect(es.portada.author[0]).toBe('Ana');
    expect(es.escenas.length).toBe(1);
  });

  it('encabezado se separa', () => {
    const a = analizar('INT. DEPARTAMENTO DE LUCÍA (COCINA) - MAÑANA\n').escenas[0];
    expect([a.introduccion, a.locacion, a.momento]).toEqual(['INT.', 'DEPARTAMENTO DE LUCÍA (COCINA)', 'MAÑANA']);
    const b = analizar('EXT./INT. CAMIÓN/CAMINO DE TIERRA - ATARDECER\n').escenas[0];
    expect(b.introduccion).toBe('EXT./INT.');
    expect(b.locacion).toBe('CAMIÓN/CAMINO DE TIERRA');
    const c = analizar('INT. CASA - COCINA - DÍA\n').escenas[0];
    expect([c.locacion, c.momento]).toEqual(['CASA - COCINA', 'DÍA']);
    const d = analizar('EXT. PARQUE - MOMENTOS DESPUÉS\n').escenas[0];
    expect([d.locacion, d.momento]).toEqual(['PARQUE', 'MOMENTOS DESPUÉS']);
  });

  it('prefijo exige punto o espacio', () => {
    expect(tipos('Algo.\n\nINTERIORISMO es bonito.\n')).toEqual(['accion', 'accion']);
  });

  it('número fijo', () => {
    const doc = analizar('INT. CASA - DÍA #5A#\n\nUno.\n\nINT. PATIO - DÍA\n\nDos.\n');
    expect(doc.escenas[0].numero).toBe('5A');
    expect(doc.escenas[0].numeroFijo).toBe('5A');
    expect(doc.escenas[0].encabezado).toBe('INT. CASA - DÍA');
    expect(doc.escenas[1].numero).toBe('5B');
    expect(doc.escenas[1].numeroFijo).toBeUndefined();
    const sin = analizar('INT. A - DÍA\n\nINT. B - DÍA\n');
    expect(sin.escenas.map((e) => e.numero)).toEqual(['1', '2']);
  });

  it('metadatos de escena', () => {
    const doc = analizar('INT. CASA - DÍA\n%%escena: id=a1; color=azul; dia_historia=1%%\n\nAna entra.\n');
    expect(doc.escenas[0].meta).toEqual({ id: 'a1', color: 'azul', dia_historia: '1' });
    expect(tipos('INT. CASA - DÍA\n%%escena: id=a1%%\n\nAna entra.\n')).toEqual(['encabezado', 'accion']);
  });

  it('diálogo', () => {
    const doc = analizar("INT. AUTO - DÍA\n\nFRANCISCO (CONT'D)\n(nervioso)\nDame las llaves.\n\nANA (V.O.) ^\nHola.\n");
    const e = doc.elementos;
    expect(e.map((x) => x.tipo)).toEqual(['encabezado', 'personaje', 'acotacion', 'dialogo', 'personaje', 'dialogo']);
    expect(e[1].nombre).toBe('FRANCISCO');
    expect(e[1].extension).toBe("CONT'D");
    expect(e[4].nombre).toBe('ANA');
    expect(e[4].extension).toBe('V.O.');
    expect(e[4].dual).toBe(true);
  });

  it('transiciones', () => {
    const e = analizar('INT. A - DÍA\n\nAlgo pasa.\n\n> CORTE A NEGRO.\n\nCORTE A:\n\nEXT. B - NOCHE\n\n>FIN.<\n').elementos;
    expect(e.map((x) => x.tipo)).toEqual(['encabezado', 'accion', 'transicion', 'transicion', 'encabezado', 'centrado']);
    expect(e[2].texto).toBe('CORTE A NEGRO.');
    expect(e[5].texto).toBe('FIN.');
  });

  it('plano', () => {
    const e = analizar('INT. A - DÍA\n\n!!PRIMER PLANO DE ANA\n\nAna sonríe.\n').elementos;
    expect(e[1].tipo).toBe('plano');
    expect(e[1].texto).toBe('PRIMER PLANO DE ANA');
  });

  it('texto antes de la primera escena', () => {
    const doc = analizar('Una nota suelta.\n\nINT. A - DÍA\n\nAlgo.\n');
    expect(doc.elementos[0].escena).toBe(-1);
    expect(doc.elementos[2].escena).toBe(0);
  });

  it('Windows: CRLF, tabulación y espacio duro dan lo mismo', () => {
    const lf = 'Title: X\n\nINT. CASA - DÍA\n\nLucía despierta tarde.\n\nFRANCISCO\n¡Oye!, espérame.\n';
    const win = 'Title: X\r\n\r\nINT. CASA - DÍA\r\n\r\n\tLucía\u00a0despierta tarde.\r\n\r\nFRANCISCO\r\n¡Oye!,\u00a0espérame.\r\n';
    const a = analizar(lf);
    const b = analizar(win);
    expect(b.elementos).toEqual(a.elementos);
    expect(b.escenas).toEqual(a.escenas);
    expect(b.portada).toEqual(a.portada);
  });

  it('acción de varias líneas es un solo elemento', () => {
    const e = analizar('INT. A - DÍA\n\nUno.\nDos.\n').elementos;
    expect(e[1]).toMatchObject({ tipo: 'accion', texto: 'Uno.\nDos.', linea: 2 });
  });
});

describe('clasificarLineas', () => {
  it('un tipo por línea', () => {
    expect(clasificarLineas('\nINT. CASA - DÍA\n\nANA\nHola.\n')).toEqual([null, 'encabezado', null, 'personaje', 'dialogo', null]);
  });

  it('comentarios y portada son null; acción de varias líneas se marca completa', () => {
    expect(clasificarLineas('Title: X\n\n%%nota%%\nINT. A - DÍA\n\nUno.\nDos.')).toEqual([null, null, null, 'encabezado', null, 'accion', 'accion']);
  });
});
