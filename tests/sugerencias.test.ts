import { describe, expect, it } from 'vitest';
import { sugerir } from '../src/motor';

const textos = (t: string, tipo: Parameters<typeof sugerir>[2], extra?: Parameters<typeof sugerir>[4]) =>
  sugerir(t, t.length, tipo, undefined, extra).map((s) => s.texto);

const LOCS = 'INT. CASA DE ANA - DÍA\n\nx.\n\nEXT. PATIO DE LA CASA - NOCHE\n\ny.\n\n';

describe('sugerencias', () => {
  it('inicios', () => {
    expect(sugerir('IN', 2, 'encabezado')).toEqual([
      { texto: 'INT. ', desde: 0, final: false },
      { texto: 'INT./EXT. ', desde: 0, final: false },
    ]);
  });

  it('locaciones: primero las que empiezan así; vacía, todas', () => {
    expect(sugerir(LOCS + 'INT. CAS', (LOCS + 'INT. CAS').length, 'encabezado')).toEqual([
      { texto: 'CASA DE ANA', desde: 5, final: false },
      { texto: 'PATIO DE LA CASA', desde: 5, final: false },
    ]);
    expect(textos(LOCS + 'INT. ', 'encabezado')).toEqual(['CASA DE ANA', 'PATIO DE LA CASA']);
  });

  it('momento al haber « - »', () => {
    const r = sugerir(LOCS + 'INT. CASA DE ANA - N', (LOCS + 'INT. CASA DE ANA - N').length, 'encabezado');
    expect(r).toEqual([{ texto: 'NOCHE', desde: 19, final: true }]);
    expect(textos(LOCS + 'INT. CASA DE ANA - ', 'encabezado').slice(0, 2)).toEqual(['DÍA', 'NOCHE']);
  });

  it('sublocación: CASA - CO → CASA - COCINA', () => {
    const t = 'INT. CASA - COCINA - DÍA\n\nx.\n\nINT. CASA - CO';
    expect(sugerir(t, t.length, 'encabezado')).toEqual([{ texto: 'CASA - COCINA', desde: 5, final: false }]);
  });

  it('personaje: el interlocutor va primero, luego el resto y los de la carpeta', () => {
    const t = 'INT. A - DÍA\n\nCARLA\nYa.\n\nINT. B - DÍA\n\nANA\nHola.\n\nBETO\nQué.\n\n';
    expect(textos(t, 'personaje')).toEqual(['ANA', 'BETO', 'CARLA']);
    expect(textos(t, 'personaje', { personajes: ['Diana'] })).toEqual(['ANA', 'BETO', 'CARLA', 'DIANA']);
    expect(textos(t + 'B', 'personaje')).toEqual(['BETO']);
  });

  it('extensión con paréntesis abierto cierra el paréntesis', () => {
    expect(sugerir('INT. A - DÍA\n\nANA (V', 'INT. A - DÍA\n\nANA (V'.length, 'personaje')).toEqual([{ texto: 'V.O.)', desde: 5, final: true }]);
  });

  it('transición: del diccionario y las ya usadas, con todo el párrafo como prefijo', () => {
    const r = sugerir('Algo.\n\n> CORTE', 'Algo.\n\n> CORTE'.length, 'transicion');
    expect(r.map((s) => s.texto)).toEqual(['CORTE A:', 'CORTE DIRECTO A:', 'CORTE A NEGRO.', 'CORTE PARALELO A:']);
    expect(r[0]).toMatchObject({ desde: 2, final: true });
    const usada = 'Algo.\n\n> SALTO A:\n\nINT. B - DÍA\n\nOtro.\n\n> S';
    expect(textos(usada, 'transicion')).toEqual(['SALE EN FUNDIDO.', 'SALTO A:']);
  });

  it('se esconde si lo tecleado ya está completo', () => {
    expect(textos('INT. A - DÍA\n\nANA\nHola.\n\nANA', 'personaje')).toEqual([]);
    expect(textos('Algo.\n\n> CORTE A:', 'transicion')).toEqual([]);
  });

  it('en acción no sugiere nada', () => {
    expect(textos('INT. A - DÍA\n\nAna ', 'accion')).toEqual([]);
  });
});

describe('sugerencias solo al final de la línea', () => {
  it('con texto después del cursor no se sugiere nada (salvo el paréntesis de cierre de una extensión)', () => {
    expect(sugerir('Algo.\n\nINT. A - DÍA', 'Algo.\n\n'.length, 'encabezado')).toEqual([]);
    expect(sugerir('Algo.\n\n> CORTE A:', 'Algo.\n\n'.length, 'transicion')).toEqual([]);
    const t = 'INT. A - DÍA\n\nANA (V)';
    expect(sugerir(t, t.length - 1, 'personaje').map((s) => s.texto)).toEqual(['V.O.)']);
  });
});
