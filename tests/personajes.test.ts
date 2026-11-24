import { describe, expect, it } from 'vitest';
import {
  analizar,
  beatsDeEscena,
  construir,
  creditos,
  cuesMusicales,
  escenasDePersonaje,
  fichaPersonaje,
  guionEpisodio,
  leerFrontmatter,
  numerosDeParlamento,
  propuestaSerie,
  vestuarioPorPersonaje,
} from '../src/motor';

const GUION = [
  'INT. SALA - NOCHE',
  '',
  'JULIA (25) entra con su llave. ANTONIO (30) sale del cuarto.',
  '',
  'JULIA',
  '¿Cómo está?',
  '',
  'ANTONIO',
  '(molesto)',
  '¿Para qué viniste? Te dije que no vinieras.',
  '',
  'Julia busca sus cigarros en la bolsa.',
  '',
  'JULIA',
  '¿Intentaste llamarme?',
  '',
  'EXT. CALLE - DÍA',
  '',
  'ANTONIO camina con {vest:traje|Antonio: Traje gris} y suena {mus:una cumbia|Cumbia de radio}.',
  '',
  'ANTONIO',
  'Ya voy.',
  '',
  'INT. SALA - NOCHE',
  '',
  'JULIA lleva {vest:impermeable|Julia: Impermeable mojado} y ANTONIO {vest:camisa|Antonio: Camisa arrugada}. Suena {mus:el radio|Bolero}.',
  '',
  'JULIA',
  'Adiós.',
].join('\n');

describe('parlamentos', () => {
  it('se numeran por escena, en la línea del nombre', () => {
    expect(numerosDeParlamento(analizar(GUION))).toEqual([
      { linea: 4, escena: 0, numero: 1 },
      { linea: 7, escena: 0, numero: 2 },
      { linea: 13, escena: 0, numero: 3 },
      { linea: 20, escena: 1, numero: 1 },
      { linea: 27, escena: 2, numero: 1 },
    ]);
  });

  it('la hoja de beats de una escena: acciones sin número y parlamentos numerados con quien habla', () => {
    const b = beatsDeEscena(construir(GUION), 0);
    expect(b).toEqual([
      { numero: null, beat: 'JULIA (25) entra con su llave. ANTONIO (30) sale del cuarto.', quien: '' },
      { numero: 1, beat: 'Julia: ¿Cómo está?', quien: 'Julia' },
      { numero: 2, beat: 'Antonio: ¿Para qué viniste? Te dije que no vinieras.', quien: 'Antonio' },
      { numero: null, beat: 'Julia busca sus cigarros en la bolsa.', quien: '' },
      { numero: 3, beat: 'Julia: ¿Intentaste llamarme?', quien: 'Julia' },
    ]);
  });
});

describe('personajes', () => {
  it('la ficha trae propiedades, vida interior y exterior, análisis, casting y el bloque de sus escenas', () => {
    const f = fichaPersonaje('Julia');
    expect(leerFrontmatter(f)).toMatchObject({ carpeta: 'personaje', personaje: 'JULIA' });
    for (const s of ['## Vida interior', '## Vida exterior', '11. Noluntad', '## Hechos, preguntas e imágenes', '## Análisis de escena', '11) Ajustes', '## Casting', '| Candidato | Naturalidad | Credibilidad | Dicción | Maleabilidad | Presencia | Total |', '```carpeta-personaje'])
      expect(f, s).toContain(s);
  });

  it('las escenas de un personaje con sus parlamentos', () => {
    const e = escenasDePersonaje(construir(GUION), 'Antonio');
    expect(e.map((x) => [x.escena, x.encabezado, x.parlamentos])).toEqual([
      ['1', 'INT. SALA - NOCHE', 1],
      ['2', 'EXT. CALLE - DÍA', 1],
      ['3', 'INT. SALA - NOCHE', 0],
    ]);
  });

  it('vestuario por personaje con códigos de cambio en orden de aparición', () => {
    const v = vestuarioPorPersonaje(construir(GUION));
    expect(v).toEqual([
      { personaje: 'Antonio', cambios: [
        { codigo: 'A1', nombre: 'Traje gris', categoria: 'vest', escenas: ['2'] },
        { codigo: 'A2', nombre: 'Camisa arrugada', categoria: 'vest', escenas: ['3'] },
      ] },
      { personaje: 'Julia', cambios: [{ codigo: 'J1', nombre: 'Impermeable mojado', categoria: 'vest', escenas: ['3'] }] },
    ]);
  });

  it('cues musicales numerados', () => {
    expect(cuesMusicales(construir(GUION))).toEqual([
      { cue: 'M1', escena: '2', nombre: 'Cumbia de radio' },
      { cue: 'M2', escena: '3', nombre: 'Bolero' },
    ]);
  });
});

