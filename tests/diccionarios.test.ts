import { describe, expect, it } from 'vitest';
import { analizar, construir, DICCIONARIOS_MX, resolverConfig } from '../src/motor';

describe('diccionarios', () => {
  it('trae las listas de fábrica para México', () => {
    expect(DICCIONARIOS_MX.inicios).toEqual(['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.']);
    expect(DICCIONARIOS_MX.transiciones).toContain('DISOLVENCIA A:');
    expect(DICCIONARIOS_MX.extensiones).toContain('V.O.');
    expect(resolverConfig().diccionarios).toEqual(DICCIONARIOS_MX);
    expect(resolverConfig().cronometraje).toBe('pagina');
  });

  it('una transición del proyecto que no es de fábrica se reconoce', () => {
    const fuente = 'INT. A - DÍA\n\nAlgo.\n\nSALTO A:\n\nEXT. B - NOCHE\n\nOtro.\n';
    expect(analizar(fuente).elementos.map((e) => e.tipo)).not.toContain('transicion');
    expect(analizar(fuente, { transiciones: ['SALTO A:'] }).elementos.map((e) => e.tipo)).toContain('transicion');
    const dic = { ...DICCIONARIOS_MX, transiciones: ['SALTO A:'] };
    expect(construir(fuente, { diccionarios: dic }).doc.elementos.map((e) => e.tipo)).toContain('transicion');
  });

  it('un momento del proyecto separa el encabezado', () => {
    expect(analizar('INT. CASA - MEDIODÍA\n', { momentos: ['MEDIODÍA'] }).escenas[0]).toMatchObject({ locacion: 'CASA', momento: 'MEDIODÍA' });
    expect(analizar('INT. CASA - COCINA - MEDIODÍA\n', { momentos: ['MEDIODÍA'] }).escenas[0]).toMatchObject({ locacion: 'CASA - COCINA', momento: 'MEDIODÍA' });
  });
});
