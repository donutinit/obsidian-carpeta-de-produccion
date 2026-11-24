import { describe, expect, it } from 'vitest';
import { CONFIG_POR_DEFECTO, resolverConfig } from '../src/motor/config';
import { DICCIONARIOS_MX } from '../src/motor/diccionarios';
import { CATEGORIAS } from '../src/motor/categorias';
import { textoPlano } from '../src/motor/enlinea';
import { analizar } from '../src/motor/fountain';
import { COLUMNAS, maquetar } from '../src/motor/maquetar';

const bloques = (fuente: string, cfg = CONFIG_POR_DEFECTO) => maquetar(analizar(fuente), cfg);

describe('config', () => {
  it('valores por defecto', () => {
    expect(CONFIG_POR_DEFECTO).toEqual({
      renglonesPorPagina: 54,
      espacioAntesEncabezado: 1,
      textoMas: '(MORE)',
      textoContinua: "(CONT'D)",
      conservarExtension: true,
      ultimaPaginaCompleta: false,
      diccionarios: DICCIONARIOS_MX,
      cronometraje: 'pagina',
      categorias: CATEGORIAS,
      personajesConocidos: [],
    });
  });

  it('resolverConfig completa y limita a 8 renglones como mínimo', () => {
    expect(resolverConfig({ textoMas: '(MÁS)' }).textoMas).toBe('(MÁS)');
    expect(resolverConfig({ textoMas: '(MÁS)' }).renglonesPorPagina).toBe(54);
    expect(resolverConfig({ renglonesPorPagina: 3 }).renglonesPorPagina).toBe(8);
    expect(resolverConfig().textoContinua).toBe("(CONT'D)");
  });
});

describe('maquetar', () => {
  it('columnas', () => {
    expect(COLUMNAS).toEqual({
      encabezado: { columna: 0, ancho: 60 },
      accion: { columna: 0, ancho: 60 },
      plano: { columna: 0, ancho: 60 },
      personaje: { columna: 20, ancho: 40 },
      acotacion: { columna: 15, ancho: 30 },
      dialogo: { columna: 10, ancho: 35 },
      letra: { columna: 10, ancho: 35 },
    });
  });

  it('diálogo en sus columnas', () => {
    const b = bloques('INT. A - DÍA\n\nFRANCISCO\n(nervioso)\nDame las llaves.\n')[1];
    expect(b.tipo).toBe('dialogo');
    expect(b.personaje).toEqual({ nombre: 'FRANCISCO' });
    expect(b.lineas.map((l) => [l.tipo, l.columna])).toEqual([['personaje', 20], ['acotacion', 15], ['dialogo', 10]]);
  });

  it('transición alineada a la derecha', () => {
    const t = bloques('INT. A - DÍA\n\nAlgo.\n\nCORTE A:\n\nINT. B - DÍA\n').find((b) => b.tipo === 'transicion')!;
    expect(textoPlano(t.lineas[0].segs)).toBe('CORTE A:');
    expect(t.lineas[0].columna).toBe(47);
  });

  it('centrado', () => {
    const c = bloques('INT. A - DÍA\n\n>FIN.<\n').find((b) => b.tipo === 'centrado')!;
    expect(c.lineas[0].columna).toBe(28);
  });

  it('mayúsculas', () => {
    const b = bloques('int. casa - día\n\n@ana\nHola.\n\n> corte a:\n');
    expect(textoPlano(b[0].lineas[0].segs)).toBe('INT. CASA - DÍA');
    expect(textoPlano(b[1].lineas[0].segs)).toBe('ANA');
    expect(textoPlano(b[2].lineas[0].segs)).toBe('CORTE A:');
  });

  it('espacio antes', () => {
    const fuente = 'INT. A - DÍA\n\nAlgo.\n\n!!PRIMER PLANO\n\nANA\nHola.\n\nCORTE A:\n\n>FIN.<\n';
    const uno = bloques(fuente);
    expect(uno.map((b) => [b.tipo, b.espacioAntes])).toEqual([
      ['encabezado', 1], ['accion', 1], ['plano', 1], ['dialogo', 1], ['transicion', 1], ['centrado', 1],
    ]);
    expect(bloques(fuente, resolverConfig({ espacioAntesEncabezado: 2 }))[0].espacioAntes).toBe(2);
  });

  it('primera línea de escena', () => {
    const b = bloques('INT. CASA DE FRANCISCO (HABITACIÓN) CON UN NOMBRE MUY LARGO QUE NO CABE - MAÑANA\n\nAlgo.\n');
    expect(b[0].lineas.length).toBe(2);
    expect(b[0].lineas[0]).toMatchObject({ primeraDeEscena: true, fuente: 0, escena: 0 });
    expect(b[0].lineas[1].primeraDeEscena).toBeUndefined();
  });

  it('acción de varias líneas conserva sus saltos y su línea fuente', () => {
    const b = bloques('INT. A - DÍA\n\nUno.\nDos.\n')[1];
    expect(b.lineas.map((l) => [textoPlano(l.segs), l.fuente])).toEqual([['Uno.', 2], ['Dos.', 3]]);
  });

  it('diálogo dual: un solo bloque con BETO a la derecha y sin el «^»', () => {
    const b = bloques('INT. A - DÍA\n\nANA\nHola.\n\nBETO ^\nAdiós.\n');
    expect(b.map((x) => x.tipo)).toEqual(['encabezado', 'dual']);
    expect(textoPlano(b[1].lineas[0].der!.segs)).toBe('BETO');
  });

  it('secciones y sinopsis no generan bloque; el salto sí, sin líneas', () => {
    const b = bloques('# Acto 1\n\n= Ana llega\n\nINT. A - DÍA\n\n===\n\nAlgo.\n');
    expect(b.map((x) => x.tipo)).toEqual(['encabezado', 'salto', 'accion']);
    expect(b[1].lineas).toEqual([]);
  });

  it('texto antes de la primera escena lleva escena -1', () => {
    const b = bloques('Nota suelta.\n\nINT. A - DÍA\n');
    expect(b[0].escena).toBe(-1);
    expect(b[0].lineas[0].escena).toBe(-1);
  });
});
