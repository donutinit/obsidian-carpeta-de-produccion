import { describe, expect, it } from 'vitest';
import {
  abreviaturasDeNota,
  ABREVIATURAS_POR_DEFECTO,
  celdaDeTabla,
  construir,
  escribirTecnica,
  LISTAS_TECNICAS,
  leerTecnica,
  listasDePropiedades,
  opcionesDeEscena,
  ponerAbreviatura,
  rellenoDeFila,
  tipoDeCelda,
} from '../src/motor';

const TECNICO = [
  '## Abreviaturas', //                                                         0
  '',
  '| Abreviatura | Plano |', //                                                 2
  '|---|---|',
  '| G.P.G. | Gran plano general |',
  '| P.M.C. | Plano medio corto |',
  '| P.P. | Primer plano |',
  '| P.P.P. | Primerísimo primer plano |',
  '| — | — |',
  '',
  '| Escena | N. de plano | Plano | Movimiento | Ángulo | Lente | Descripción técnica | Inicio |', // 10
  '|---:|---:|---|---|---|---|---|---|',
  '| — | 1 | P.M.C. Sobre el hombro de Ana | — | — | — | 35mm, paneo, picada, con slider | — |',
  '',
  '| Esc. | Set | INT/EXT | D/N | Talentos | Planos |', //                    14
  '|---:|---|---|---|---|---:|',
  '| — | — |  | NOCHE | — | 3 |',
].join('\n');

const tipo = (l: number, f: number, c: number) => tipoDeCelda(celdaDeTabla(TECNICO, l, f, c)!);

describe('tipo de celda por su columna', () => {
  it('escena, plano, movimiento, ángulo, lente, descripción técnica y fecha', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((c) => tipo(10, 0, c))).toEqual(['escena', null, 'plano', 'movimiento', 'angulo', 'lente', 'tecnica', 'fecha']);
    expect(tipo(14, 0, 0)).toBe('escena');
    expect([1, 2, 3, 4, 5].map((c) => tipo(14, 0, c))).toEqual([null, null, null, null, null]);
  });

  it('SC y «No. de escena» también son escena; «Planos» y «N. de plano» no son plano', () => {
    const t = '| SC | No. de escena | Planos | N. de plano | Tipo de plano |\n|---|---|---|---|---|\n| a | b | c | d | e |';
    expect([0, 1, 2, 3, 4].map((c) => tipoDeCelda(celdaDeTabla(t, 0, 0, c)!))).toEqual(['escena', 'escena', null, null, 'plano']);
  });
});

describe('abreviaturas de plano', () => {
  it('las lee de la tabla «Abreviatura | Plano» de la nota, sin renglones vacíos', () => {
    expect(abreviaturasDeNota(TECNICO)).toEqual([
      { abreviatura: 'G.P.G.', nombre: 'Gran plano general' },
      { abreviatura: 'P.M.C.', nombre: 'Plano medio corto' },
      { abreviatura: 'P.P.', nombre: 'Primer plano' },
      { abreviatura: 'P.P.P.', nombre: 'Primerísimo primer plano' },
    ]);
    expect(abreviaturasDeNota('| a | b |\n|---|---|\n| c | d |')).toBeNull();
    expect(ABREVIATURAS_POR_DEFECTO.map((a) => a.abreviatura)).toEqual(['G.P.G.', 'P.G.', 'P.E.', 'P.A.', 'P.M.', 'P.M.C.', 'P.P.', 'P.P.P.', 'P.D.']);
  });

  it('cambia solo la abreviatura y conserva la descripción', () => {
    const conocidas = ['G.P.G.', 'P.M.C.', 'P.P.', 'P.P.P.'];
    expect(ponerAbreviatura('P.M.C. Sobre el hombro de Ana', 'P.P.', conocidas)).toBe('P.P. Sobre el hombro de Ana');
    expect(ponerAbreviatura('P.P.P. Ojos de Ana', 'P.P.', conocidas)).toBe('P.P. Ojos de Ana');
    expect(ponerAbreviatura('P.P. Ojos de Ana', 'P.P.P.', conocidas)).toBe('P.P.P. Ojos de Ana');
    expect(ponerAbreviatura('Sobre el hombro de Ana', 'P.M.C.', conocidas)).toBe('P.M.C. Sobre el hombro de Ana');
    expect(ponerAbreviatura('—', 'G.P.G.', conocidas)).toBe('G.P.G.');
    expect(ponerAbreviatura('', 'G.P.G.', conocidas)).toBe('G.P.G.');
    expect(ponerAbreviatura('P.P.', 'P.M.C.', conocidas)).toBe('P.M.C.');
  });
});

