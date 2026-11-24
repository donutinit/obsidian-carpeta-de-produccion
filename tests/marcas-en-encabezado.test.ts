import { describe, expect, it } from 'vitest';
import { construir } from '../src/motor';
import { textoPlano } from '../src/motor/enlinea';

const DIALOGO_LARGO =
  'Uno dos tres. Cuatro cinco seis siete. Ocho nueve diez. Once doce trece catorce. Quince dieciséis. Diecisiete dieciocho diecinueve. Veinte veintiuno. Veintidós veintitrés veinticuatro.';
const lineas = (fuente: string, r = 54) => construir(fuente, { renglonesPorPagina: r }).paginas.flatMap((p) => p.lineas);

describe('marcas en encabezados y personajes', () => {
  it('una marca en el encabezado se imprime sin llaves y entra al breakdown', () => {
    const g = construir('EXT./INT. {veh:camión|Camión de mudanza}/CAMINO - ATARDECER\n\nAlgo.\n');
    const e = g.doc.escenas[0];
    expect(e.encabezado).toBe('EXT./INT. CAMIÓN/CAMINO - ATARDECER');
    expect(e.locacion).toBe('CAMIÓN/CAMINO');
    expect(e.momento).toBe('ATARDECER');
    const primera = g.paginas[0].lineas[0];
    expect(textoPlano(primera.segs)).toBe('EXT./INT. CAMIÓN/CAMINO - ATARDECER');
    expect(primera.segs.find((s) => s.cat === 'veh')?.t).toBe('CAMIÓN');
    expect(g.breakdown[0].elementos.veh).toEqual([{ nombre: 'Camión de mudanza', cantidad: 1 }]);
  });

  it('una marca en el personaje no aparece en el (CONT\'D) ni en el reparto', () => {
    const fuente = `INT. A - DÍA\n\n${['Uno.', 'Dos.', 'Tres.'].join('\n')}\n\n{rep:ANA} (V.O.)\n${DIALOGO_LARGO}\n`;
    const todas = lineas(fuente, 12);
    const continua = todas.find((l) => l.tipo === 'continua')!;
    expect(textoPlano(continua.segs)).toBe("ANA (V.O.) (CONT'D)");
    const cue = todas.find((l) => l.tipo === 'personaje')!;
    expect(textoPlano(cue.segs)).toBe('ANA (V.O.)');
    expect(construir(fuente).breakdown[0].reparto).toEqual(['Ana']);
  });
});
