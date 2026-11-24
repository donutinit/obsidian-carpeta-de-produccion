import { describe, expect, it } from 'vitest';
import { alternarDual, construir, textoPlano, type Cambio } from '../src/motor';

const DUAL = 'INT. A - DÍA\n\nANA\nHola.\n\nBETO ^\nQué tal, cómo estás hoy en esta mañana tan fría.\n';
const aplicar = (t: string, c: Cambio | null) => (c ? t.slice(0, c.desde) + c.texto + t.slice(c.hasta) : t);

describe('diálogo dual', () => {
  it('dos bloques con ^ hacen un bloque dual con renglones lado a lado', () => {
    const g = construir(DUAL);
    expect(g.bloques.map((b) => b.tipo)).toEqual(['encabezado', 'dual']);
    const [p, d] = g.bloques[1].lineas;
    expect([p.tipo, p.columna, textoPlano(p.segs)]).toEqual(['personaje', 7, 'ANA']);
    expect([p.der?.tipo, p.der?.columna, textoPlano(p.der?.segs ?? [])]).toEqual(['personaje', 38, 'BETO']);
    expect([d.columna, textoPlano(d.segs)]).toEqual([0, 'Hola.']);
    expect(d.der?.columna).toBe(31);
    expect(g.bloques[1].lineas.length).toBeGreaterThan(2);
  });

  it('las columnas no se enciman', () => {
    const lineas = construir(DUAL).bloques[1].lineas;
    expect(lineas.filter((l) => l.der).length).toBeGreaterThan(2);
    for (const l of lineas) {
      if (!l.der) continue;
      expect(l.columna + textoPlano(l.segs).length).toBeLessThan(l.der.columna);
      expect(l.der.columna + textoPlano(l.der.segs).length).toBeLessThanOrEqual(60);
    }
  });

  it('un dual que no cabe pasa entero a la página siguiente', () => {
    const relleno = 'INT. A - DÍA\n\nUno.\n\nDos.\n\nTres.\n\n';
    const g = construir(relleno + DUAL.split('\n\n').slice(1).join('\n\n'), { renglonesPorPagina: 10 });
    const enPagina = g.paginas.map((p) => p.lineas.some((l) => l.der));
    expect(enPagina.filter(Boolean)).toHaveLength(1);
    const k = enPagina.indexOf(true);
    const duales = g.bloques.find((b) => b.tipo === 'dual')!.lineas.length;
    expect(g.paginas[k].lineas.filter((l) => l.der || l.tipo === 'personaje' || l.tipo === 'dialogo').length).toBeGreaterThanOrEqual(duales);
  });

  it('alternarDual pone y quita ^', () => {
    const sin = 'INT. A - DÍA\n\nANA\nHola.\n\nBETO\nQué.\n';
    const con = aplicar(sin, alternarDual(sin, sin.indexOf('Qué')));
    expect(con).toBe('INT. A - DÍA\n\nANA\nHola.\n\nBETO ^\nQué.\n');
    expect(aplicar(sin, alternarDual(sin, sin.indexOf('Hola')))).toBe(con);
    expect(aplicar(con, alternarDual(con, con.indexOf('BETO')))).toBe(sin);
    expect(alternarDual(sin, sin.indexOf('INT'))).toBeNull();
  });

  it('el breakdown cuenta a los dos personajes', () => {
    expect(construir(DUAL).breakdown[0].reparto).toEqual(['Ana', 'Beto']);
  });
});
