import { describe, expect, it } from 'vitest';
import { aplicarMarca } from '../src/motor/marcas';

describe('aplicarMarca', () => {
  it('envuelve la selección', () => {
    expect(aplicarMarca('mirando el techo.', 0, 16, 'ut')).toEqual({ tipo: 'cambio', desde: 0, hasta: 16, texto: '{ut:mirando el techo}', cursor: 21 });
  });

  it('recorta espacios', () => {
    expect(aplicarMarca('el techo de casa', 2, 9, 'ut')).toEqual({ tipo: 'cambio', desde: 3, hasta: 8, texto: '{ut:techo}', cursor: 13 });
  });

  it('cambia de categoría', () => {
    const linea = 'mira el {ut:techo} ya';
    expect(aplicarMarca(linea, 12, 17, 'veh')).toEqual({ tipo: 'cambio', desde: 8, hasta: 18, texto: '{veh:techo}', cursor: 19 });
  });

  it('conserva nombre y cantidad al cambiar', () => {
    const linea = '{ut:techo|Techo|2}';
    expect(aplicarMarca(linea, 4, 9, 'veh')).toMatchObject({ tipo: 'cambio', desde: 0, hasta: 18, texto: '{veh:techo|Techo|2}' });
  });

  it('mismo código quita la marca', () => {
    expect(aplicarMarca('a {ut:techo} b', 6, 11, 'ut')).toEqual({ tipo: 'cambio', desde: 2, hasta: 12, texto: 'techo', cursor: 7 });
  });

  it('seleccionar la marca completa también cuenta como dentro', () => {
    expect(aplicarMarca('{ut:techo}', 0, 10, 'ut')).toMatchObject({ tipo: 'cambio', texto: 'techo' });
  });

  it('selección vacía', () => {
    expect(aplicarMarca('algo', 2, 2, 'ut')).toEqual({ tipo: 'ignorar' });
    expect(aplicarMarca('a   b', 1, 4, 'ut')).toEqual({ tipo: 'ignorar' });
  });

  it('código desconocido', () => {
    expect(aplicarMarca('algo', 0, 4, 'xyz')).toEqual({ tipo: 'ignorar' });
  });

  it('se encima con otra marca', () => {
    expect(aplicarMarca('el {ut:techo} y la pared', 0, 8, 'deco')).toEqual({ tipo: 'encimada' });
    expect(aplicarMarca('el {ut:techo} y la pared', 8, 24, 'deco')).toEqual({ tipo: 'encimada' });
  });
});
