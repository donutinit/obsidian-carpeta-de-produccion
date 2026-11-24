import { describe, expect, it } from 'vitest';
import { armarLlamado, armarPlan, construir, datosDeDias, diasDelPlan, horaTexto, leerHora, planosCompletos } from '../src/motor';

const GUION = [
  'INT. CASA DE ANA - SALA - NOCHE',
  '',
  'ANA (30) espera. BETO (32) entra.',
  '',
  'ANA',
  'Llegas tarde.',
  '',
  'EXT. CALLE - DÍA',
  '',
  'BETO corre.',
  '',
  'BETO',
  '¡Espera!',
  '',
  'INT. OFICINA - DÍA',
  '',
  'CARLA (50) firma papeles.',
].join('\n');

const TECNICO = [
  '| Escena | N. de plano | Plano | Descripción técnica | Acciones | Sonido | Duración | Tiempo de grabación |',
  '|---:|---:|---|---|---|---|---:|---:|',
  '| 1 | 1 | P.G. | 24 mm · fija | Ana espera | Ambiente | 0:20 | 45 |',
  '| 1 | 2 | P.P. | 50 mm · fija | Ana habla | Diálogo | 0:05 | |',
  '| 2 | 1 | P.G. | 35 mm · en mano | Beto corre | Pasos | 0:08 | 1:15 |',
].join('\n');

const LISTA = [
  '## Orden de rodaje',
  '',
  '| Día | Horario | Esc. | Set | Planos |',
  '|---:|---|---:|---|---:|',
  '| 1 | — | 2 | — | — |',
  '| 1 | — | 1 | — | — |',
  '| 2 | — | 3, 1 | — | — |',
  '| | | | **Total** | — |',
  '',
  '## Día 1',
  '',
  '| Dato | Valor |',
  '|---|---|',
  '| Fecha | 10/02/2027 |',
  '| Primera toma | 9:00 AM |',
  '',
  '## Día 2',
  '',
  '| Dato | Valor |',
  '|---|---|',
  '| Fecha | — |',
  '| Primera toma | — |',
].join('\n');

describe('horas', () => {
  it('lee 9:00, 09:00, 9:00 AM, 3:45 PM, 12:30 PM y 15:45 en minutos; lo demás es null', () => {
    expect(['9:00', '09:00', '9:00 AM', '3:45 PM', '12:30 PM', '12:10 AM', '15:45', '9 am', '—', 'mañana'].map(leerHora)).toEqual([540, 540, 540, 945, 750, 10, 945, 540, null, null]);
  });
  it('escribe en 24 horas', () => {
    expect([540, 945, 1439, 1500].map(horaTexto)).toEqual(['9:00', '15:45', '23:59', '1:00 (+1)']);
  });
});

describe('lo que escribe la persona', () => {
  it('días con sus escenas en orden, de la tabla con Día y Esc.; acepta varias escenas en una celda', () => {
    expect(diasDelPlan(LISTA)).toEqual([
      { dia: 1, escenas: ['2', '1'] },
      { dia: 2, escenas: ['3', '1'] },
    ]);
  });
  it('los datos de cada día: fecha y primera toma, de la tabla Dato | Valor bajo «Día N»', () => {
    const d = datosDeDias(LISTA);
    expect(d.get(1)).toEqual({ fecha: '10/02/2027', primeraToma: 540 });
    expect(d.get(2)).toEqual({});
  });
  it('los planos completos del guion técnico', () => {
    const p = planosCompletos(TECNICO);
    expect(p).toHaveLength(3);
    expect(p[0]).toMatchObject({ escena: '1', numero: '1', plano: 'P.G.', tecnica: '24 mm · fija', acciones: 'Ana espera', sonido: 'Ambiente', minutos: 45 });
    expect(p[1].minutos).toBeNull();
    expect(p[2].minutos).toBe(75);
  });
});

describe('plan de rodaje de un día', () => {
  const g = construir(GUION);
  const opciones = { minutosPorPlano: 30, minutosPorOctavo: 10, minutosComida: 60, comidaTras: 360 };

  it('los planos de sus escenas en el orden del día, con hora, duración, set y talento', () => {
    const p = armarPlan(g, diasDelPlan(LISTA)[0], datosDeDias(LISTA).get(1)!, planosCompletos(TECNICO), opciones);
    expect(p.filas.map((f) => [horaTexto(f.hora), f.minutos, f.escena, f.numero, f.plano])).toEqual([
      ['9:00', 75, '2', '1', 'P.G.'],
      ['10:15', 45, '1', '1', 'P.G.'],
      ['11:00', 30, '1', '2', 'P.P.'],
    ]);
    expect(p.filas[1]).toMatchObject({ set: 'CASA DE ANA - SALA', intExt: 'INT.', momento: 'NOCHE', talentos: ['Ana', 'Beto'] });
    expect(p).toMatchObject({ primeraToma: 540, llamadoCrew: 420, fin: 690 });
  });

  it('una escena sin planos en el guion técnico va completa, con tiempo por octavos', () => {
    const p = armarPlan(g, diasDelPlan(LISTA)[1], {}, planosCompletos(TECNICO), opciones);
    expect(p.filas[0]).toMatchObject({ escena: '3', numero: '', plano: 'Escena completa', minutos: 30, hora: 480 });
    expect(p.primeraToma).toBe(480);
  });

  it('la comida entra después de seis horas de rodaje', () => {
    const largo = Array.from({ length: 14 }, (_, k) => `| 1 | ${k + 1} | P.M. | — | — | — | — | |`).join('\n');
    const tecnico = TECNICO.split('\n').slice(0, 2).join('\n') + '\n' + largo;
    const p = armarPlan(g, { dia: 1, escenas: ['1'] }, { primeraToma: 480 }, planosCompletos(tecnico), opciones);
    const k = p.filas.findIndex((f) => f.comida);
    expect(k).toBe(12);
    expect(horaTexto(p.filas[k].hora)).toBe('14:00');
    expect(horaTexto(p.filas[k + 1].hora)).toBe('15:00');
  });

  it('una escena que no existe en el guion se anota y no rompe el plan', () => {
    const p = armarPlan(g, { dia: 1, escenas: ['9'] }, {}, [], opciones);
    expect(p.faltantes).toEqual(['9']);
    expect(p.filas).toEqual([]);
  });
});