describe('descripción técnica', () => {
  it('reconoce lente, movimiento y ángulo, y conserva lo demás', () => {
    expect(leerTecnica('35mm, paneo, picada, con slider', LISTAS_TECNICAS)).toEqual({ lente: '35 mm', movimiento: 'paneo', angulo: 'picada', resto: ['con slider'] });
    expect(leerTecnica('Tilt · CENITAL', LISTAS_TECNICAS)).toEqual({ movimiento: 'tilt', angulo: 'cenital', resto: [] });
    expect(leerTecnica('—', LISTAS_TECNICAS)).toEqual({ resto: [] });
  });

  it('escribe en orden lente · movimiento · ángulo · lo demás', () => {
    expect(escribirTecnica({ lente: '50 mm', movimiento: 'travelling', angulo: 'normal', resto: ['con slider'] })).toBe('50 mm · travelling · normal · con slider');
    expect(escribirTecnica({ movimiento: 'fija', resto: [] })).toBe('fija');
    expect(escribirTecnica({ resto: [] })).toBe('—');
  });

  it('las listas se cambian en las propiedades del proyecto; vacías o ausentes, las de fábrica', () => {
    const l = listasDePropiedades({ movimientos: ['fija', ' paneo ', ''], lentes: '24 mm, 50 mm', angulos: [] });
    expect(l.movimientos).toEqual(['fija', 'paneo']);
    expect(l.lentes).toEqual(['24 mm', '50 mm']);
    expect(l.angulos).toEqual(LISTAS_TECNICAS.angulos);
    expect(LISTAS_TECNICAS.movimientos.slice(0, 6)).toEqual(['fija', 'paneo', 'tilt', 'travelling', 'dolly in', 'dolly out']);
  });
});

const GUION = [
  '---',
  'carpeta: guion',
  '---',
  'INT. CASA DE ANA - SALA - NOCHE #5A#',
  '',
  'ANA está sola.',
  '',
  'ANA',
  'Hola.',
  '',
  'BETO',
  'Hola, Ana.',
  '',
  'EXT. CALLE - DÍA',
  '',
  'Pasa un coche.',
].join('\n');

describe('escenas del guion', () => {
  it('número (con el fijo), encabezado, INT/EXT, locación, momento, reparto y octavos', () => {
    const [a, b] = opcionesDeEscena(construir(GUION));
    expect(a).toMatchObject({ numero: '5A', encabezado: 'INT. CASA DE ANA - SALA - NOCHE', intExt: 'INT.', locacion: 'CASA DE ANA - SALA', momento: 'NOCHE', reparto: ['Ana', 'Beto'] });
    expect(a.octavos).toMatch(/\/8$/);
    expect(b).toMatchObject({ numero: construir(GUION).doc.escenas[1].numero, intExt: 'EXT.', locacion: 'CALLE', momento: 'DÍA', reparto: [] });
  });

  it('al elegir la escena, llena solo las celdas vacías de la fila que salen del guion', () => {
    const op = opcionesDeEscena(construir(GUION))[0];
    const cambios = rellenoDeFila(TECNICO, 14, 0, 0, op);
    let t = TECNICO;
    for (const c of [...cambios].sort((x, y) => y.desde - x.desde)) t = t.slice(0, c.desde) + c.texto + t.slice(c.hasta);
    expect(t.split('\n')[16]).toBe('| 5A | CASA DE ANA - SALA | INT. | NOCHE | Ana, Beto | 3 |');
    expect(cambios.map((c) => c.desde)).toEqual([...cambios.map((c) => c.desde)].sort((x, y) => x - y));
  });

  it('en el guion técnico solo cambia la escena: no hay columnas que salgan del guion', () => {
    const op = opcionesDeEscena(construir(GUION))[1];
    expect(rellenoDeFila(TECNICO, 10, 0, 0, op)).toHaveLength(1);
  });
});

