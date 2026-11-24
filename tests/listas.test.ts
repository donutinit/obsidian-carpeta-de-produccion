import { describe, expect, it } from 'vitest';
import { aCSV, construir, csvDesglose, csvElementos, csvLocaciones, csvReparto, listaElementos, listaLocaciones, listaReparto } from '../src/motor';

const F =
  'INT. CASA - COCINA - DÍA\n%%escena: dia_historia=1%%\n\nANA\nHola.\n\nToma la {ut:taza|Taza|2}.\n\n' +
  'EXT. CALLE - NOCHE\n\nBETO\nQué.\n\nAna corre.\n\n' +
  'INT. CASA - SALA - NOCHE\n\nANA\nYa.\n\nBETO\nNo.\n\n{ut:taza|Taza|3} rota y {ut:llave}.\n';
const g = construir(F);

describe('listas', () => {
  it('reparto con ID de tablero: 1 = más escenas', () => {
    expect(listaReparto(g).map(({ id, nombre, escenas }) => ({ id, nombre, escenas }))).toEqual([
      { id: 1, nombre: 'Ana', escenas: ['1', '2', '3'] },
      { id: 2, nombre: 'Beto', escenas: ['2', '3'] },
    ]);
    expect(listaReparto(g)[0].octavos).toBe(g.octavos.porEscena.reduce((a, b) => a + b, 0));
  });

  it('reparto con orden fijado en el proyecto', () => {
    expect(listaReparto(g, ['beto']).map((r) => [r.id, r.nombre])).toEqual([
      [1, 'Beto'],
      [2, 'Ana'],
    ]);
  });

  it('locaciones con complejo y set', () => {
    expect(listaLocaciones(g).map(({ complejo, set, intExt, escenas, reparto }) => ({ complejo, set, intExt, escenas, reparto }))).toEqual([
      { complejo: 'CASA', set: 'CASA - COCINA', intExt: ['INT.'], escenas: ['1'], reparto: ['Ana'] },
      { complejo: 'CALLE', set: 'CALLE', intExt: ['EXT.'], escenas: ['2'], reparto: ['Beto', 'Ana'] },
      { complejo: 'CASA', set: 'CASA - SALA', intExt: ['INT.'], escenas: ['3'], reparto: ['Ana', 'Beto'] },
    ]);
  });

  it('elementos con la cantidad máxima por escena', () => {
    expect(listaElementos(g)).toEqual([
      { codigo: 'ut', nombre: 'Taza', cantidad: 3, escenas: ['1', '3'] },
      { codigo: 'ut', nombre: 'Llave', cantidad: 1, escenas: ['3'] },
    ]);
    expect(listaElementos(g, 'vest')).toEqual([]);
  });
});

describe('CSV', () => {
  it('aCSV no deja fórmulas', () => {
    expect(aCSV([['=SUMA(A1)', '+1', '@x', '-2', 'ok']])).toBe("\uFEFF'=SUMA(A1),'+1,'@x,'-2,ok\r\n");
  });

  it('aCSV: BOM, comas, comillas y CRLF', () => {
    expect(aCSV([['a', 'b,c'], ['"x"', 1], ['dos\nlíneas', '']])).toBe('\uFEFFa,"b,c"\r\n"""x""",1\r\n"dos\nlíneas",\r\n');
  });

  it('las cuatro hojas llevan encabezado y una fila por renglón', () => {
    const filas = (s: string) => s.replace(/^\uFEFF/, '').trim().split('\r\n');
    const d = filas(csvDesglose(g));
    expect(d[0]).toMatch(/^Orden,Escena,INT\.\/EXT\.,Locación,Set,Complejo,Momento,Día de la historia,Largo \(pág\.\),Octavos,Duración,Segundos,En páginas,Reparto,Reparto \(ID\),/);
    expect(d).toHaveLength(4);
    expect(d[1]).toContain(',1,');
    // Sin «2/8» ni «1:30» sueltos: Excel y Hojas de cálculo los vuelven fechas u horas.
    expect(filas(csvReparto(g))).toEqual([
      'ID,Personaje,Número de escenas,Escenas,Largo (pág.),Octavos,Duración,Segundos',
      '1,Ana,3,"1, 2, 3",3/8 pág.,3,0 min 23 s,23',
      expect.stringMatching(/^2,Beto,2,"2, 3",2\/8 pág\.,2,0 min 15 s,15$/),
    ]);
    expect(filas(csvLocaciones(g))).toHaveLength(4);
    expect(filas(csvElementos(g))).toEqual(['Categoría,Elemento,Cantidad máxima,Número de escenas,Escenas', 'Utilería,Taza,3,2,"1, 3"', 'Utilería,Llave,1,1,3']);
  });
});
