import { describe, expect, it } from 'vitest';
import { armarBreakdown } from '../src/motor/breakdown';
import { CONFIG_POR_DEFECTO } from '../src/motor/config';
import { analizar } from '../src/motor/fountain';
import { maquetar } from '../src/motor/maquetar';
import { construir } from '../src/motor';

const bd = (fuente: string) => {
  const doc = analizar(fuente);
  return armarBreakdown(doc, maquetar(doc, CONFIG_POR_DEFECTO));
};

describe('armarBreakdown', () => {
  it('elementos por escena sin duplicados', () => {
    const [e] = bd('INT. A - DÍA\n\nToma una {ut:manzana}. Luego otra {ut:Manzana}.\n');
    expect(e.elementos.ut).toEqual([{ nombre: 'Manzana', cantidad: 1 }]);
  });

  it('cantidad máxima dentro de la escena', () => {
    const [e] = bd('INT. A - DÍA\n\n{extra:gente|Extras|2} y {extra:más gente|Extras|5}.\n');
    expect(e.elementos.extra).toEqual([{ nombre: 'Extras', cantidad: 5 }]);
  });

  it('reparto', () => {
    const [e] = bd(
      "INT. A - DÍA\n\nFRANCISCO (CONT'D)\nHola.\n\nVECINO 1\nQuieto.\n\nFRANCISCO\nYa.\n\nEntra {rep:abuela|Abuela} y {rep:Francisco}.\n",
    );
    expect(e.reparto).toEqual(['Francisco', 'Vecino 1', 'Abuela']);
  });

  it('nombres de varias palabras llevan mayúscula en cada palabra', () => {
    const [e] = bd('INT. A - DÍA\n\nDON PEDRO\nHola.\n');
    expect(e.reparto).toEqual(['Don Pedro']);
  });

  it('escenas sin nada', () => {
    const r = bd('INT. A - DÍA\n\nINT. B - NOCHE\n\nAlgo pasa.\n');
    expect(r).toEqual([
      { reparto: [], elementos: {} },
      { reparto: [], elementos: {} },
    ]);
  });

  it('el texto antes de la primera escena no entra al breakdown', () => {
    expect(bd('Una {ut:llave}.\n\nINT. A - DÍA\n\nNada.\n')).toEqual([{ reparto: [], elementos: {} }]);
  });

  it('construir llena el breakdown', () => {
    const g = construir('INT. A - DÍA\n\nToma una {ut:manzana}.\n');
    expect(g.breakdown[0].elementos.ut[0].nombre).toBe('Manzana');
  });
});
