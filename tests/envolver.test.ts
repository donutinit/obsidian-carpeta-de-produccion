import { describe, expect, it } from 'vitest';
import { analizarEnLinea, textoPlano } from '../src/motor/enlinea';
import { envolver } from '../src/motor/envolver';

const lineas = (texto: string, ancho: number) => envolver(analizarEnLinea(texto), ancho).map(textoPlano);

describe('envolver', () => {
  it('corta por palabra', () => {
    const texto = 'Francisco despierta tarde y corre hacia la puerta sin zapatos puestos.';
    expect(texto.length).toBe(70);
    const out = lineas(texto, 60);
    expect(out.length).toBe(2);
    for (const l of out) expect(l.length).toBeLessThanOrEqual(60);
    expect(out.join(' ')).toBe(texto);
  });

  it('palabra más larga que el ancho', () => {
    const t0 = performance.now();
    const out = lineas('x'.repeat(80), 35);
    expect(out.map((l) => l.length)).toEqual([35, 35, 10]);
    expect(performance.now() - t0).toBeLessThan(100);
  });

  it('conserva marcas al cortar', () => {
    const out = envolver(analizarEnLinea('aaaa bbbb {ut:cccc dddd} eeee'), 14);
    const conMarca = out.filter((l) => l.some((s) => s.cat === 'ut'));
    expect(conMarca.length).toBe(2);
    expect(out.map(textoPlano)).toEqual(['aaaa bbbb cccc', 'dddd eeee']);
  });

  it('quita espacios al inicio de las líneas siguientes y al final de cada línea', () => {
    const out = lineas('uno   dos   tres   ', 6);
    expect(out).toEqual(['uno', 'dos', 'tres']);
  });

  it('texto vacío da una línea vacía', () => {
    expect(envolver([], 60)).toEqual([[]]);
  });
});