describe('créditos', () => {
  it('agrupa el equipo por puesto y el reparto con su actor', () => {
    const c = creditos(
      ['Diego Ayala · 2223346 · Dirección', 'Mía Cabrera · Producción', 'Elisa Maldonado · Sonido, edición de sonido', 'Ana Ruiz · Producción', 'Nombre · Matrícula · Rol'],
      [
        { personaje: 'Julia', actor: 'Kaia Betancourt' },
        { personaje: 'Antonio', actor: '' },
      ],
    );
    expect(c.equipo).toEqual([
      { puesto: 'Dirección', nombres: ['Diego Ayala'] },
      { puesto: 'Producción', nombres: ['Mía Cabrera', 'Ana Ruiz'] },
      { puesto: 'Sonido, edición de sonido', nombres: ['Elisa Maldonado'] },
    ]);
    expect(c.reparto).toEqual([{ personaje: 'Julia', actor: 'Kaia Betancourt' }]);
  });
});

describe('serie', () => {
  it('la propuesta trae las partes del PIA y el episodio es un guion de la serie', () => {
    const p = propuestaSerie('Consenso, S.A.');
    expect(leerFrontmatter(p)).toMatchObject({ carpeta: 'serie', titulo: 'Consenso, S.A.' });
    for (const s of ['## Argumento', '## Arco de la temporada', '## Personajes', '## Episodios', '### Apertura en frío', '### Remate', '## Esencia de la serie', '## Propuesta de intro']) expect(p, s).toContain(s);
    const e = guionEpisodio('Consenso, S.A.', 2);
    expect(leerFrontmatter(e)).toMatchObject({ carpeta: 'guion', proyecto: 'Consenso, S.A.', episodio: '2' });
    expect(construir(e).doc.portada.title).toEqual(['Consenso, S.A. · Episodio 2']);
  });
});

describe('revisión de 0.5', () => {
  it('I2: los personajes del guion incluyen a quien solo habla en V.O., pero no a TODOS', async () => {
    const { personajesDelGuion } = await import('../src/motor');
    const g = construir('INT. A - DÍA\n\nANA entra.\n\nANA\nHola.\n\nNARRADOR (V.O.)\nEra otra época.\n\nTODOS\n¡Bravo!\n');
    expect(personajesDelGuion(g)).toEqual(['Ana', 'Narrador']);
    expect(personajesDelGuion(construir('INT. A - DÍA\n\nEntran {rep:los dos|Piloto y Copiloto}.\n'))).toEqual(['Piloto y Copiloto']);
    expect(escenasDePersonaje(g, 'Narrador').map((e) => [e.escena, e.parlamentos])).toEqual([['1', 1]]);
  });

  it('I3: códigos de cambio sin choques: Ana, Antonio, Andrés; Hombre 1, 2 y 3', () => {
    const marcas = (n: string) => `INT. A - DÍA\n\n${n
      .split(',')
      .map((x) => `${x.toUpperCase()} lleva {vest:ropa|${x}: Ropa}.`)
      .join(' ')}\n\n${n
      .split(',')
      .map((x) => `${x.toUpperCase()}\nHola.\n`)
      .join('\n')}`;
    const a = vestuarioPorPersonaje(construir(marcas('Ana,Antonio,Andrés'))).map((p) => p.cambios[0].codigo);
    expect(new Set(a).size).toBe(3);
    const h = vestuarioPorPersonaje(construir(marcas('Hombre 1,Hombre 2,Hombre 3'))).map((p) => p.cambios[0].codigo);
    expect(new Set(h).size).toBe(3);
  });

  it('I4: «Personaje: prenda» solo cuenta si el nombre es de un personaje; acentos no lo duplican', () => {
    const t =
      'INT. A - DÍA\n\nMARÍA lleva {vest:reloj|Reloj: dorado} y {vest:uniforme|Uniforme 10:30} y {vest:vestido|Maria: Vestido rojo} y {vest:chal|María: Chal}.\n\nMARÍA\nHola.\n';
    const v = vestuarioPorPersonaje(construir(t));
    expect(v.map((p) => p.personaje)).toEqual(['María']);
    expect(v[0].cambios.map((c) => c.nombre)).toEqual(['Vestido rojo', 'Chal']);
  });

  it('I5: créditos con apellidos con guion, sin puesto, sin espacios y matrícula al final', () => {
    const c = creditos(['Juan Pérez - García · 318 · Sonido', 'Rita Paz · 321', 'Sol·322·Arte', 'Eva   Gil · Foto'], []);
    expect(c.equipo).toEqual([
      { puesto: 'Sonido', nombres: ['Juan Pérez - García'] },
      { puesto: 'Equipo', nombres: ['Rita Paz'] },
      { puesto: 'Arte', nombres: ['Sol'] },
      { puesto: 'Foto', nombres: ['Eva Gil'] },
    ]);
  });

  it('menor: un parlamento que solo es letra de canción tiene su beat', () => {
    const b = beatsDeEscena(construir('INT. A - DÍA\n\nANA\n~Cielito lindo\n'), 0);
    expect(b).toEqual([{ numero: 1, beat: 'Ana: ♪ Cielito lindo', quien: 'Ana' }]);
  });
});
