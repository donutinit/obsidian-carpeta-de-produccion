import { describe, expect, it } from 'vitest';
import { CORRECCIONES_POR_DEFECTO as D, corregir } from '../src/motor';

describe('correcciones', () => {
  it('tres puntos', () => {
    expect(corregir('Espera..', '', '.', 'accion', false, D)).toEqual({ borrar: 2, insertar: '…' });
    expect(corregir('Espera..', '', '.', 'accion', false, { ...D, puntos: false })).toBeNull();
  });

  it('comillas que abren y cierran', () => {
    expect(corregir('Dice ', '', '"', 'accion', false, D)).toEqual({ borrar: 0, insertar: '«' });
    expect(corregir('', '', '"', 'dialogo', true, D)).toEqual({ borrar: 0, insertar: '«' });
    expect(corregir('Dice «hola', '', '"', 'accion', false, D)).toEqual({ borrar: 0, insertar: '»' });
  });

  it('doble espacio y espacio al inicio', () => {
    expect(corregir('Hola ', '', ' ', 'accion', false, D)).toEqual({ borrar: 0, insertar: '' });
    expect(corregir('', '', ' ', 'accion', true, D)).toEqual({ borrar: 0, insertar: '' });
    expect(corregir('Hola', '', ' ', 'accion', false, D)).toBeNull();
  });

  it('mayúscula al inicio de párrafo pero no en acotación', () => {
    expect(corregir('', '', 'a', 'accion', true, D)).toEqual({ borrar: 0, insertar: 'A' });
    expect(corregir('', '', 'h', 'dialogo', true, D)).toEqual({ borrar: 0, insertar: 'H' });
    expect(corregir('¿', '', 'q', 'dialogo', true, D)).toEqual({ borrar: 0, insertar: 'Q' });
    expect(corregir('(', ')', 'e', 'acotacion', true, D)).toBeNull();
    expect(corregir('', '', 'a', 'accion', false, D)).toBeNull();
  });

  it('mayúscula tras punto solo al final', () => {
    expect(corregir('Hola. ', '', 'q', 'accion', false, D)).toEqual({ borrar: 0, insertar: 'Q' });
    expect(corregir('¿Ya? ', '', 'n', 'dialogo', false, D)).toEqual({ borrar: 0, insertar: 'N' });
    expect(corregir('Hola. ', 'mundo', 'q', 'accion', false, D)).toBeNull();
    expect(corregir('Hola. ', '', 'q', 'accion', false, { ...D, mayusculas: false })).toBeNull();
  });

  it('encabezado, personaje, transición y plano van en mayúsculas', () => {
    expect(corregir('INT. ', '', 'c', 'encabezado', false, D)).toEqual({ borrar: 0, insertar: 'C' });
    expect(corregir('AN', '', 'a', 'personaje', false, D)).toEqual({ borrar: 0, insertar: 'A' });
    expect(corregir('> CORTE ', '', 'a', 'transicion', false, D)).toEqual({ borrar: 0, insertar: 'A' });
  });

  it('no corrige dentro de {código, [[enlace ni %%comentario', () => {
    expect(corregir('{re', '', 'p', 'personaje', false, D)).toBeNull();
    expect(corregir('Ve a [[Ana', '', '"', 'accion', false, D)).toBeNull();
    expect(corregir('Algo. %%nota. ', '', 'q', 'accion', false, D)).toBeNull();
  });
});
