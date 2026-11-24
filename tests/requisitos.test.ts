import { describe, expect, it } from 'vitest';
import { construir, leerReglas, verificarRequisitos } from '../src/motor';

const g = construir(
  'INT. CASA - COCINA - DÍA\n\nANA\nHola.\n\nBETO\nQué.\n\nEXT. CALLE - NOCHE\n\nAna corre.\n\nANA\nYa.\n\nINT. CASA - SALA - NOCHE\n\nANA\nFin.\n',
);
const v = (props: Record<string, unknown>) => verificarRequisitos(g, leerReglas(props)).map((r) => [r.regla, r.estado, r.culpables]);

describe('verificador de requisitos', () => {
  it('sin reglas no hay resultados', () => {
    expect(verificarRequisitos(g, leerReglas({ titulo: 'X', max_paginas: '' }))).toEqual([]);
  });
  it('números escritos como texto', () => {
    expect(v({ max_escenas: '2' })).toEqual([['max_escenas', 'falla', []]]);
    expect(v({ max_escenas: 3 })).toEqual([['max_escenas', 'advertencia', []]]);
    expect(v({ max_escenas: 10 })).toEqual([['max_escenas', 'ok', []]]);
  });
  it('páginas con 1/8 de tolerancia hacia arriba, y mínimo', () => {
    expect(v({ max_paginas: 1 })[0][1]).toBe('ok');
    expect(v({ min_paginas: 1 })[0][1]).toBe('falla');
  });
  it('locaciones, personajes, noches y escenas por locación', () => {
    expect(v({ max_locaciones: 2 })).toEqual([['max_locaciones', 'falla', ['CASA - COCINA', 'CALLE', 'CASA - SALA']]]);
    expect(v({ max_personajes_escena: 1 })).toEqual([['max_personajes_escena', 'falla', ['Esc. 1 (2)']]]);
    expect(v({ max_personajes: 1 })).toEqual([['max_personajes', 'falla', ['Ana', 'Beto']]]);
    expect(v({ max_noches_pct: 50 })).toEqual([['max_noches_pct', 'falla', ['Esc. 2', 'Esc. 3']]]);
    expect(v({ min_escenas_por_locacion: 2 })[0][1]).toBe('falla');
  });
  it('locaciones principales con asterisco', () => {
    expect(v({ locaciones_principales: ['CASA*'], min_principales_pct: 60 })).toEqual([['min_principales_pct', 'ok', ['CALLE']]]);
    expect(v({ locaciones_principales: 'CASA - COCINA', min_principales_pct: '50' })[0][1]).toBe('falla');
  });
  it('un máximo de cero sin nada que contar está bien, no «cuidado»', () => {
    const solo = construir('INT. A - DÍA\n\nAlgo.\n');
    expect(verificarRequisitos(solo, leerReglas({ max_noches_pct: 0 }))[0].estado).toBe('ok');
  });

  it('duración máxima en minutos', () => {
    expect(v({ max_duracion: 1 })[0][1]).toBe('ok');
    expect(verificarRequisitos(g, leerReglas({ max_duracion: 0.1 }))[0]).toMatchObject({ estado: 'falla' });
  });
});
