import { describe, expect, it } from 'vitest';
import { armarTiming, construir, formatearMinutos, leerDuracion, planosDeTecnico, timingMarkdown } from '../src/motor';

const GUION = [
  '---',
  'carpeta: guion',
  '---',
  'INT. CASA DE ANA - SALA - NOCHE',
  '',
  '= Ana espera a Beto.',
  '',
  'ANA está sola. Mira el reloj.',
  '',
  'EXT. CALLE - DÍA',
  '',
  'Pasa un coche. Beto corre detrás de él por toda la calle sin alcanzarlo nunca.',
].join('\n');

const TECNICO = [
  '## Escena 1',
  '',
  '| Escena | N. de plano | Plano | Duración | Tiempo total |',
  '|---:|---:|---|---:|---:|',
  '| 1 | 1 | P.G. | 0:06 | 0:06 |',
  '| 1 | 2 | P.P. | 0:04 | 0:10 |',
  '| — | 3 | — | — | — |',
  '',
  '| Esc. | Set | Planos | Duración |',
  '|---:|---|---:|---:|',
  '| 1 | SALA | 2 | 0:10 |',
].join('\n');

describe('duraciones', () => {
  it('lee m:ss, h:mm:ss, segundos y minutos; lo demás es null', () => {
    expect(['0:06', '1:05', '1:02:03', '6', '6 s', '2 min', '—', '', 'mucho'].map(leerDuracion)).toEqual([6, 65, 3723, 6, 6, 120, null, null, null]);
  });

  it('escribe minutos y segundos', () => {
    expect([0, 6, 65, 314, 3723].map(formatearMinutos)).toEqual(['0:00', '0:06', '1:05', '5:14', '62:03']);
  });
});

describe('planos del guion técnico', () => {
  it('lee las tablas con Escena y Duración, una fila por plano; no la tabla de resumen ni filas sin escena', () => {
    expect(planosDeTecnico(TECNICO)).toEqual([
      { escena: '1', duracion: 6 },
      { escena: '1', duracion: 4 },
    ]);
  });
});

describe('timing', () => {
  it('una fila por escena con set, acciones, páginas, octavos, planos, tiempo y acumulado', () => {
    const g = construir(GUION);
    const t = armarTiming(g, planosDeTecnico(TECNICO));
    expect(t.filas).toHaveLength(2);
    expect(t.filas[0]).toMatchObject({ escena: '1', set: 'INT. CASA DE ANA - SALA - NOCHE', acciones: 'Ana espera a Beto.', paginas: '1', planos: 2, segundos: 10, estimado: false, acumulado: 10 });
    expect(t.filas[1]).toMatchObject({ escena: '2', set: 'EXT. CALLE - DÍA', planos: 0, estimado: true });
    expect(t.filas[1].acciones.startsWith('Pasa un coche.')).toBe(true);
    expect(t.filas[1].segundos).toBeGreaterThan(0);
    expect(t.filas[1].acumulado).toBe(10 + t.filas[1].segundos);
    expect(t.total).toMatchObject({ escenas: 2, paginas: 1, planos: 2, segundos: t.filas[1].acumulado });
  });

  it('sin guion técnico: planos vacíos y todo el tiempo estimado por los octavos o el texto', () => {
    const t = armarTiming(construir(GUION), null);
    expect(t.filas.every((f) => f.planos === null && f.estimado)).toBe(true);
    expect(t.total.planos).toBeNull();
  });

  it('como tabla Markdown, con el renglón de total', () => {
    const md = timingMarkdown(armarTiming(construir(GUION), planosDeTecnico(TECNICO)));
    const lineas = md.trim().split('\n');
    expect(lineas[0]).toBe('| Esc. | Set | Acciones | Pág. | Octavos | Planos | Tiempo aprox. | Acumulado |');
    expect(lineas[2]).toMatch(/^\| 1 \| INT\. CASA DE ANA - SALA - NOCHE \| Ana espera a Beto\. \| 1 \| 1\/8 \| 2 \| 0:10 \| 0:10 \|$/);
    expect(lineas[3]).toMatch(/^\| 2 \| EXT\. CALLE - DÍA \| .* \| ≈ \d+:\d\d \| \d+:\d\d \|$/);
    expect(lineas[4]).toMatch(/^\| 2 escenas \| \*\*Total\*\* \| \| 1 \| 2\/8 \| 2 \| \d+:\d\d \| [\d.]+ min \|$/);
  });

  it('una barra en las acciones no rompe la tabla', () => {
    const g = construir('INT. A - DÍA\n\n= Uno | dos.\n');
    expect(timingMarkdown(armarTiming(g, null))).toContain('Uno \\| dos.');
  });
});

describe('revisión de 0.4', () => {
  it('I1: comillas de minutos y segundos, «seg.» y «segs»', () => {
    expect(['15"', "1'30\"", "2'", '6 seg.', '6 segs'].map(leerDuracion)).toEqual([15, 90, 120, 6, 6]);
  });

  it('I1: una escena con algunos planos sin duración queda marcada como estimada', () => {
    const tec = '| Escena | N. de plano | Duración |\n|---|---|---|\n| 1 | 1 | 0:10 |\n| 1 | 2 | — |\n| 1 | 3 | 0:05 |\n';
    const t = armarTiming(construir(GUION), planosDeTecnico(tec));
    expect(t.filas[0]).toMatchObject({ planos: 3, estimado: true });
    expect(t.filas[0].segundos).toBeGreaterThanOrEqual(15);
  });
});