describe('revisión de publicación', () => {
  it('I3: el guion de una nota es el de su carpeta o el de la carpeta de arriba más cercana, nunca uno de un proyecto vecino', async () => {
    const { guionMasCercano } = await import('../src/motor');
    const guiones = ['Plantillas/Proyecto nuevo/02 - Guion.md', 'Proyectos/A/02 - Guion.md', 'Proyectos/B/02 - Guion.md'];
    expect(guionMasCercano('Proyectos/A/12 - Guion técnico.md', guiones)).toBe('Proyectos/A/02 - Guion.md');
    expect(guionMasCercano('Proyectos/A/Escenas/Escena 1.md', guiones)).toBe('Proyectos/A/02 - Guion.md');
    expect(guionMasCercano('Proyectos/Notas sueltas.md', guiones)).toBeNull();
    expect(guionMasCercano('Raíz.md', guiones)).toBeNull();
    expect(guionMasCercano('Raíz.md', ['Guion.md'])).toBe('Guion.md');
  });

  it('I4: el filtro de una lista busca en lo que se ve, no en el detalle; el número exacto va primero', async () => {
    const { filtrarOpciones } = await import('../src/motor');
    const ops = [
      { valor: '1', etiqueta: '1. INT. A - DÍA', detalle: '1 3/8' },
      { valor: '3', etiqueta: '3. EXT. CALLE - NOCHE', detalle: '2/8' },
      { valor: '13', etiqueta: '13. INT. B - DÍA', detalle: '1/8' },
    ];
    expect(filtrarOpciones(ops, '3').map((o) => o.valor)).toEqual(['3', '13']);
    expect(filtrarOpciones(ops, 'calle').map((o) => o.valor)).toEqual(['3']);
    expect(filtrarOpciones(ops, '').map((o) => o.valor)).toEqual(['1', '3', '13']);
  });

  it('I5: en una columna de una sola lista se cambia solo el valor reconocido y se conserva lo demás', async () => {
    const { ponerValor } = await import('../src/motor');
    const movs = LISTAS_TECNICAS.movimientos;
    expect(ponerValor('paneo lento siguiendo a Ana', 'tilt', movs)).toBe('tilt lento siguiendo a Ana');
    expect(ponerValor('Siguiendo a Ana', 'tilt', movs)).toBe('tilt · Siguiendo a Ana');
    expect(ponerValor('—', 'tilt', movs)).toBe('tilt');
    expect(ponerValor('Dolly in hacia Ana', 'paneo', movs)).toBe('paneo hacia Ana');
  });

  it('I6: la descripción técnica no rompe decimales con coma, enlaces ni el texto que no reconoce', () => {
    const l = LISTAS_TECNICAS;
    expect(leerTecnica('12,5 mm · paneo', l)).toMatchObject({ lente: '12,5 mm', movimiento: 'paneo' });
    expect(escribirTecnica(leerTecnica('[[Refs, plano 3]] · paneo', l))).toBe('paneo · [[Refs, plano 3]]');
    expect(escribirTecnica(leerTecnica('Juan entra, se sienta', l))).toBe('Juan entra, se sienta');
    expect(escribirTecnica(leerTecnica('35mm, paneo, picada, con slider', l))).toBe('35 mm · paneo · picada · con slider');
  });

  it('I7: la columna Plano de la tabla de abreviaturas no abre el panel de planos', () => {
    const t = '| Abreviatura | Plano |\n|---|---|\n| P.G. | Plano general |';
    expect(tipoDeCelda(celdaDeTabla(t, 0, 0, 1)!, t, 0)).toBeNull();
    expect(tipoDeCelda(celdaDeTabla(TECNICO, 10, 0, 2)!, TECNICO, 10)).toBe('plano');
  });
});
