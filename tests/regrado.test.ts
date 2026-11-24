import { describe, expect, it } from 'vitest';
import { construir } from '../src/motor';
import { resolverConfig } from '../src/motor/config';
import { analizar } from '../src/motor/fountain';
import { calcularOctavos } from '../src/motor/octavos';
import { finesDeFrase } from '../src/motor/paginar';
import type { Linea, Pagina } from '../src/motor/tipos';

describe('abreviaturas no son fin de frase', () => {
  it('Sr., Dra., Lic. e iniciales no cortan', () => {
    const t = 'Lo dijo el Sr. López. Y la Dra. Ruiz con el Lic. Pérez y J. Martínez. Ya.';
    const cortes = finesDeFrase(t).map((p) => t.slice(0, p).split(' ').pop());
    expect(cortes).toEqual(['López.', 'Martínez.', 'Ya.']);
  });
});

describe('BOM al inicio del archivo', () => {
  it('no imprime el frontmatter', () => {
    const doc = analizar('\uFEFF---\ncarpeta: guion\n---\nINT. A - DÍA\n\nAlgo.\n');
    expect(doc.elementos.map((e) => e.tipo)).toEqual(['encabezado', 'accion']);
    expect(doc.escenas[0].linea).toBe(3);
  });
});

describe('reparto marcado en mayúsculas', () => {
  it('se escribe con mayúscula inicial como los que hablan', () => {
    const g = construir('INT. A - DÍA\n\nEntra el {rep:POLICÍA} y {rep:Los dos de la barra|Mesero y Cantinero}.\n');
    expect(g.breakdown[0].reparto).toEqual(['Policía', 'Mesero y Cantinero']);
  });
});

describe('texto previo en la última página', () => {
  it('un solo redondeo', () => {
    const linea = (escena: number): Linea => ({ tipo: 'accion', columna: 0, segs: [{ t: 'x' }], escena });
    const pagina: Pagina = { lineas: [...Array.from({ length: 10 }, () => linea(-1)), ...Array.from({ length: 30 }, () => linea(0))] };
    // 30 renglones de escena de 54 = 4.44 octavos → 4.
    expect(calcularOctavos([pagina], 1, resolverConfig()).porEscena).toEqual([4]);
  });
});