describe('hoja de llamado', () => {
  it('escenas del día y llamado de cada personaje una hora antes de su primer plano', () => {
    const g = construir(GUION);
    const plan = armarPlan(g, diasDelPlan(LISTA)[0], datosDeDias(LISTA).get(1)!, planosCompletos(TECNICO), { minutosPorPlano: 30, minutosPorOctavo: 10, minutosComida: 60, comidaTras: 360 });
    const l = armarLlamado(g, plan);
    expect(l.escenas).toEqual([
      { escena: '2', set: 'CALLE', momento: 'DÍA', personajes: ['Beto'], planos: 1, octavos: '1/8', horario: '9:00–10:15' },
      { escena: '1', set: 'CASA DE ANA - SALA', momento: 'NOCHE', personajes: ['Ana', 'Beto'], planos: 2, octavos: '1/8', horario: '10:15–11:30' },
    ]);
    expect(l.reparto).toEqual([
      { personaje: 'Beto', llamado: 480, primerPlano: 540 },
      { personaje: 'Ana', llamado: 555, primerPlano: 615 },
    ]);
  });
});

describe('tabla para copiar', () => {
  it('escapa las barras y deja las celdas vacías como un espacio', async () => {
    const { tablaMarkdown } = await import('../src/motor');
    expect(tablaMarkdown(['A', 'B'], [['uno | dos', ''], ['x', 'y']])).toBe('| A | B |\n|---|---|\n| uno \\| dos | |\n| x | y |\n');
  });
});

describe('revisión de 0.4', () => {
  it('I2: más formas de escribir el tiempo de grabación', async () => {
    const { leerMinutos } = await import('../src/motor');
    expect(['45 min.', '30 mins', '1h30', '1 h.', '1:5', '1.5 h'].map(leerMinutos)).toEqual([45, 30, 90, 60, 65, 90]);
  });

  it('I3: más formas de escribir la hora', () => {
    expect(['9', '9h', '9 h', '9:00 hrs', '9:00 h', '09.00', '9h00', '21:30 hrs'].map(leerHora)).toEqual([540, 540, 540, 540, 540, 540, 540, 1290]);
  });

  it('I3: los datos del día aunque la tabla no sea la primera, con subtítulos y dos puntos; el llamado que escribe la persona manda', () => {
    const t = '## Día 1\n\n### Horario\n\n| Horario | Esc. |\n|---|---|\n| — | — |\n\n### Datos\n\n| Dato | Valor |\n|---|---|\n| Primera toma: | 9h |\n| Llamado de crew | 6:30 |\n\n## Día 2\n\n| Dato | Valor |\n|---|---|\n| Llamado general | 7:00 |\n';
    const d = datosDeDias(t);
    expect(d.get(1)).toEqual({ primeraToma: 540, llamado: 390 });
    expect(d.get(2)).toEqual({ llamado: 420 });
    const p = armarPlan(construir(GUION), { dia: 1, escenas: ['1'] }, d.get(1)!, [], { minutosPorPlano: 30, minutosPorOctavo: 10, minutosComida: 60, comidaTras: 360 });
    expect(p.llamadoCrew).toBe(390);
  });

  it('I4: una escena repetida en el día se programa una vez y se avisa', () => {
    const p = armarPlan(construir(GUION), { dia: 1, escenas: ['2', '1', '2'] }, {}, planosCompletos(TECNICO), { minutosPorPlano: 30, minutosPorOctavo: 10, minutosComida: 60, comidaTras: 360 });
    expect(p.filas.map((f) => f.escena)).toEqual(['2', '1', '1']);
    expect(p.repetidas).toEqual(['2']);
  });

  it('menores: «**1**» y «Día 3» en la columna Día, «3 y 1», «5 A»', () => {
    const t = '| Día | Esc. |\n|---|---|\n| **1** | 3 y 1 |\n| Día 3 | 5 A |\n';
    expect(diasDelPlan(t)).toEqual([
      { dia: 1, escenas: ['3', '1'] },
      { dia: 3, escenas: ['5 A'] },
    ]);
    const g = construir('INT. A - DÍA #5A#\n\nAlgo.\n');
    expect(armarPlan(g, { dia: 3, escenas: ['5 A'] }, {}, [], { minutosPorPlano: 30, minutosPorOctavo: 10, minutosComida: 60, comidaTras: 360 }).faltantes).toEqual([]);
  });

  it('menores: horas antes de la medianoche y comida en 0 para quitarla', () => {
    expect(horaTexto(-90)).toBe('22:30 (−1)');
    const largo = Array.from({ length: 14 }, (_, k) => `| 1 | ${k + 1} | P.M. | — | — | — | — | |`).join('\n');
    const tecnico = TECNICO.split('\n').slice(0, 2).join('\n') + '\n' + largo;
    const p = armarPlan(construir(GUION), { dia: 1, escenas: ['1'] }, { primeraToma: 480 }, planosCompletos(tecnico), { minutosPorPlano: 30, minutosPorOctavo: 10, minutosComida: 0, comidaTras: 360 });
    expect(p.filas.some((f) => f.comida)).toBe(false);
  });
});
